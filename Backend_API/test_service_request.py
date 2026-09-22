import uuid

from fastapi.testclient import TestClient

from database import SessionLocal
from main import app
import models
from security import create_access_token


client = TestClient(app)


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
