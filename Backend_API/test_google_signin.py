import uuid

from fastapi.testclient import TestClient

from database import SessionLocal
from main import app
import models


client = TestClient(app)


def _create_shop(client_id="test-client.apps.googleusercontent.com"):
    db = SessionLocal()
    try:
        shop = models.Shop(
            username=f"google_{uuid.uuid4().hex[:8]}",
            shop_name="Google Test Shop",
            status="active",
            theme=models.JSONText.dumps({"appearance": {"google_client_id": client_id}}),
        )
        db.add(shop)
        db.commit()
        db.refresh(shop)
        return shop.id
    finally:
        db.close()


def test_google_signin_verifies_shop_client_and_reuses_shop_customer(monkeypatch):
    shop_id = _create_shop()
    calls = []

    def verify(credential, request, audience):
        calls.append((credential, audience))
        return {
            "sub": "google-subject-123",
            "email": "Customer@Example.com",
            "email_verified": True,
            "name": "Google Customer",
        }

    monkeypatch.setattr("routers.customers.id_token.verify_oauth2_token", verify)
    payload = {"shop_id": shop_id, "credential": "credential-long-enough-for-validation"}

    first = client.post("/api/customers/auth/google", json=payload)
    assert first.status_code == 200, first.text
    first_body = first.json()
    assert first_body["token_type"] == "bearer"
    assert first_body["customer"]["shop_id"] == shop_id
    assert first_body["customer"]["email"] == "customer@example.com"
    assert calls == [(payload["credential"], "test-client.apps.googleusercontent.com")]

    second = client.post("/api/customers/auth/google", json=payload)
    assert second.status_code == 200, second.text
    assert second.json()["customer"]["id"] == first_body["customer"]["id"]

    db = SessionLocal()
    try:
        assert db.query(models.Customer).filter(models.Customer.shop_id == shop_id).count() == 1
    finally:
        db.close()


def test_google_signin_rejects_missing_configuration_and_unverified_email(monkeypatch):
    unconfigured_shop_id = _create_shop(client_id="")
    payload = {"shop_id": unconfigured_shop_id, "credential": "credential-long-enough-for-validation"}
    disabled = client.post("/api/customers/auth/google", json=payload)
    assert disabled.status_code == 404

    shop_id = _create_shop()
    monkeypatch.setattr(
        "routers.customers.id_token.verify_oauth2_token",
        lambda credential, request, audience: {
            "sub": "google-subject-456",
            "email": "unverified@example.com",
            "email_verified": False,
        },
    )
    denied = client.post("/api/customers/auth/google", json={**payload, "shop_id": shop_id})
    assert denied.status_code == 401
    assert denied.json()["detail"] == "Google account email is not verified"
