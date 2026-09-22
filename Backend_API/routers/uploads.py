"""Persistent image upload endpoints (logo, banner, product images, slideshow)."""
import mimetypes
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image
from sqlalchemy.orm import Session

from database import get_db
from models import MediaFile
from config import config
from security import get_current_user

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


def _validate_image(content: bytes, filename: str) -> None:
    ext = os.path.splitext(filename)[1].lower()
    if ext not in config.ALLOWED_IMAGE_EXT:
        raise HTTPException(status_code=400, detail=f"Image extension {ext} not allowed")
    if len(content) > config.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 8MB)")
    try:
        image = Image.open(__import__("io").BytesIO(content))
        image.verify()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")


def _save_media(content: bytes, filename: str, db: Session) -> str:
    ext = os.path.splitext(filename)[1].lower()
    media_name = f"{uuid.uuid4().hex}{ext}"
    content_type = mimetypes.guess_type(media_name)[0] or "application/octet-stream"
    db.add(MediaFile(filename=media_name, content_type=content_type, content=content))
    return media_name


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload one image to the persistent database-backed media store."""
    content = await file.read()
    source_name = file.filename or "image.png"
    _validate_image(content, source_name)
    filename = _save_media(content, source_name, db)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not save image")
    return {"url": f"/api/uploads/media/{filename}", "filename": filename}


@router.post("/product")
async def upload_product_images(
    files: list[UploadFile] = File(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload product images in one durable transaction."""
    urls = []
    try:
        for file in files:
            content = await file.read()
            source_name = file.filename or "image.png"
            _validate_image(content, source_name)
            filename = _save_media(content, source_name, db)
            urls.append(f"/api/uploads/media/{filename}")
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not save product images")
    return {"urls": urls}


@router.get("/media/{filename}")
def get_persistent_media(filename: str, db: Session = Depends(get_db)):
    """Serve immutable uploaded images from PostgreSQL/SQLite rather than app disk."""
    media = db.query(MediaFile).filter(MediaFile.filename == filename).first()
    if not media:
        raise HTTPException(status_code=404, detail="Image not found")
    return Response(
        content=media.content,
        media_type=media.content_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
