"""Admin-only provider catalog import.

This feature imports only from documented supplier endpoints. It never automates
consumer checkout pages or undocumented provider routes.
"""
import ipaddress
import socket
from urllib.parse import quote
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from security import get_current_admin, log_activity
from services import provider_service

router = APIRouter(prefix="/api/provider-catalog", tags=["provider-catalog"])


def _safe_https_url(url: str) -> str:
    value = (url or "").strip()
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Catalog URL must use HTTPS")
    try:
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM)
        for address in addresses:
            ip = ipaddress.ip_address(address[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                raise HTTPException(status_code=400, detail="Catalog URL must use a public internet host")
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Catalog host could not be resolved")
    return value


def _catalog_rows(payload):
    # Khmer TopUp's documented /games response nests purchasable packages in games.
    if isinstance(payload, dict) and isinstance(payload.get("games"), list):
        packages = []
        for game in payload["games"]:
            for package in game.get("packages") or []:
                packages.append({
                    "id": f"{game.get('slug')}:{package.get('package_id')}",
                    "name": f"{game.get('name')} - {package.get('name')}",
                    "price": package.get("price", 0), "game_slug": game.get("slug", ""),
                    "package_id": package.get("package_id"), "id_label": game.get("id_label", "Player ID"),
                    "server_label": game.get("server_label"), "tag": package.get("tag", ""),
                })
        return packages
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        return []
    for key in ("games", "products", "items", "data", "result"):
        value = payload.get(key)
        if isinstance(value, list):
            return value
        if isinstance(value, dict):
            for nested in ("games", "products", "items"):
                if isinstance(value.get(nested), list):
                    return value[nested]
    return []


def _first(row, *keys, default=""):
    for key in keys:
        value = row.get(key)
        if value is not None and str(value).strip() != "":
            return value
    return default


def _normalize(row):
    if not isinstance(row, dict):
        return None
    external_id = str(_first(row, "id", "game_id", "product_id", "code", "sku")).strip()
    name = str(_first(row, "name", "game_name", "product_name", "title")).strip()
    if not external_id or not name:
        return None
    price = _first(row, "price", "cost", "amount", "base_price", default=0)
    try:
        price = float(price)
    except (TypeError, ValueError):
        price = 0.0
    return {"external_id": external_id, "name": name, "description": str(_first(row, "description", "details")), "price": max(0.0, price), "image": str(_first(row, "image", "image_url", "thumbnail")), "raw": row}


def _service_platform(slug):
    slug = str(slug or "").lower()
    if "freefire" in slug or "free-fire" in slug:
        return "free_fire"
    if "mobile-legends" in slug or "mlbb" in slug:
        return "mobile_legends"
    return "provider_game"


def _default_game_slug(platform):
    """Known Khmer TopUp lookup slugs for legacy manual game products."""
    return {
        "free_fire": "freefire-sgmy",
        "mobile_legends": "mobile-legends",
    }.get(str(platform or "").lower(), "")


def _verification_provider(db, metadata):
    """Use an explicit product connection first, then the shared game checker."""
    provider = db.get(models.ProviderConnection, metadata.get("provider_id"))
    slug = str(metadata.get("provider_game_slug") or "").strip()
    if provider and slug:
        return provider, slug

    slug = _default_game_slug(metadata.get("service_platform"))
    if not slug:
        return None, ""
    provider = next(
        (item for item in db.query(models.ProviderConnection).all()
         if item.api_key_encrypted and provider_service.is_khmer_topup(item)),
        None,
    )
    return provider, slug


def _game_cover(name, slug):
    """Supplier catalog omits artwork, so provide a branded fallback card."""
    palette = "#f97316,#7c2d12" if "freefire" in str(slug).lower() else "#2563eb,#172554"
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><defs><linearGradient id="g"><stop stop-color="{palette.split(",")[0]}"/><stop offset="1" stop-color="{palette.split(",")[1]}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><rect x="75" y="105" width="750" height="690" rx="48" fill="#07152f" opacity=".86" stroke="#facc15" stroke-width="10"/><text x="450" y="245" text-anchor="middle" fill="#facc15" font-family="Arial" font-size="64" font-weight="bold">VIP TOP UP</text><text x="450" y="390" text-anchor="middle" fill="white" font-family="Arial" font-size="120">◆</text><text x="450" y="530" text-anchor="middle" fill="white" font-family="Arial" font-size="68" font-weight="bold">{name[:24]}</text><text x="450" y="630" text-anchor="middle" fill="#facc15" font-family="Arial" font-size="34" letter-spacing="7">DIAMONDS • FAST DELIVERY</text><text x="450" y="720" text-anchor="middle" fill="white" font-family="Arial" font-size="30">OFFICIAL GAME RECHARGE</text></svg>'
    return "data:image/svg+xml," + quote(svg)


def _provider_dict(provider):
    return {"id": provider.id, "name": provider.name, "catalog_url": provider.catalog_url,
            "auth_header": provider.auth_header, "api_key_configured": bool(provider.api_key_encrypted),
            "last_imported_at": provider.last_imported_at.isoformat() if provider.last_imported_at else None,
            "created_at": provider.created_at.isoformat() if provider.created_at else None}


@router.get("/providers")
def list_providers(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    return [_provider_dict(p) for p in db.query(models.ProviderConnection).order_by(models.ProviderConnection.id.desc()).all()]


@router.post("/providers")
def create_provider(data: schemas.ProviderCreate, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    provider = models.ProviderConnection(name=data.name.strip(), catalog_url=_safe_https_url(data.catalog_url),
                                         auth_header=(data.auth_header or "Authorization").strip() or "Authorization")
    if data.api_key:
        provider.set_api_key(data.api_key)
    db.add(provider)
    log_activity(db, "create_provider", f"Admin added provider '{provider.name}'", user=admin)
    db.commit()
    db.refresh(provider)
    return _provider_dict(provider)


@router.put("/providers/{provider_id}")
def update_provider_key(provider_id: int, data: schemas.ProviderUpdate, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    """Rotate a provider key without creating duplicate provider records."""
    provider = db.get(models.ProviderConnection, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    provider.set_api_key(data.api_key.strip())
    provider.auth_header = data.auth_header.strip() or "X-API-Key"
    log_activity(db, "rotate_provider_key", f"Admin updated API key for '{provider.name}'", user=admin)
    db.commit()
    return _provider_dict(provider)


@router.post("/providers/{provider_id}/refresh")
def refresh_catalog(provider_id: int, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    provider = db.get(models.ProviderConnection, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    headers = {"Accept": "application/json", "User-Agent": "RovistarProviderCatalog/1.0"}
    if provider.api_key:
        headers[provider.auth_header or "Authorization"] = provider.api_key
    try:
        response = httpx.get(_safe_https_url(provider.catalog_url), headers=headers, timeout=12, follow_redirects=False)
        response.raise_for_status()
        rows = _catalog_rows(response.json())
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Provider catalog could not be loaded: {str(exc)[:180]}")
    normalized = [record for row in rows if (record := _normalize(row))]
    existing = {item.external_id: item for item in db.query(models.ProviderCatalogItem).filter(models.ProviderCatalogItem.provider_id == provider.id).all()}
    for record in normalized:
        item = existing.get(record["external_id"])
        if not item:
            item = models.ProviderCatalogItem(provider_id=provider.id, external_id=record["external_id"])
            db.add(item)
        item.name, item.description, item.cost_price, item.image, item.raw_json = record["name"], record["description"], record["price"], record["image"], models.JSONText.dumps(record["raw"])
    from datetime import datetime
    provider.last_imported_at = datetime.utcnow()
    log_activity(db, "refresh_provider_catalog", f"Imported {len(normalized)} catalog items from '{provider.name}'", user=admin)
    db.commit()
    return {"provider": _provider_dict(provider), "total_games": len(normalized), "items": [record for record in normalized]}


@router.get("/providers/{provider_id}/items")
def list_provider_items(provider_id: int, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    provider = db.get(models.ProviderConnection, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return [{"id": item.id, "external_id": item.external_id, "name": item.name, "description": item.description,
             "cost_price": item.cost_price, "image": item.image} for item in db.query(models.ProviderCatalogItem).filter(models.ProviderCatalogItem.provider_id == provider_id).order_by(models.ProviderCatalogItem.name).all()]


@router.get("/products/{product_id}/verify")
def verify_product_account(product_id: int, player_id: str, server_id: str = "", db: Session = Depends(get_db)):
    product = db.get(models.Product, product_id)
    metadata = models.JSONText.loads(product.metadata_json, {}) if product else {}
    provider, game_slug = _verification_provider(db, metadata) if product else (None, "")
    # Verification-only manual services use the same documented provider lookup,
    # but must never trigger a provider order after payment.
    if not product or not provider or not game_slug:
        raise HTTPException(status_code=404, detail="Game verification is not available")
    try:
        result = provider_service.verify_player(provider, game_slug, player_id.strip(), server_id.strip())
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=400, detail=f"Verification failed: {str(exc)[:120]}")
    return result


@router.post("/import")
def import_selected_products(data: schemas.ProviderImportRequest, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    shop = db.get(models.Shop, data.shop_id)
    provider = db.get(models.ProviderConnection, data.provider_id)
    if not shop or not provider:
        raise HTTPException(status_code=404, detail="Shop or provider not found")
    selected = db.query(models.ProviderCatalogItem).filter(models.ProviderCatalogItem.provider_id == provider.id, models.ProviderCatalogItem.id.in_(data.item_ids)).all()
    if not selected:
        raise HTTPException(status_code=400, detail="Select at least one imported game")
    if data.margin_percent < 0 or data.margin_percent > 1000:
        raise HTTPException(status_code=400, detail="Margin must be between 0 and 1000 percent")
    # One storefront product per game; its variations are the selectable top-up packages.
    groups = {}
    for item in selected:
        raw = models.JSONText.loads(item.raw_json, {})
        groups.setdefault(raw.get("game_slug") or item.name, []).append((item, raw))
    created = []
    for game_slug, entries in groups.items():
        first_item, first_raw = entries[0]
        game_name = first_item.name.split(" - ", 1)[0]
        variations = []
        for item, raw in entries:
            price = round(float(item.cost_price or 0) * (1 + data.margin_percent / 100), 2)
            package_name = item.name.split(" - ", 1)[-1]
            variations.append({"attrs": {"Top Up": package_name}, "price": price, "quantity": 999999, "provider_package_id": raw.get("package_id")})
        product = models.Product(shop_id=shop.id, name=game_name, description=f"{game_name} top up", price=variations[0]["price"], quantity=999999,
                                 images=models.JSONText.dumps([first_item.image or _game_cover(game_name, game_slug)]), variations=models.JSONText.dumps(variations),
                                 metadata_json=models.JSONText.dumps({"product_type": "digital", "fulfillment_type": "manual_service", "service_platform": _service_platform(game_slug), "provider_id": provider.id, "provider_game_slug": game_slug, "provider_id_label": first_raw.get("id_label", "Player ID"), "provider_server_label": first_raw.get("server_label"), "provider_margin_percent": data.margin_percent, "provider_fulfillment_enabled": provider_service.is_khmer_topup(provider), "provider_notice": "Automatic verified fulfillment via Khmer TopUp"}))
        db.add(product)
        created.append({"name": game_name, "packages": len(variations)})
    log_activity(db, "import_provider_products", f"Admin imported {len(created)} provider products to {shop.username}", shop.id, admin)
    db.commit()
    return {"created": created, "count": len(created), "fulfillment_enabled": provider_service.is_khmer_topup(provider)}
