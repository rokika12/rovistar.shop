"""Server-side KHQRPay HTTPS client and webhook signature verification."""
import hashlib
import hmac
import re
import time
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from urllib.parse import urlparse

import httpx

from config import config


class KHQRPayError(Exception):
    """Base error for safe, user-facing KHQRPay failures."""


class KHQRPayNotConfigured(KHQRPayError):
    """Raised when the server-side KHQRPay API secret is absent."""


class KHQRPayGatewayError(KHQRPayError):
    """Raised when KHQRPay cannot create a usable payment."""


class WebhookVerificationError(KHQRPayError):
    """Raised when a webhook cannot be authenticated."""


def is_configured() -> bool:
    return bool(
        (config.KHQRPAY_SECRET_KEY or "").strip()
        and (config.KHQRPAY_WEBHOOK_SECRET or "").strip()
    )


def _api_url() -> str:
    base_url = (config.KHQRPAY_BASE_URL or "").strip().rstrip("/")
    parsed = urlparse(base_url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise KHQRPayNotConfigured("KHQRPay requires a valid HTTPS base URL")
    return f"{base_url}/v1/payments"


def format_amount(amount, currency: str) -> str:
    currency = str(currency or "").upper()
    if currency not in {"USD", "KHR"}:
        raise KHQRPayGatewayError("KHQRPay supports only USD and KHR")
    try:
        value = Decimal(str(amount))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise KHQRPayGatewayError("Invalid payment amount") from exc
    if not value.is_finite() or value <= 0:
        raise KHQRPayGatewayError("Payment amount must be greater than zero")
    quantum = Decimal("1") if currency == "KHR" else Decimal("0.01")
    normalized = value.quantize(quantum, rounding=ROUND_HALF_UP)
    if currency == "KHR" and normalized != value:
        raise KHQRPayGatewayError("KHR payment amounts must be whole riel")
    return format(normalized, ".0f" if currency == "KHR" else ".2f")


def create_payment(amount, currency: str, reference_id: str, idempotency_key: str,
                   metadata=None) -> dict:
    """Create one KHQRPay checkout using a server-only bearer secret."""
    secret = (config.KHQRPAY_SECRET_KEY or "").strip()
    if not secret:
        raise KHQRPayNotConfigured("KHQRPay is not configured")
    key = str(idempotency_key or "").strip()
    if not key or len(key) > 255:
        raise KHQRPayGatewayError("A valid checkout idempotency key is required")

    currency = str(currency or "USD").upper()
    payload = {
        "amount": format_amount(amount, currency),
        "currency": currency,
        "reference_id": str(reference_id),
        "metadata": metadata or {},
    }
    headers = {
        "Authorization": f"Bearer {secret}",
        "Content-Type": "application/json",
        "Idempotency-Key": key,
    }
    try:
        with httpx.Client(
            timeout=httpx.Timeout(8.0, connect=4.0),
            follow_redirects=False,
        ) as client:
            response = client.post(_api_url(), json=payload, headers=headers)
    except httpx.HTTPError as exc:
        raise KHQRPayGatewayError("KHQRPay is temporarily unavailable") from exc

    if response.status_code not in {200, 201}:
        raise KHQRPayGatewayError(f"KHQRPay rejected the payment request ({response.status_code})")
    try:
        body = response.json()
    except ValueError as exc:
        raise KHQRPayGatewayError("KHQRPay returned an invalid response") from exc
    if not isinstance(body, dict) or not str(body.get("id") or "").strip():
        raise KHQRPayGatewayError("KHQRPay returned no payment id")

    response_currency = str(body.get("currency") or currency).upper()
    response_amount = format_amount(body.get("amount", payload["amount"]), response_currency)
    checkout_url = str(body.get("checkout_url") or "")
    if checkout_url and urlparse(checkout_url).scheme != "https":
        raise KHQRPayGatewayError("KHQRPay returned an invalid checkout URL")
    expires_at = body.get("expires_at") or body.get("expires")

    # Only fields needed by checkout are returned or persisted. The bearer secret
    # and arbitrary upstream fields never leave this server-side boundary.
    return {
        "id": str(body["id"]),
        "transaction_id": str(body["id"]),
        "provider": "khqrpay",
        "livemode": body.get("livemode") is True,
        "status": str(body.get("status") or "pending"),
        "amount": response_amount,
        "currency": response_currency,
        "reference_id": str(body.get("reference_id") or reference_id),
        "qr_string": str(body.get("qr_string") or ""),
        "checkout_url": checkout_url,
        "expires_at": expires_at,
        "expires": expires_at,
    }


def verify_webhook_signature(raw_body: bytes, signature_header: str, *, now=None,
                             secret=None) -> int:
    """Verify `t.<raw body>` with HMAC-SHA256 and return the signed timestamp."""
    webhook_secret = config.KHQRPAY_WEBHOOK_SECRET if secret is None else secret
    webhook_secret = str(webhook_secret or "").strip()
    if not webhook_secret:
        raise WebhookVerificationError("KHQRPay webhook secret is not configured")
    if not isinstance(raw_body, bytes):
        raise WebhookVerificationError("Invalid webhook body")
    if not signature_header:
        raise WebhookVerificationError("Missing X-KHQRPay-Signature header")

    timestamps = []
    signatures = []
    for part in signature_header.split(","):
        key, separator, value = part.strip().partition("=")
        if not separator or not value:
            raise WebhookVerificationError("Malformed X-KHQRPay-Signature header")
        if key == "t":
            timestamps.append(value)
        elif key == "v1":
            signatures.append(value)
    if len(timestamps) != 1 or not signatures:
        raise WebhookVerificationError("Malformed X-KHQRPay-Signature header")
    try:
        timestamp = int(timestamps[0])
    except (TypeError, ValueError) as exc:
        raise WebhookVerificationError("Malformed webhook timestamp") from exc

    current_time = int(time.time() if now is None else now)
    if abs(current_time - timestamp) > int(config.KHQRPAY_WEBHOOK_TOLERANCE_SECONDS):
        raise WebhookVerificationError("Webhook timestamp is outside the allowed window")
    if any(not re.fullmatch(r"[0-9a-fA-F]{64}", value) for value in signatures):
        raise WebhookVerificationError("Malformed webhook signature")

    signed_payload = str(timestamp).encode("ascii") + b"." + raw_body
    expected = hmac.new(webhook_secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    if not any(hmac.compare_digest(expected, value.lower()) for value in signatures):
        raise WebhookVerificationError("Invalid webhook signature")
    return timestamp
