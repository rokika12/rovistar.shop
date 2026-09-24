import uuid

from fastapi.testclient import TestClient

import models
from config import config
from database import SessionLocal
from main import app
from security import create_access_token
from services import telegram_service


client = TestClient(app)


def _create_shop_owner(settings):
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:8]
    shop = models.Shop(
        username=f"telegram_{suffix}",
        shop_name="Telegram Test Shop",
        status="active",
        telegram_settings=models.JSONText.dumps(settings),
    )
    db.add(shop)
    db.flush()
    owner = models.User(
        username=f"telegram_owner_{suffix}",
        password_hash="unused",
        role="shop_owner",
        status="active",
        shop_id=shop.id,
    )
    db.add(owner)
    db.commit()
    shop_id = shop.id
    owner_id = owner.id
    db.close()
    token = create_access_token({"sub": str(owner_id), "role": "shop_owner"})
    return shop_id, {"Authorization": f"Bearer {token}"}


def test_notification_helpers_broadcast_to_new_legacy_admin_and_linked_recipients(monkeypatch):
    class Shop:
        shop_name = "Broadcast Shop"
        username = "broadcast"

        @staticmethod
        def telegram_dict():
            return {
                "bot_token": "secret-token",
                "chat_ids": ["100", "200", "100"],
                "chat_id": "300",
                "admin_chat_ids": ["200", "350", "350"],
                "linked_chats": [200, "400"],
                "enabled": True,
            }

    class Order:
        order_number = "ORDER-1"
        customer_name = "Customer"

    sent = []
    monkeypatch.setattr(
        telegram_service,
        "send_telegram_message",
        lambda token, chat_id, text: sent.append((token, chat_id, text)) or True,
    )

    assert telegram_service.notify_shop_payment_success(
        Shop(), "ORDER-1", 10, "USD", "Customer"
    ) is True
    assert [chat_id for _, chat_id, _ in sent] == ["100", "200", "300", "350", "400"]

    sent.clear()
    assert telegram_service.notify_shop_service_request(
        Shop(), Order(), "https://example.com/manual-request"
    ) is True
    assert [chat_id for _, chat_id, _ in sent] == ["100", "200", "300", "350", "400"]


def test_test_and_save_validates_bot_tests_every_recipient_and_hides_token(monkeypatch):
    shop_id, headers = _create_shop_owner({
        "bot_token": "old-secret-token",
        "chat_id": "111",
        "enabled": False,
        "linked_chats": ["333"],
        "profile_id": "PROFILE",
        "secret_key": "LINK-SECRET",
    })
    sent = []
    monkeypatch.setattr(
        telegram_service,
        "validate_bot_token",
        lambda token: {"ok": True, "username": "verified_bot", "bot_id": 1},
    )
    monkeypatch.setattr(
        telegram_service,
        "send_telegram_message",
        lambda token, chat_id, text: sent.append((token, chat_id)) or True,
    )

    response = client.post(
        "/api/telegram/settings/test-and-save",
        json={
            "shop_id": shop_id,
            "bot_token": "new-secret-token",
            "chat_ids": ["111", "222", "111"],
            "enabled": True,
        },
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["chat_ids"] == ["111", "222"]
    assert body["tested_chat_ids"] == ["111", "222", "333"]
    assert "bot_token" not in body
    assert sent == [
        ("new-secret-token", "111"),
        ("new-secret-token", "222"),
        ("new-secret-token", "333"),
    ]

    db = SessionLocal()
    try:
        saved = db.query(models.Shop).filter(models.Shop.id == shop_id).first().telegram_dict()
        assert saved["bot_token"] == "new-secret-token"
        assert saved["chat_ids"] == ["111", "222"]
        assert saved["chat_id"] == "111"
        assert saved["linked_chats"] == ["333"]
        assert saved["profile_id"] == "PROFILE"
    finally:
        db.close()

    settings_response = client.get(
        "/api/telegram/settings", params={"shop_id": shop_id}, headers=headers
    )
    assert settings_response.status_code == 200, settings_response.text
    assert "bot_token" not in settings_response.json()
    assert settings_response.json()["bot_token_configured"] is True

    shop_response = client.get(f"/api/shops/{shop_id}/detail", headers=headers)
    assert shop_response.status_code == 200, shop_response.text
    exposed_settings = shop_response.json()["telegram_settings"]
    assert "bot_token" not in exposed_settings
    assert exposed_settings["bot_token_configured"] is True


def test_failed_recipient_test_does_not_save_proposed_settings(monkeypatch):
    original = {
        "bot_token": "existing-secret-token",
        "chat_id": "100",
        "chat_ids": ["100"],
        "admin_chat_ids": ["200"],
        "enabled": False,
        "linked_chats": [],
    }
    shop_id, headers = _create_shop_owner(original)
    monkeypatch.setattr(
        telegram_service,
        "validate_bot_token",
        lambda token: {"ok": True, "username": "verified_bot", "bot_id": 1},
    )
    monkeypatch.setattr(
        telegram_service,
        "send_telegram_message",
        lambda token, chat_id, text: chat_id != "200",
    )

    response = client.post(
        "/api/telegram/settings/test-and-save",
        json={
            "shop_id": shop_id,
            "bot_token": "proposed-secret-token",
            "chat_ids": ["100", "200"],
            "enabled": True,
        },
        headers=headers,
    )
    assert response.status_code == 400, response.text
    assert "Settings were not saved" in response.json()["detail"]

    db = SessionLocal()
    try:
        saved = db.query(models.Shop).filter(models.Shop.id == shop_id).first().telegram_dict()
        assert saved == original
    finally:
        db.close()


def test_legacy_shop_update_preserves_hidden_token_and_linked_chats(monkeypatch):
    shop_id, headers = _create_shop_owner({
        "bot_token": "existing-secret-token",
        "chat_id": "100",
        "enabled": False,
        "linked_chats": ["300"],
        "profile_id": "PROFILE",
    })

    response = client.put(
        f"/api/shops/{shop_id}/update",
        json={"telegram_settings": {"bot_token": "", "chat_id": "200", "enabled": True}},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    response_settings = response.json()["telegram_settings"]
    assert "bot_token" not in response_settings
    assert response_settings["bot_token_configured"] is True

    db = SessionLocal()
    try:
        saved = db.query(models.Shop).filter(models.Shop.id == shop_id).first().telegram_dict()
        assert saved["bot_token"] == "existing-secret-token"
        assert saved["chat_ids"] == ["200"]
        assert saved["chat_id"] == "200"
        assert saved["linked_chats"] == ["300"]
        assert saved["profile_id"] == "PROFILE"
    finally:
        db.close()


def test_shop_update_keeps_permanent_storefront_username():
    shop_id, headers = _create_shop_owner({})
    db = SessionLocal()
    try:
        original = db.query(models.Shop).filter(models.Shop.id == shop_id).first().username
    finally:
        db.close()

    response = client.put(
        f"/api/shops/{shop_id}/update",
        json={"username": ""},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["username"] == original

    db = SessionLocal()
    try:
        saved = db.query(models.Shop).filter(models.Shop.id == shop_id).first()
        assert saved.username == original
    finally:
        db.close()


def test_telegram_order_buttons_update_storefront_status(monkeypatch):
    webhook_token = f"order-button-{uuid.uuid4().hex}"
    shop_id, _ = _create_shop_owner({"bot_token": webhook_token, "enabled": True, "linked_chats": ["101"]})
    db = SessionLocal()
    try:
        suffix = uuid.uuid4().hex[:8]
        order = models.Order(
            shop_id=shop_id,
            order_number=f"BUTTON-{suffix}",
            customer_name="Customer",
            payment_status="paid",
            order_status="processing",
            total=5,
        )
        db.add(order)
        db.commit()
        order_id = order.id
    finally:
        db.close()

    replies = []
    button_updates = []
    monkeypatch.setattr(telegram_service, "send_telegram_callback_reply", lambda *args: replies.append(args))
    monkeypatch.setattr(telegram_service, "update_telegram_order_buttons", lambda *args: button_updates.append(args))

    shipping = client.post(f"/api/telegram/webhook/{webhook_token}", json={
        "callback_query": {"id": "callback-1", "data": f"order:{order_id}:shipped", "message": {"chat": {"id": 101}, "message_id": 42}},
    })
    assert shipping.status_code == 200, shipping.text
    assert shipping.json()["order_status"] == "shipped"
    assert button_updates[-1][-1] == [[
        {"text": "✅ Marked as shipped", "callback_data": f"order:{order_id}:done"},
        {"text": "✅ Mark delivered", "callback_data": f"order:{order_id}:completed"},
    ]]

    completed = client.post(f"/api/telegram/webhook/{webhook_token}", json={
        "callback_query": {"id": "callback-2", "data": f"order:{order_id}:completed", "message": {"chat": {"id": 101}, "message_id": 42}},
    })
    assert completed.status_code == 200, completed.text
    assert completed.json()["order_status"] == "delivered"
    assert button_updates[-1][-1] == [[{"text": "✅ Order completed", "callback_data": f"order:{order_id}:done"}]]

    completed_again = client.post(f"/api/telegram/webhook/{webhook_token}", json={
        "callback_query": {"id": "callback-3", "data": f"order:{order_id}:done", "message": {"chat": {"id": 101}, "message_id": 42}},
    })
    assert completed_again.status_code == 200, completed_again.text
    assert completed_again.json()["order_status"] == "delivered"

    db = SessionLocal()
    try:
        assert db.query(models.Order).filter(models.Order.id == order_id).first().order_status == "delivered"
    finally:
        db.close()


def test_order_notification_sends_saved_customer_selected_product_image(monkeypatch):
    class Shop:
        @staticmethod
        def telegram_dict():
            return {"enabled": True, "bot_token": "bot-token", "chat_ids": ["101"]}

        shop_name = "Photo Shop"
        username = "photo-shop"

    class Item:
        product_id = 1
        product_name = "Package"
        price = 10
        quantity = 1
        variations = "{}"
        image = "/api/uploads/media/selected-package.png"

    class Order:
        id = 123
        order_number = "PHOTO-1"
        currency = "USD"
        payment_method = "khqr"
        transaction_id = "txn"
        paid_at = None
        items = [Item()]
        items_total = 10
        shipping_fee = 0
        discount = 0
        total = 10
        customer_name = "Customer"
        customer_phone = ""
        customer_email = ""
        customer_telegram = ""
        customer_address = ""
        customer_city = ""
        customer_country = ""
        customer_note = ""
        receipt_url = ""
        order_status = "processing"

    photos = []
    messages = []
    monkeypatch.setattr(telegram_service, "send_telegram_photo", lambda *args: photos.append(args) or True)
    monkeypatch.setattr(telegram_service, "send_telegram_message_with_buttons", lambda *args: messages.append(args) or True)

    assert telegram_service.notify_shop_payment_success_full(Shop(), Order()) is True
    assert photos[0][2] == "http://localhost:8000/api/uploads/media/selected-package.png"
    assert messages[0][-1] == telegram_service.telegram_order_buttons(123, "processing")


def test_order_notification_formats_package_and_delivery_username(monkeypatch):
    class Shop:
        @staticmethod
        def telegram_dict():
            return {"enabled": True, "bot_token": "bot-token", "chat_ids": ["101"]}

        shop_name = "Top Up Shop"
        username = "top-up-shop"

    class Item:
        product_id = 1
        product_name = "Free Fire Top Up"
        price = 5
        quantity = 1
        variations = '{"Package":"520 Diamonds","_service_link":"123456789"}'
        image = ""

    class Order:
        id = 124
        order_number = "TOPUP-1"
        currency = "USD"
        payment_method = "khqr"
        transaction_id = "txn"
        paid_at = None
        items = [Item()]
        items_total = 5
        shipping_fee = 0
        discount = 0
        total = 5
        customer_name = "Customer"
        customer_phone = ""
        customer_email = ""
        customer_telegram = "raw-customer-name"
        customer_address = ""
        customer_city = ""
        customer_country = ""
        customer_note = ""
        receipt_url = ""
        order_status = "processing"

    messages = []
    monkeypatch.setattr(telegram_service, "send_telegram_message_with_buttons", lambda *args: messages.append(args) or True)

    assert telegram_service.notify_shop_payment_success_full(Shop(), Order()) is True
    text = messages[0][2]
    assert "Free Fire Top Up" in text
    assert "Package: 520 Diamonds" in text
    assert "<code>123456789</code>" in text
    assert "_service_link" not in text


def test_worker_order_action_requires_secret_and_updates_only_its_configured_chat(monkeypatch):
    monkeypatch.setattr(config, "BOT_SERVICE_ENABLED", True)
    monkeypatch.setattr(config, "BOT_SERVICE_KEY", "worker-secret")
    shop_id, _ = _create_shop_owner({"bot_token": "bot-token", "enabled": True, "linked_chats": ["101"]})
    db = SessionLocal()
    try:
        order = models.Order(
            shop_id=shop_id, order_number=f"WORKER-{uuid.uuid4().hex[:8]}",
            customer_name="Customer", payment_status="paid", order_status="processing", total=5,
        )
        db.add(order)
        db.commit()
        order_id = order.id
    finally:
        db.close()

    payload = {"shop_id": shop_id, "data": f"order:{order_id}:shipped", "chat_id": 101}
    assert client.post("/api/bot-service/order-action", json=payload).status_code == 403
    response = client.post(
        "/api/bot-service/order-action", json=payload,
        headers={"X-Bot-Service-Key": "worker-secret"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["order_status"] == "shipped"

    blocked = client.post(
        "/api/bot-service/order-action",
        json={**payload, "data": f"order:{order_id}:completed", "chat_id": 999},
        headers={"X-Bot-Service-Key": "worker-secret"},
    )
    assert blocked.status_code == 200
    assert blocked.json()["ok"] is False
