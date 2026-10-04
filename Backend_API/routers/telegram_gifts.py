"""Telegram collectible gift queue for shop owners.

The public t.me/nft page is used only to preview a gift's public metadata. It
cannot prove wallet ownership or transferability, so publishing stays an owner
approval step.
"""
import re
from datetime import datetime
from html import unescape
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import models
from database import get_db
from security import get_current_user, require_shop_access

router = APIRouter(prefix="/api/telegram-gifts", tags=["telegram-gifts"])
GIFT_RE = re.compile(r"^https?://(?:www\.)?t\.me/nft/([A-Za-z][A-Za-z0-9]*)-(\d+)/?$", re.I)
META_RE = re.compile(r'<meta[^>]+(?:property|name)=["\']([^"\']+)["\'][^>]+content=["\']([^"\']*)["\']', re.I)


class GiftQueueCreate(BaseModel):
    shop_id: int
    url: str = Field(min_length=15, max_length=2048)
    price: float = Field(gt=0, le=1000000)
    name: str = Field(default="", max_length=160)


class GiftPublish(BaseModel):
    price: float = Field(gt=0, le=1000000)
    name: str = Field(default="", max_length=160)
    description: str = Field(default="", max_length=2000)


def _parse_url(url: str):
    match = GIFT_RE.match(url.strip())
    if not match:
        raise HTTPException(status_code=400, detail="Use a Telegram collectible link like https://t.me/nft/ChillFlame-13081")
    collection, number = match.groups()
    return collection, int(number), f"https://t.me/nft/{collection}-{number}"


def _public_preview(canonical_url: str, collection: str, number: int):
    """Read public Open Graph fields; never access a Telegram account or wallet."""
    try:
        request = Request(canonical_url, headers={"User-Agent": "RovistarGiftQueue/1.0"})
        with urlopen(request, timeout=12) as response:
            html = response.read(300000).decode("utf-8", errors="replace")
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Telegram gift page could not be checked. Try again shortly.") from exc

    meta = {key.lower(): unescape(value).strip() for key, value in META_RE.findall(html)}
    title = meta.get("og:title") or f"{collection} #{number}"
    image_url = meta.get("og:image", "")
    description = meta.get("og:description", "")
    if not image_url:
        raise HTTPException(status_code=404, detail="Telegram did not return a public collectible preview for this link")
    return {"canonical_url": canonical_url, "collection": collection, "gift_number": number,
            "title": title, "image_url": image_url, "description": description}


def _queue_dict(entry):
    return {
        "id": entry.id, "shop_id": entry.shop_id, "canonical_url": entry.canonical_url,
        "collection": entry.collection, "gift_number": entry.gift_number, "title": entry.title,
        "image_url": entry.image_url, "description": entry.description, "price": entry.price,
        "status": entry.status, "product_id": entry.product_id,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }


@router.post("/preview")
def preview_gift(data: GiftQueueCreate, user: models.User = Depends(get_current_user)):
    require_shop_access(data.shop_id, user)
    collection, number, canonical_url = _parse_url(data.url)
    return _public_preview(canonical_url, collection, number)


@router.post("/queue")
def queue_gift(data: GiftQueueCreate, db: Session = Depends(get_db),
               user: models.User = Depends(get_current_user)):
    require_shop_access(data.shop_id, user)
    collection, number, canonical_url = _parse_url(data.url)
    existing = db.query(models.TelegramGiftQueue).filter(
        models.TelegramGiftQueue.shop_id == data.shop_id,
        models.TelegramGiftQueue.canonical_url == canonical_url,
    ).first()
    if existing:
        return _queue_dict(existing)
    preview = _public_preview(canonical_url, collection, number)
    entry = models.TelegramGiftQueue(
        shop_id=data.shop_id, canonical_url=canonical_url, collection=collection,
        gift_number=number, title=(data.name.strip() or preview["title"]),
        image_url=preview["image_url"], description=preview["description"],
        price=data.price, status="queued",
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _queue_dict(entry)


@router.get("/queue")
def list_queue(shop_id: int = Query(...), db: Session = Depends(get_db),
               user: models.User = Depends(get_current_user)):
    require_shop_access(shop_id, user)
    entries = (db.query(models.TelegramGiftQueue)
               .filter(models.TelegramGiftQueue.shop_id == shop_id)
               .order_by(models.TelegramGiftQueue.created_at.desc()).all())
    return [_queue_dict(entry) for entry in entries]


@router.post("/queue/{entry_id}/publish")
def publish_gift(entry_id: int, data: GiftPublish, db: Session = Depends(get_db),
                 user: models.User = Depends(get_current_user)):
    entry = db.query(models.TelegramGiftQueue).filter(models.TelegramGiftQueue.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Gift queue entry not found")
    require_shop_access(entry.shop_id, user)
    if entry.status == "published":
        raise HTTPException(status_code=409, detail="This gift is already published")

    product = models.Product(
        shop_id=entry.shop_id, name=data.name.strip() or entry.title,
        description=data.description.strip() or entry.description,
        price=data.price, quantity=1, images=models.JSONText.dumps([entry.image_url]),
        metadata_json=models.JSONText.dumps({
            "product_type": "telegram_gift", "fulfillment_type": "telegram_gift",
            "telegram_gift": {"canonical_url": entry.canonical_url, "collection": entry.collection,
                              "gift_number": entry.gift_number, "queue_id": entry.id},
        }), status="active",
    )
    db.add(product)
    db.flush()
    entry.product_id = product.id
    entry.price = data.price
    entry.status = "published"
    db.commit()
    db.refresh(entry)
    return {"queue": _queue_dict(entry), "product": product.to_dict(include_private=True)}
