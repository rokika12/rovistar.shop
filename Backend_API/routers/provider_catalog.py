"""Admin-only provider catalog import.

This feature imports only from documented supplier endpoints. It never automates
consumer checkout pages or undocumented provider routes.
"""
import ipaddress
import socket
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
    created = []
    for item in selected:
        price = round(float(item.cost_price or 0) * (1 + data.margin_percent / 100), 2)
        raw = models.JSONText.loads(item.raw_json, {})
        khmer_topup = provider_service.is_khmer_topup(provider)
        product = models.Product(shop_id=shop.id, name=item.name, description=item.description, price=price, quantity=999999,
                                 images=models.JSONText.dumps([item.image] if item.image else []),
                                 metadata_json=models.JSONText.dumps({"product_type": "digital", "fulfillment_type": "manual_service", "service_platform": _service_platform(raw.get("game_slug")), "provider_id": provider.id, "provider_item_id": item.id, "provider_game_slug": raw.get("game_slug", ""), "provider_package_id": raw.get("package_id"), "provider_id_label": raw.get("id_label", "Player ID"), "provider_server_label": raw.get("server_label"), "provider_cost": item.cost_price, "provider_margin_percent": data.margin_percent, "provider_fulfillment_enabled": khmer_topup, "provider_notice": "Automatic verified fulfillment via Khmer TopUp" if khmer_topup else "Catalog imported. Automatic fulfillment requires the supplier's documented order API."}))
        db.add(product)
        created.append({"name": item.name, "selling_price": price})
    log_activity(db, "import_provider_products", f"Admin imported {len(created)} provider products to {shop.username}", shop.id, admin)
    db.commit()
    return {"created": created, "count": len(created), "fulfillment_enabled": provider_service.is_khmer_topup(provider)}
