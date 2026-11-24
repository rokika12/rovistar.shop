"""KHQRPay checkout/webhooks with a configured ABA Pay fallback."""
import hashlib
import json
import re
import threading
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from sqlalchemy import and_, func, or_, update as sa_update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
import schemas
from database import SessionLocal, get_db
from security import get_current_user, log_activity, require_shop_access
from services import aba_service, khqrpay_service, pdf_service, stock_service, telegram_service
from services.aba_service import PaymentGatewayUnavailable, PaymentNotConfigured
from services.khqrpay_service import (KHQRPayGatewayError, KHQRPayNotConfigured,
                                      WebhookVerificationError)

router = APIRouter(prefix="/api/payments", tags=["payments"])


def _credit_wallet_topup_once(db, order, *, commit=True):
    """Make a confirmed top-up durable even if a deploy interrupts payment handling."""
    customer = db.query(models.Customer).filter(
        models.Customer.id == order.customer_id
    ).with_for_update().first()
    if not customer:
        return False
    existing = db.query(models.WalletTransaction).filter(
        models.WalletTransaction.customer_id == order.customer_id,
        models.WalletTransaction.reference == order.order_number,
        models.WalletTransaction.transaction_type == "topup",
    ).first()
    if existing:
        return False
    db.execute(
        sa_update(models.Customer)
        .where(models.Customer.id == customer.id)
        .values(wallet_balance=func.coalesce(models.Customer.wallet_balance, 0) + float(order.total or 0))
    )
    db.expire(customer)
    db.add(models.WalletTransaction(customer_id=customer.id, shop_id=order.shop_id,
                                    amount=order.total, transaction_type="topup",
                                    reference=order.order_number, note="KHQR wallet top-up"))
    if commit:
        db.commit()
    else:
        db.flush()
    return True


def _mark_paid(db, order, transaction_id, amount=None):
    """
    Mark an order paid atomically and deduct stock exactly ONCE.

    The verify endpoint is polled every 3 seconds AND the ABA webhook + success
    redirect can arrive at the same time. A naive check-and-set can cause both
    requests to see payment_status == 'pending' and each deduct stock (the
    double-deduction bug). Using a conditional UPDATE ... WHERE payment_status != 'paid'
    guarantees only the first request wins (SQLite serializes writers), so stock
    is deducted exactly once.
    """
    if order.payment_status == "paid":
        return False

    tx = transaction_id or order.transaction_id
    result = db.execute(
        sa_update(models.Order)
        .where(models.Order.id == order.id,
               models.Order.payment_status != "paid")
        .values(payment_status="paid", paid_at=datetime.utcnow(),
                transaction_id=tx)
    )
    if result.rowcount == 0:
        # Another request (webhook / poll / redirect) already marked it paid.
        db.expire(order)
        db.refresh(order)
        return False

    db.refresh(order)
    if order.payment_method == "wallet_topup":
        _credit_wallet_topup_once(db, order, commit=False)
        db.commit()
        return True
    # Consume one digital credential from each paid line item. The order keeps
    # a private snapshot for delivery, while the product pool loses that entry.
    for item in order.items:
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if not product:
            continue
        metadata = models.JSONText.loads(product.metadata_json, {})
        delivery = models.JSONText.loads(item.variations, {}).get("_digital_delivery")
        pool = (metadata.get("digital_delivery") or {}).get("credentials") or []
        if delivery and pool:
            remaining = [entry for entry in pool if entry != delivery]
            metadata["digital_delivery"]["credentials"] = remaining
            product.metadata_json = models.JSONText.dumps(metadata)

    # ⬇️ Auto-deduct stock on payment success (only the winning request reaches here)
    order._stock_summary = stock_service.deduct_stock_for_order(db, order)
    db.commit()
    return True


def _process_first_payment(db, order, shop):
    """Side effects for the FIRST successful payment confirmation:
    generate receipt, send Telegram payment alert, low-stock alert, activity log."""
    # A paid manual-service request is now in the service team's queue.
    if any(models.JSONText.loads(item.variations, {}).get("_service_link") for item in order.items):
        order.order_status = "processing"
        db.commit()
        db.refresh(order)
    # Provider calls happen only after Rovistar payment is confirmed. The provider
    # reference is deterministic so a retry cannot create a duplicate top-up.
    from services.provider_service import fulfill_paid_order
    fulfill_paid_order(db, order)
    items = [i.to_dict() for i in order.items]
    order.receipt_url = pdf_service.generate_receipt(order, shop, items)
    tg = shop.telegram_dict()
    if tg.get("enabled"):
        # Full-detail payment-success notification (items, customer, stock left)
        telegram_service.notify_shop_payment_success_full(
            shop, order, getattr(order, "_stock_summary", None))
    # Customer delivery is separate from the owner's order alert and is guarded
    # again by paid status, the canonical gift URL, and a valid @username.
    telegram_service.notify_customer_telegram_gifts(shop, order)
    try:
        stock_service.send_low_stock_alerts(db, shop)
    except Exception:
        pass
    db.commit()
    log_activity(db, "payment_success", f"Payment confirmed for #{order.order_number} "
                 f"({order.total} {order.currency})", order.shop_id)
    db.commit()


def _process_paid_order_background(order_id: int, event_row_id=None):
    """Run durable receipt/provider/notification work after the webhook response."""
    db = SessionLocal()
    try:
        if event_row_id is not None:
            stale_before = datetime.utcnow() - timedelta(minutes=5)
            claimed = db.execute(
                sa_update(models.PaymentEvent)
                .where(
                    models.PaymentEvent.id == event_row_id,
                    or_(
                        models.PaymentEvent.processing_status == "fulfillment_pending",
                        and_(
                            models.PaymentEvent.processing_status == "fulfillment_processing",
                            models.PaymentEvent.processed_at < stale_before,
                        ),
                    ),
                )
                .values(processing_status="fulfillment_processing", processed_at=datetime.utcnow())
            )
            db.commit()
            if claimed.rowcount == 0:
                return
        order = db.get(models.Order, order_id)
        if not order or order.payment_status != "paid":
            return
        shop = db.get(models.Shop, order.shop_id)
        if shop:
            _process_first_payment(db, order, shop)
        if event_row_id is not None:
            event = db.get(models.PaymentEvent, event_row_id)
            if event:
                event.processing_status = "processed"
                event.processed_at = datetime.utcnow()
                db.commit()
    except Exception:
        db.rollback()
        if event_row_id is not None:
            event = db.get(models.PaymentEvent, event_row_id)
            if event:
                event.processing_status = "fulfillment_pending"
                event.processed_at = None
                db.commit()
            retry = threading.Timer(
                30,
                _process_paid_order_background,
                args=(order_id, event_row_id),
            )
            retry.daemon = True
            retry.start()
    finally:
        db.close()


def resume_pending_payment_fulfillments():
    """Resume durable webhook work after a process restart without delaying boot."""
    db = SessionLocal()
    try:
        stale_before = datetime.utcnow() - timedelta(minutes=5)
        rows = db.query(models.PaymentEvent.id, models.PaymentEvent.order_id).filter(
            models.PaymentEvent.provider == "khqrpay",
            models.PaymentEvent.order_id.isnot(None),
            or_(
                models.PaymentEvent.processing_status == "fulfillment_pending",
                and_(
                    models.PaymentEvent.processing_status == "fulfillment_processing",
                    models.PaymentEvent.processed_at < stale_before,
                ),
            ),
        ).limit(100).all()
    finally:
        db.close()
    for event_id, order_id in rows:
        threading.Thread(
            target=_process_paid_order_background,
            args=(order_id, event_id),
            daemon=True,
        ).start()
    if len(rows) == 100:
        continuation = threading.Timer(5, resume_pending_payment_fulfillments)
        continuation.daemon = True
        continuation.start()


def _parse_provider_datetime(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _render_khqrpay_qr(result: dict) -> str:
    qr_string = str(result.get("qr_string") or "")
    payment_id = re.sub(r"[^A-Za-z0-9_-]", "", str(result.get("id") or ""))[:80]
    if not qr_string or not payment_id:
        return ""
    return aba_service.generate_qr_image(qr_string, f"khqrpay_{payment_id}.png")


def create_payment_for_order(db: Session, order, shop, *, success_url="", error_url="",
                             cancel_url="", checkout_attempt_id="") -> dict:
    """Create one idempotent KHQRPay attempt or configured ABA fallback attempt."""
    if khqrpay_service.is_configured():
        provider = "khqrpay"
    elif aba_service.is_configured(shop):
        provider = "aba"
    else:
        raise PaymentNotConfigured(
            "Online payment is not configured. Set both KHQRPAY secrets or configure ABA Pay."
        )

    idempotency_key = str(checkout_attempt_id or "").strip()
    if not idempotency_key:
        latest = db.query(models.PaymentAttempt).filter(
            models.PaymentAttempt.order_id == order.id,
            models.PaymentAttempt.provider == provider,
        ).order_by(models.PaymentAttempt.id.desc()).first()
        recent_cutoff = datetime.utcnow() - timedelta(minutes=10)
        if (latest and latest.created_at >= recent_cutoff
                and latest.status in {"creating", "pending", "scanned"}
                and (latest.expires_at is None or latest.expires_at > datetime.utcnow())):
            idempotency_key = latest.idempotency_key
        else:
            idempotency_key = f"order-{order.id}-{uuid.uuid4().hex}"
    if len(idempotency_key) > 255:
        raise HTTPException(status_code=400, detail="Idempotency-Key must be at most 255 characters")

    currency = str(order.currency or "USD").upper()
    amount = (
        khqrpay_service.format_amount(order.total, currency)
        if provider == "khqrpay" else f"{float(order.total or 0):.2f}"
    )
    attempt = db.query(models.PaymentAttempt).filter(
        models.PaymentAttempt.provider == provider,
        models.PaymentAttempt.idempotency_key == idempotency_key,
    ).first()
    if attempt:
        if (attempt.order_id != order.id or attempt.amount != amount
                or attempt.currency != currency):
            raise HTTPException(status_code=409, detail="Idempotency-Key belongs to another checkout")
        if attempt.provider_payment_id:
            return attempt.to_payment_dict()
    else:
        attempt = models.PaymentAttempt(
            order_id=order.id,
            provider=provider,
            idempotency_key=idempotency_key,
            amount=amount,
            currency=currency,
            status="creating",
        )
        db.add(attempt)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            attempt = db.query(models.PaymentAttempt).filter(
                models.PaymentAttempt.provider == provider,
                models.PaymentAttempt.idempotency_key == idempotency_key,
            ).first()
            if not attempt or attempt.order_id != order.id:
                raise HTTPException(status_code=409, detail="Idempotency-Key is already in use")
            if attempt.provider_payment_id:
                return attempt.to_payment_dict()

    if provider == "aba":
        result = aba_service.build_checkout_url(
            order, shop, success_url=success_url, error_url=error_url, cancel_url=cancel_url)
        result = {**result, "provider": "aba", "attempt_id": attempt.id}
        attempt.provider_payment_id = result["transaction_id"]
        attempt.status = "pending"
        attempt.qr_string = result.get("qr_content") or ""
        attempt.checkout_url = result.get("checkout_url") or ""
        attempt.response_json = models.JSONText.dumps(result)
        order.transaction_id = result["transaction_id"]
        order.payment_detail = models.JSONText.dumps({
            "provider": "aba",
            "attempt_id": attempt.id,
        })
        db.commit()
        db.refresh(attempt)
        return attempt.to_payment_dict()

    purpose = "wallet_topup" if order.payment_method == "wallet_topup" else "order"
    result = khqrpay_service.create_payment(
        amount=amount,
        currency=currency,
        reference_id=order.order_number,
        idempotency_key=idempotency_key,
        metadata={
            "order_id": order.id,
            "order_number": order.order_number,
            "shop_id": order.shop_id,
            "purpose": purpose,
        },
    )
    if (result.get("amount") != amount or result.get("currency") != currency
            or result.get("reference_id") != order.order_number):
        raise KHQRPayGatewayError("KHQRPay returned mismatched payment details")

    qr_code_url = _render_khqrpay_qr(result)
    if qr_code_url:
        result["qr_code_url"] = qr_code_url
    attempt.provider_payment_id = result["id"]
    attempt.status = result.get("status") or "pending"
    attempt.qr_string = result.get("qr_string") or ""
    attempt.checkout_url = result.get("checkout_url") or ""
    attempt.expires_at = _parse_provider_datetime(result.get("expires_at"))
    attempt.response_json = models.JSONText.dumps(result)
    order.transaction_id = result["id"]
    order.payment_detail = models.JSONText.dumps({
        "provider": "khqrpay",
        "attempt_id": attempt.id,
        "expires_at": result.get("expires_at"),
    })
    db.commit()
    db.refresh(attempt)
    return attempt.to_payment_dict()


@router.get("/khqrpay/status")
@router.get("/aba/status")
def payment_status(shop_id: int, db: Session = Depends(get_db)):
    """Public provider availability used to decide whether checkout can start."""
    shop = db.query(models.Shop).filter(models.Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    if khqrpay_service.is_configured():
        return {"shop_id": shop_id, "configured": True, "provider": "khqrpay"}
    configured = aba_service.is_configured(shop)
    return {"shop_id": shop_id, "configured": configured,
            "provider": "aba" if configured else None}


@router.post("/khqrpay/create")
@router.post("/aba/create")
def create_checkout_payment(
        data: schemas.PaymentCreate,
        db: Session = Depends(get_db),
        idempotency_key: str = Header(default="", alias="Idempotency-Key")):
    """Create a KHQRPay checkout, or configured ABA checkout as a fallback."""
    order = db.query(models.Order).filter(models.Order.id == data.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.payment_status == "paid":
        raise HTTPException(status_code=409, detail="Order is already paid")
    shop = db.query(models.Shop).filter(models.Shop.id == order.shop_id).first()

    try:
        return create_payment_for_order(
            db,
            order,
            shop,
            success_url=data.success_url,
            error_url=data.error_url,
            cancel_url=data.cancel_url,
            checkout_attempt_id=idempotency_key or data.checkout_attempt_id,
        )
    except (PaymentNotConfigured, KHQRPayNotConfigured) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (PaymentGatewayUnavailable, KHQRPayGatewayError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/khqrpay/verify")
@router.post("/aba/verify")
def verify_checkout_payment(data: schemas.PaymentVerify, background_tasks: BackgroundTasks,
                            db: Session = Depends(get_db)):
    """Read webhook-owned KHQRPay status or verify a configured ABA fallback."""
    order = db.query(models.Order).filter(models.Order.id == data.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    attempt_query = db.query(models.PaymentAttempt).filter(
        models.PaymentAttempt.order_id == order.id,
        models.PaymentAttempt.provider == "khqrpay",
    )
    if data.transaction_id:
        attempt_query = attempt_query.filter(
            models.PaymentAttempt.provider_payment_id == data.transaction_id)
    else:
        attempt_query = attempt_query.order_by(models.PaymentAttempt.id.desc())
    attempt = attempt_query.first()
    if attempt:
        paid = attempt.status == "paid" and order.payment_status == "paid"
        return {
            "verified": paid,
            "status": "success" if paid else attempt.status,
            "transaction_id": attempt.provider_payment_id,
            "provider": "khqrpay",
        }

    requested_transaction = (data.transaction_id or order.transaction_id or "").strip()
    if not order.transaction_id or requested_transaction != order.transaction_id:
        return {"verified": False, "status": "error", "detail": "Transaction does not belong to order"}
    shop = db.query(models.Shop).filter(models.Shop.id == order.shop_id).first()
    if not aba_service.is_configured(shop):
        return {"verified": False, "status": "not_configured"}
    result = aba_service.verify_payment(order, shop, transaction_id=requested_transaction)
    if result.get("verified"):
        newly_paid = _mark_paid(
            db, order, result.get("transaction_id") or requested_transaction, result.get("amount"))
        if newly_paid:
            background_tasks.add_task(_process_paid_order_background, order.id)
    return result


def _finish_event(db: Session, event, status: str):
    event.processing_status = status
    event.processed_at = (
        None if status == "fulfillment_pending" else datetime.utcnow()
    )
    db.commit()


@router.post("/webhooks/khqrpay")
@router.post("/khqrpay/webhook")
async def khqrpay_webhook(request: Request, background_tasks: BackgroundTasks,
                          db: Session = Depends(get_db)):
    """Authenticate the exact request bytes, dedupe, then apply safe state changes."""
    raw_body = await request.body()
    signature = request.headers.get("X-KHQRPay-Signature", "")
    try:
        khqrpay_service.verify_webhook_signature(raw_body, signature)
    except WebhookVerificationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        payload = json.loads(raw_body)
    except (TypeError, ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Malformed webhook JSON") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Malformed webhook payload")

    event_id = str(payload.get("id") or "").strip()
    event_type = str(payload.get("type") or "").strip()
    if not event_id or len(event_id) > 255 or not event_type or len(event_type) > 100:
        raise HTTPException(status_code=400, detail="Webhook event id and type are required")

    existing = db.query(models.PaymentEvent).filter(
        models.PaymentEvent.provider == "khqrpay",
        models.PaymentEvent.provider_event_id == event_id,
    ).first()
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    payment = data.get("payment") if isinstance(data.get("payment"), dict) else {}
    payment_id = str(payment.get("id") or "").strip()
    payload_sha256 = hashlib.sha256(raw_body).hexdigest()
    if existing:
        if existing.payload_sha256 != payload_sha256:
            raise HTTPException(status_code=400, detail="Webhook event id payload mismatch")
        if existing.processing_status not in {"received", "unmatched"}:
            return {"ok": True, "duplicate": True, "processed": False}
        event = existing
        event.event_type = event_type
        event.provider_payment_id = payment_id
        event.livemode = payload.get("livemode") is True
        event.processing_status = "received"
        event.processed_at = None
    else:
        event = models.PaymentEvent(
            provider="khqrpay",
            provider_event_id=event_id,
            event_type=event_type,
            provider_payment_id=payment_id,
            livemode=payload.get("livemode") is True,
            payload_sha256=payload_sha256,
        )
        db.add(event)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            return {"ok": True, "duplicate": True, "processed": False}

    # Signed dashboard tests and test-key events are acknowledged and audited,
    # but can never deliver products or credit a wallet.
    if (payload.get("livemode") is not True
            or payload.get("test") not in (None, False)):
        _finish_event(db, event, "ignored_test")
        return {"ok": True, "duplicate": False, "processed": False}

    if event_type not in {
            "payment.completed", "payment.scanned", "payment.expired", "payment.failed"}:
        _finish_event(db, event, "ignored_type")
        return {"ok": True, "duplicate": False, "processed": False}
    if not payment_id:
        _finish_event(db, event, "rejected_payload")
        return {"ok": True, "duplicate": False, "processed": False}

    attempt = db.query(models.PaymentAttempt).filter(
        models.PaymentAttempt.provider == "khqrpay",
        models.PaymentAttempt.provider_payment_id == payment_id,
    ).first()
    if not attempt:
        _finish_event(db, event, "unmatched")
        raise HTTPException(status_code=503, detail="Payment attempt is not ready")
    order = db.get(models.Order, attempt.order_id)
    if not order:
        _finish_event(db, event, "unmatched")
        raise HTTPException(status_code=503, detail="Payment attempt is not ready")
    event.order_id = order.id

    if event_type == "payment.completed":
        amount = payment.get("amount", payment.get("requested_amount"))
        currency = str(payment.get("currency") or payment.get("requested_currency") or "").upper()
        reference_id = str(payment.get("reference_id") or "")
        try:
            normalized_amount = khqrpay_service.format_amount(amount, currency)
        except KHQRPayGatewayError:
            normalized_amount = ""
        valid_payment = (
            str(payment.get("status") or "").lower() == "paid"
            and normalized_amount == attempt.amount
            and currency == attempt.currency
            and reference_id == order.order_number
        )
        if not valid_payment:
            _finish_event(db, event, "rejected_payload")
            return {"ok": True, "duplicate": False, "processed": False}

        # Completion is authoritative even after an expired event. The parent
        # order's paid state remains monotonic and can only be won once.
        attempt.status = "paid"
        attempt.completed_at = _parse_provider_datetime(payment.get("approved_at")) or datetime.utcnow()
        event.processing_status = "fulfillment_pending"
        event.processed_at = None
        newly_paid = _mark_paid(db, order, payment_id, normalized_amount)
        if newly_paid:
            background_tasks.add_task(_process_paid_order_background, order.id, event.id)
        else:
            _finish_event(db, event, "processed")
        return {"ok": True, "duplicate": False, "processed": newly_paid}

    if (order.payment_status != "paid"
            and attempt.status not in {"paid", "expired", "failed"}):
        if event_type == "payment.expired":
            attempt.status = "expired"
        elif event_type == "payment.failed":
            attempt.status = "failed"
        elif event_type == "payment.scanned" and attempt.status not in {"expired", "failed"}:
            attempt.status = "scanned"
    _finish_event(db, event, "processed")
    return {"ok": True, "duplicate": False, "processed": False}


@router.post("/aba/webhook")
async def aba_webhook(request: Request, background_tasks: BackgroundTasks,
                      db: Session = Depends(get_db)):
    """ABA fallback callback; successful payloads are verified with ABA first."""
    try:
        payload = await request.json()
    except Exception:
        form = await request.form()
        payload = {k: v for k, v in form.items()}

    tran_id = payload.get("tran_id") or payload.get("transaction_id") or ""
    status = payload.get("status") or payload.get("transaction_status") or ""
    order = db.query(models.Order).filter(models.Order.transaction_id == tran_id).first()
    if not order:
        return {"ok": False, "detail": "transaction not found"}

    if str(status).lower() in ("successful", "success", "approved", "paid", "SUCCESS"):
        shop = db.query(models.Shop).filter(models.Shop.id == order.shop_id).first()
        result = aba_service.verify_payment(order, shop, transaction_id=tran_id)
        if not result.get("verified"):
            raise HTTPException(status_code=503, detail="ABA payment is not verified")
        newly_paid = _mark_paid(db, order, tran_id, result.get("amount"))
        if newly_paid:
            background_tasks.add_task(_process_paid_order_background, order.id)
    elif (str(status).lower() in ("failed", "cancelled", "declined")
          and order.payment_status != "paid"):
        order.payment_status = "failed"
        db.commit()
    return {"ok": True}


@router.get("/aba/success")
def aba_success(order_id: int, background_tasks: BackgroundTasks,
                db: Session = Depends(get_db)):
    """Customer landing endpoint; never trusts the redirect as payment proof."""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        return {"ok": True, "detail": "Payment pending", "order_id": order_id}
    khqr_attempt = db.query(models.PaymentAttempt).filter(
        models.PaymentAttempt.order_id == order.id,
        models.PaymentAttempt.provider == "khqrpay",
        models.PaymentAttempt.provider_payment_id == order.transaction_id,
    ).first()
    if khqr_attempt:
        return {"ok": True, "detail": "Payment confirmation pending", "order_id": order_id}
    shop = db.query(models.Shop).filter(models.Shop.id == order.shop_id).first()
    result = aba_service.verify_payment(order, shop, transaction_id=order.transaction_id)
    if result.get("verified"):
        newly_paid = _mark_paid(db, order, order.transaction_id, result.get("amount"))
        if newly_paid:
            background_tasks.add_task(_process_paid_order_background, order.id)
    return {"ok": True, "detail": "Payment verification requested", "order_id": order_id}


@router.get("/aba/error")
def aba_error(order_id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if order and order.payment_status != "paid":
        khqr_attempt = db.query(models.PaymentAttempt).filter(
            models.PaymentAttempt.order_id == order.id,
            models.PaymentAttempt.provider == "khqrpay",
            models.PaymentAttempt.provider_payment_id == order.transaction_id,
        ).first()
        if khqr_attempt:
            return {"ok": False, "detail": "Payment pending", "order_id": order_id}
        order.payment_status = "failed"
        db.commit()
    return {"ok": False, "detail": "Payment error", "order_id": order_id}


@router.post("/aba/test")
def test_payment(shop_id: int, db: Session = Depends(get_db),
                 user: models.User = Depends(get_current_user)):
    """Test ABA configuration by building a real KHQRcc checkout URL."""
    require_shop_access(shop_id, user)
    shop = db.query(models.Shop).filter(models.Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    aba = shop.aba_dict()
    profile_id = aba.get("profile_id", "")
    secret_key = aba.get("secret_key", "")
    if not profile_id or not secret_key:
        raise HTTPException(status_code=400, detail="ABA Pay profile ID and secret key are not configured")
    tran_id = aba_service.generate_transaction_id("TEST")
    amount = "1.00"
    success_url = "http://localhost:3000"
    remark = "Mini Shop platform test"
    h = aba_service.aba_hash(secret_key, tran_id, amount, success_url, remark)
    checkout_url = (
        f"{aba_service.KHQRCC_BASE}/payment/requestv2/{profile_id}"
        f"?transaction_id={tran_id}&amount={amount}&success_url={success_url}"
        f"&remark={remark}&hash={h}"
    )
    return {
        "ok": True,
        "profile_id": profile_id,
        "transaction_id": tran_id,
        "amount": amount,
        "hash": h,
        "checkout_url": checkout_url,
    }
