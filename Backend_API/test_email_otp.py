import uuid

from fastapi.testclient import TestClient

from database import SessionLocal
from main import app
import models


client = TestClient(app)

def _ensure_shop():
    db = SessionLocal()
    try:
        username = f"otpshop_{uuid.uuid4().hex[:8]}"
        shop = db.query(models.Shop).filter(models.Shop.username == username).first()
        if not shop:
            shop = models.Shop(username=username, shop_name="OTP Shop", status="active")
            db.add(shop)
            db.commit()
            db.refresh(shop)
        return shop.id
    finally:
        db.close()


def test_email_otp_flow(monkeypatch):
    monkeypatch.setattr("routers.auth._send_email_code", lambda email, code: True)

    shop_id = _ensure_shop()

    request = client.post("/api/auth/email/request-code", json={
        "shop_id": shop_id,
        "email": "customer@example.com",
    })
    assert request.status_code == 200, request.text
    data = request.json()
    assert data["ok"] is True
    assert "code" in data

    verify = client.post("/api/auth/email/verify-code", json={
        "shop_id": shop_id,
        "email": "customer@example.com",
        "code": data["code"],
    })
    assert verify.status_code == 200, verify.text
    body = verify.json()
    assert body["verified"] is True
