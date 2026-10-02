"""Rovistar-only important-information feed and customer engagement endpoints."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from database import get_db
from security import get_current_admin, get_current_customer

router = APIRouter(prefix="/api/announcements", tags=["announcements"])
ROVISTAR_USERNAME = "rovistar"


def _rovistar(db):
    shop = db.query(models.Shop).filter(models.Shop.username == ROVISTAR_USERNAME).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Rovistar shop not found")
    return shop


def _require_customer_shop(customer, shop):
    if customer.shop_id != shop.id:
        raise HTTPException(status_code=403, detail="This account belongs to another shop")


@router.get("/public")
def public_announcements(db: Session = Depends(get_db)):
    shop = _rovistar(db)
    return [item.to_dict() for item in db.query(models.Announcement).filter(
        models.Announcement.shop_id == shop.id, models.Announcement.published.is_(True)
    ).order_by(models.Announcement.created_at.desc()).all()]


@router.get("/admin")
def admin_announcements(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    shop = _rovistar(db)
    return [item.to_dict() for item in db.query(models.Announcement).filter(
        models.Announcement.shop_id == shop.id
    ).order_by(models.Announcement.created_at.desc()).all()]


@router.post("/admin")
def create_announcement(data: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    shop = _rovistar(db)
    title = str(data.get("title") or "").strip()
    content = str(data.get("content") or "").strip()
    if not title or not content:
        raise HTTPException(status_code=400, detail="Title and content are required")
    item = models.Announcement(shop_id=shop.id, title=title, content=content,
                               image_url=str(data.get("image_url") or "").strip(),
                               video_url=str(data.get("video_url") or "").strip(),
                               published=bool(data.get("published", True)))
    db.add(item)
    db.commit()
    db.refresh(item)
    return item.to_dict()


@router.put("/admin/{announcement_id}")
def update_announcement(announcement_id: int, data: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    shop = _rovistar(db)
    item = db.query(models.Announcement).filter(models.Announcement.id == announcement_id, models.Announcement.shop_id == shop.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Information post not found")
    for field in ("title", "content", "image_url", "video_url", "published"):
        if field in data:
            setattr(item, field, bool(data[field]) if field == "published" else str(data[field]).strip())
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return item.to_dict()


@router.delete("/admin/{announcement_id}")
def delete_announcement(announcement_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    shop = _rovistar(db)
    item = db.query(models.Announcement).filter(models.Announcement.id == announcement_id, models.Announcement.shop_id == shop.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Information post not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.post("/{announcement_id}/like")
def toggle_like(announcement_id: int, db: Session = Depends(get_db), customer=Depends(get_current_customer)):
    shop = _rovistar(db); _require_customer_shop(customer, shop)
    item = db.get(models.Announcement, announcement_id)
    if not item or item.shop_id != shop.id or not item.published:
        raise HTTPException(status_code=404, detail="Information post not found")
    row = db.query(models.AnnouncementLike).filter_by(announcement_id=item.id, customer_id=customer.id).first()
    if row: db.delete(row); liked = False
    else: db.add(models.AnnouncementLike(announcement_id=item.id, customer_id=customer.id)); liked = True
    db.commit()
    return {"liked": liked, "likes": db.query(models.AnnouncementLike).filter_by(announcement_id=item.id).count()}


@router.post("/{announcement_id}/save")
def toggle_save(announcement_id: int, db: Session = Depends(get_db), customer=Depends(get_current_customer)):
    shop = _rovistar(db); _require_customer_shop(customer, shop)
    item = db.get(models.Announcement, announcement_id)
    if not item or item.shop_id != shop.id or not item.published:
        raise HTTPException(status_code=404, detail="Information post not found")
    row = db.query(models.AnnouncementSave).filter_by(announcement_id=item.id, customer_id=customer.id).first()
    if row: db.delete(row); saved = False
    else: db.add(models.AnnouncementSave(announcement_id=item.id, customer_id=customer.id)); saved = True
    db.commit()
    return {"saved": saved}


@router.post("/{announcement_id}/comments")
def add_comment(announcement_id: int, data: dict, db: Session = Depends(get_db), customer=Depends(get_current_customer)):
    shop = _rovistar(db); _require_customer_shop(customer, shop)
    text = str(data.get("content") or "").strip()
    if not text: raise HTTPException(status_code=400, detail="Comment cannot be empty")
    item = db.get(models.Announcement, announcement_id)
    if not item or item.shop_id != shop.id or not item.published: raise HTTPException(status_code=404, detail="Information post not found")
    row = models.AnnouncementComment(announcement_id=item.id, customer_id=customer.id, content=text)
    db.add(row); db.commit(); db.refresh(row)
    return row.to_dict()


@router.get("/saved/me")
def saved_announcements(db: Session = Depends(get_db), customer=Depends(get_current_customer)):
    shop = _rovistar(db); _require_customer_shop(customer, shop)
    rows = db.query(models.AnnouncementSave).filter_by(customer_id=customer.id).order_by(models.AnnouncementSave.created_at.desc()).all()
    return [row.announcement.to_dict(customer_id=customer.id) for row in rows if row.announcement and row.announcement.published]
