"""Platform & shop settings endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
import schemas
from config import config as platform_config
from database import get_db
from security import (get_current_admin, get_current_user, require_shop_access,
                      encrypt_secret, decrypt_secret, mask_secret)

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _get_setting(db, shop_id, key):
    q = db.query(models.Setting)
    if shop_id is None:
        q = q.filter(models.Setting.shop_id.is_(None))
    else:
        q = q.filter(models.Setting.shop_id == shop_id)
    return q.filter(models.Setting.key == key).first()


@router.get("")
def list_settings(shop_id: int = None, db: Session = Depends(get_db),
                  user: models.User = Depends(get_current_user)):
    """List settings. shop_id omitted => platform settings (admin only)."""
    if shop_id is None and user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    if shop_id is not None:
        require_shop_access(shop_id, user)
        q = db.query(models.Setting).filter(models.Setting.shop_id == shop_id)
    else:
        q = db.query(models.Setting).filter(models.Setting.shop_id.is_(None))
    return [s.to_dict() for s in q.all()]


@router.post("")
def update_setting(data: schemas.SettingUpdate, db: Session = Depends(get_db),
                   user: models.User = Depends(get_current_user)):
    if data.shop_id is None and user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    if data.shop_id is not None:
        require_shop_access(data.shop_id, user)

    setting = _get_setting(db, data.shop_id, data.key)
    import json
    value_str = json.dumps(data.value) if isinstance(data.value, (dict, list, bool)) else str(data.value)
    if setting:
        setting.value = value_str
    else:
        setting = models.Setting(shop_id=data.shop_id, key=data.key, value=value_str)
        db.add(setting)
    db.commit()
    return setting.to_dict()


@router.get("/platform")
def get_platform_settings(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    """Admin: aggregated platform settings as a convenient JSON object."""
    settings = db.query(models.Setting).filter(models.Setting.shop_id.is_(None)).all()
    result = {}
    for s in settings:
        val = s.value
        try:
            import json
            result[s.key] = json.loads(val) if val.startswith(("{", "[")) else val
        except Exception:
            result[s.key] = val
    result["default_admin"] = "admin"
    result["contact_telegram"] = "@your_telegram"
    return result


@router.get("/stats")
def platform_stats(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    """Admin platform statistics."""
    shops = db.query(models.Shop).count()
    active_shops = db.query(models.Shop).filter(models.Shop.status == "active").count()
    products = db.query(models.Product).count()
    orders = db.query(models.Order).count()
    paid_orders = db.query(models.Order).filter(models.Order.payment_status == "paid").all()
    revenue = round(sum(o.total for o in paid_orders), 2)
    customers = db.query(models.Customer).count()
    users = db.query(models.User).count()
    resellers = db.query(models.User).filter(models.User.role == "reseller").count()
    return {
        "shops": shops, "active_shops": active_shops, "products": products,
        "orders": orders, "revenue": revenue, "customers": customers, "users": users,
        "resellers": resellers,
    }


# --- KHQRPay admin-managed API key + webhook secret ---
# Stored encrypted at rest (Fernet) in the `settings` table at platform level.
# Admins can rotate keys without touching Render environment variables, which
# matters for operators who swap KHQRPay accounts frequently.

_KHQRPAY_SECRET_KEY_DB = "khqrpay_secret_key"
_KHQRPAY_WEBHOOK_SECRET_DB = "khqrpay_webhook_secret"
_KHQRPAY_BASE_URL_DB = "khqrpay_base_url"


class KHQRPayKeyUpdate(BaseModel):
    secret_key: str = ""
    webhook_secret: str = ""
    base_url: str = ""  # optional override; empty string keeps the default


def _platform_setting(db: Session, key: str) -> models.Setting:
    return (
        db.query(models.Setting)
        .filter(models.Setting.shop_id.is_(None))
        .filter(models.Setting.key == key)
        .first()
    )


def _upsert_encrypted(db: Session, key: str, plaintext: str) -> None:
    setting = _platform_setting(db, key)
    token = encrypt_secret(plaintext or "")
    if setting:
        setting.value = token
    else:
        db.add(models.Setting(shop_id=None, key=key, value=token))


def _upsert_plain(db: Session, key: str, value: str) -> None:
    setting = _platform_setting(db, key)
    val = (value or "").strip()
    if setting:
        setting.value = val
    else:
        db.add(models.Setting(shop_id=None, key=key, value=val))


def _read_encrypted(db: Session, key: str) -> str:
    setting = _platform_setting(db, key)
    return decrypt_secret(setting.value) if setting else ""


def _read_plain(db: Session, key: str) -> str:
    setting = _platform_setting(db, key)
    return (setting.value or "").strip() if setting else ""


@router.get("/khqrpay")
def get_khqrpay_keys(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    """Admin: return masked KHQRPay credentials and a configured flag.

    Never returns plaintext secrets. `configured` is true when both the API secret
    and the webhook secret are present (DB or environment fallback).
    """
    secret = _read_encrypted(db, _KHQRPAY_SECRET_KEY_DB) or (platform_config.KHQRPAY_SECRET_KEY or "")
    webhook = _read_encrypted(db, _KHQRPAY_WEBHOOK_SECRET_DB) or (platform_config.KHQRPAY_WEBHOOK_SECRET or "")
    base_url = _read_plain(db, _KHQRPAY_BASE_URL_DB) or (platform_config.KHQRPAY_BASE_URL or "")
    secret_source = "database" if _read_encrypted(db, _KHQRPAY_SECRET_KEY_DB) else ("environment" if platform_config.KHQRPAY_SECRET_KEY else "none")
    return {
        "secret_key": mask_secret(secret),
        "secret_key_source": secret_source,
        "webhook_secret": mask_secret(webhook),
        "base_url": base_url or "",
        "configured": bool((secret or "").strip() and (webhook or "").strip()),
    }


@router.put("/khqrpay")
def update_khqrpay_keys(payload: KHQRPayKeyUpdate, db: Session = Depends(get_db),
                        admin: models.User = Depends(get_current_admin)):
    """Admin: rotate one or more KHQRPay credentials.

    An empty/blank field is skipped (not cleared) so a partial update does not
    wipe a key the admin did not intend to change. Send a single space to clear.
    """
    if payload.secret_key and payload.secret_key.strip():
        _upsert_encrypted(db, _KHQRPAY_SECRET_KEY_DB, payload.secret_key.strip())
    if payload.webhook_secret and payload.webhook_secret.strip():
        _upsert_encrypted(db, _KHQRPAY_WEBHOOK_SECRET_DB, payload.webhook_secret.strip())
    if payload.base_url is not None and payload.base_url.strip():
        _upsert_plain(db, _KHQRPAY_BASE_URL_DB, payload.base_url.strip())
    db.commit()
    return {"ok": True}


@router.post("/khqrpay/reveal")
def reveal_khqrpay_keys(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    """Admin: return plaintext KHQRPay credentials (explicit 'View' action)."""
    secret = _read_encrypted(db, _KHQRPAY_SECRET_KEY_DB) or (platform_config.KHQRPAY_SECRET_KEY or "")
    webhook = _read_encrypted(db, _KHQRPAY_WEBHOOK_SECRET_DB) or (platform_config.KHQRPAY_WEBHOOK_SECRET or "")
    base_url = _read_plain(db, _KHQRPAY_BASE_URL_DB) or (platform_config.KHQRPAY_BASE_URL or "")
    return {
        "secret_key": secret,
        "webhook_secret": webhook,
        "base_url": base_url or "",
        "configured": bool((secret or "").strip() and (webhook or "").strip()),
    }
