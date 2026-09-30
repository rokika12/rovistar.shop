"""Documented server-to-server game supplier actions."""
import httpx

import models


def is_khmer_topup(provider):
    return "khmer-topup.com/api/v1" in (provider.catalog_url or "")


def headers(provider):
    key = provider.api_key
    if not key:
        raise ValueError("Provider API key is not configured")
    return {"Accept": "application/json", "Content-Type": "application/json", provider.auth_header or "X-API-Key": key}


def verify_player(provider, slug, player_id, server_id=""):
    params = {"slug": slug, "player_id": player_id}
    if server_id:
        params["server_id"] = server_id
    response = httpx.get("https://khmer-topup.com/api/v1/check", params=params, headers=headers(provider), timeout=12)
    response.raise_for_status()
    return response.json()


def place_order(provider, package_id, player_id, reference, server_id=""):
    payload = {"package_id": int(package_id), "player_id": player_id, "reference": reference}
    if server_id:
        payload["server_id"] = server_id
    response = httpx.post("https://khmer-topup.com/api/v1/orders", json=payload, headers=headers(provider), timeout=15)
    response.raise_for_status()
    return response.json()


def fulfill_paid_order(db, order):
    """Submit documented provider orders once; reference makes retries idempotent."""
    outcomes = []
    for item in order.items:
        values = models.JSONText.loads(item.variations, {})
        if values.get("_provider_order_code"):
            continue
        product = db.get(models.Product, item.product_id)
        metadata = models.JSONText.loads(product.metadata_json, {}) if product else {}
        if not metadata.get("provider_fulfillment_enabled"):
            continue
        provider = db.get(models.ProviderConnection, metadata.get("provider_id"))
        if not provider or not is_khmer_topup(provider):
            continue
        player_id = str(values.get("_provider_player_id") or "").strip()
        if not player_id:
            continue
        try:
            package_id = values.get("_provider_package_id") or metadata.get("provider_package_id")
            result = place_order(provider, package_id, player_id, f"rovistar-{order.order_number}-{item.id}", str(values.get("_provider_server_id") or ""))
            values["_provider_order_code"] = str(result.get("order_code") or "")
            values["_provider_status"] = str(result.get("status") or "processing")
            item.variations = models.JSONText.dumps(values)
            outcomes.append(values["_provider_status"])
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            values["_provider_error"] = str(exc)[:180]
            item.variations = models.JSONText.dumps(values)
            outcomes.append("provider_error")
    if outcomes:
        order.order_status = "processing"
        db.commit()
    return outcomes
