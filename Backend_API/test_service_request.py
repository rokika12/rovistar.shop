import uuid

import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException

from database import SessionLocal
from main import app
import models
from security import create_access_token
from routers.uploads import _validate_service_video
from services.telegram_service import resolve_public_chat_username


client = TestClient(app)


def test_service_video_validation_allows_small_mp4_only():
    _validate_service_video(b"not-decoded-in-this-route", "guide.mp4", "video/mp4")
    with pytest.raises(HTTPException):
        _validate_service_video(b"bad", "guide.mov", "video/quicktime")


def test_telegram_public_username_check_validates_input_before_calling_api():
    invalid = resolve_public_chat_username("token", "not a username")
    assert invalid["ok"] is False
    assert "valid Telegram username" in invalid["detail"]

    missing_token = resolve_public_chat_username("", "public_group")
    assert missing_token["ok"] is False
    assert "bot token" in missing_token["detail"]


def test_paid_manual_service_request_requires_owner_and_saves_link():
    db = SessionLocal()
    try:
        suffix = uuid.uuid4().hex[:8]
        shop = models.Shop(username=f"service_{suffix}", shop_name="Service Shop", status="active")
        db.add(shop)
        db.flush()
        customer = models.Customer(shop_id=shop.id, name="Customer", phone="012345678")
        db.add(customer)
        db.flush()
        order = models.Order(
            shop_id=shop.id,
            customer_id=customer.id,
            order_number=f"SVC-{suffix}",
            customer_name="Customer",
            payment_status="paid",
            order_status="pending",
            total=3.0,
        )
        db.add(order)
        db.flush()
        db.add(models.OrderItem(
            order_id=order.id,
            product_id=1,
            product_name="TikTok campaign setup",
            price=3.0,
            quantity=1,
            variations=models.JSONText.dumps({"_service_request_required": True}),
        ))
        db.commit()

        token = create_access_token({"sub": str(customer.id), "role": "customer"})
        response = client.post(
            f"/api/orders/{order.id}/service-request",
            json={"link": "https://www.tiktok.com/@creator/video/123", "note": "Please use this video"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["order"]["service_request_submitted"] is True
        assert body["order"]["order_status"] == "processing"

        db.refresh(order)
        assert order.customer_note.startswith("[service-request]\nLink: https://www.tiktok.com/")
    finally:
        db.close()


def test_manual_service_requires_link_before_payment_and_keeps_video_for_receipt():
    db = SessionLocal()
    try:
        suffix = uuid.uuid4().hex[:8]
        shop = models.Shop(username=f"manual_{suffix}", shop_name="Manual Shop", status="active")
        db.add(shop)
        db.flush()
        customer = models.Customer(shop_id=shop.id, name="Customer", phone="012345679")
        product = models.Product(
            shop_id=shop.id,
            name="TikTok campaign setup",
            price=3.0,
            # Manual services have no finite inventory and must remain purchasable at zero stock.
            quantity=0,
            variations=models.JSONText.dumps([{"attrs": {"Package": "Pro"}, "price": 9.0, "quantity": 0}]),
            metadata_json=models.JSONText.dumps({
                "product_type": "digital",
                "fulfillment_type": "manual_service",
                "service_video_url": "/api/uploads/media/guide.mp4",
            }),
        )
        db.add_all([customer, product])
        db.commit()
        db.refresh(customer)
        db.refresh(product)
        token = create_access_token({"sub": str(customer.id), "role": "customer"})
        headers = {"Authorization": f"Bearer {token}"}
        base_order = {
            "shop_id": shop.id,
            "customer_name": "Customer",
            "customer_phone": "digital",
            "customer_telegram": "@customer_service",
            "customer_address": "Digital delivery",
            "customer_city": "Online",
            "customer_country": "Online",
            "payment_method": "khqr",
        }

        missing = client.post("/api/orders", json={
            **base_order,
            "items": [{"product_id": product.id, "name": product.name, "price": 3.0, "quantity": 1, "variations": {"Package": "Pro"}}],
        }, headers=headers)
        assert missing.status_code == 400, missing.text

        created = client.post("/api/orders", json={
            **base_order,
            "items": [{
                "product_id": product.id,
                "name": product.name,
                "price": 3.0,
                "quantity": 1,
                "variations": {"Package": "Pro", "_service_link": "https://www.tiktok.com/@creator/video/123"},
            }],
        }, headers=headers)
        assert created.status_code == 200, created.text
        item = created.json()["items"][0]
        assert item["price"] == 9.0
        assert item["service_video_url"] == "/api/uploads/media/guide.mp4"
        assert "_service_link" not in item["variations"]

        product.metadata_json = models.JSONText.dumps({
            "product_type": "digital",
            "fulfillment_type": "manual_service",
            "manual_service_out_of_stock": True,
        })
        db.commit()
        unavailable = client.post("/api/orders", json={
            **base_order,
            "items": [{
                "product_id": product.id,
                "name": product.name,
                "price": 3.0,
                "quantity": 1,
                "variations": {"Package": "Pro", "_service_link": "https://www.tiktok.com/@creator/video/123"},
            }],
        }, headers=headers)
        assert unavailable.status_code == 400, unavailable.text
        assert unavailable.json()["detail"] == "This manual service is out of stock"
    finally:
        db.close()
