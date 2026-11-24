"""Security helpers: password hashing, JWT tokens, current-user dependencies."""
import base64
import hashlib
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

import models
from config import config
from database import get_db


# --- Symmetric encryption for admin-managed secrets stored in the database ---
# The platform SECRET_KEY is stretched into a 32-byte Fernet key so secrets can
# be stored encrypted at rest and decrypted only on the server.
_fernet = None


def _fernet_instance() -> Fernet:
    global _fernet
    if _fernet is None:
        digest = hashlib.sha256((config.SECRET_KEY or "fallback").encode("utf-8")).digest()
        _fernet = Fernet(base64.urlsafe_b64encode(digest))
    return _fernet


def encrypt_secret(plaintext: str) -> str:
    """Encrypt a secret value for storage in the database. Returns a token string."""
    if plaintext is None:
        return ""
    token = _fernet_instance().encrypt((plaintext or "").encode("utf-8"))
    return token.decode("ascii")


def decrypt_secret(token: str) -> str:
    """Decrypt a stored secret. Returns '' for missing/empty values."""
    if not token:
        return ""
    try:
        return _fernet_instance().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        return ""


def mask_secret(value: str, visible_tail: int = 4) -> str:
    """Return a masked representation, e.g. kp_live_••••c9b7."""
    if not value:
        return ""
    if len(value) <= visible_tail:
        return "•" * visible_tail
    prefix = ""
    # Preserve common live/test prefixes so the admin can tell env apart.
    for p in ("kp_live_", "kp_test_", "sk_live_", "sk_test_"):
        if value.startswith(p):
            prefix, value = p, value[len(p):]
            break
    keep = value[-visible_tail:]
    masked = "•" * max(4, min(20, len(value) - visible_tail))
    return f"{prefix}{masked}{keep}"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, config.SECRET_KEY, algorithm=config.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    payload = decode_token(token)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="Your account has been suspended")
    return user


def get_current_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user


def get_current_shop_user(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role not in ("shop_owner", "staff"):
        raise HTTPException(status_code=403, detail="Shop account required")
    return user


def get_optional_customer(token: str = Depends(OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)), db: Session = Depends(get_db)) -> Optional[models.Customer]:
    """Return a customer when logged in, but allow guest digital checkout."""
    if not token:
        return None
    try:
        return get_current_customer(token, db)
    except HTTPException:
        return None


def get_current_customer(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.Customer:
    """Customer JWT dependency — used to require Telegram login before checkout."""
    payload = decode_token(token)
    if payload.get("role") != "customer":
        raise HTTPException(status_code=401, detail="Please login with Telegram to continue")
    customer_id = payload.get("sub")
    if customer_id is None:
        raise HTTPException(status_code=401, detail="Invalid customer token")
    customer = db.query(models.Customer).filter(models.Customer.id == int(customer_id)).first()
    if not customer:
        raise HTTPException(status_code=401, detail="Customer not found")
    return customer


def require_shop_access(shop_id: int, user: models.User) -> None:
    """Admin can access any shop; shop users only their own shop."""
    if user.role == "admin":
        return
    if user.shop_id != shop_id:
        raise HTTPException(status_code=403, detail="You do not have access to this shop")


def log_activity(db: Session, action: str, description: str, shop_id: Optional[int] = None,
                 user: Optional[models.User] = None) -> None:
    db.add(models.ActivityLog(
        shop_id=shop_id,
        user_id=user.id if user else None,
        username=user.username if user else "system",
        action=action,
        description=description,
    ))
