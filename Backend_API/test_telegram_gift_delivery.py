from types import SimpleNamespace

import models
from services import telegram_service


class Shop:
    @staticmethod
    def telegram_dict():
        return {"enabled": True, "bot_token": "test-token"}


class GiftItem:
    variations = models.JSONText.dumps({
        "_telegram_gift_url": "https://t.me/nft/ChillFlame-13081",
    })


def test_telegram_gift_helpers_accept_only_delivery_safe_values():
    assert telegram_service.normalize_telegram_username(" @gift_buyer ") == "@gift_buyer"
    assert telegram_service.normalize_telegram_username("gift_buyer") == ""
    assert telegram_service.normalize_telegram_username("@bad-name") == ""
    assert telegram_service.canonical_telegram_gift_url(
        "https://t.me/nft/ChillFlame-13081/"
    ) == "https://t.me/nft/ChillFlame-13081"
    assert telegram_service.canonical_telegram_gift_url("https://example.com/gift") == ""


def test_customer_gift_delivery_requires_paid_order_and_uses_order_username(monkeypatch):
    sent = []
    monkeypatch.setattr(
        telegram_service,
        "send_telegram_message",
        lambda token, chat_id, text: sent.append((token, chat_id, text)) or True,
    )
    order = SimpleNamespace(
        payment_status="pending",
        customer_telegram="@gift_buyer",
        order_number="GIFT-100",
        items=[GiftItem()],
    )

    assert telegram_service.notify_customer_telegram_gifts(Shop(), order) is False
    assert sent == []

    order.payment_status = "paid"
    assert telegram_service.notify_customer_telegram_gifts(Shop(), order) is True
    assert len(sent) == 1
    assert sent[0][0] == "test-token"
    assert sent[0][1] == "@gift_buyer"
    assert "https://t.me/nft/ChillFlame-13081" in sent[0][2]
    assert "#GIFT-100" in sent[0][2]


def test_customer_gift_delivery_skips_invalid_recipient(monkeypatch):
    sent = []
    monkeypatch.setattr(
        telegram_service,
        "send_telegram_message",
        lambda *args: sent.append(args) or True,
    )
    order = SimpleNamespace(
        payment_status="paid",
        customer_telegram="gift_buyer",
        order_number="GIFT-101",
        items=[GiftItem()],
    )

    assert telegram_service.notify_customer_telegram_gifts(Shop(), order) is False
    assert sent == []


def test_paid_order_item_exposes_original_gift_link_only_after_payment():
    item = models.OrderItem(
        product_name="Chill Flame",
        price=10,
        quantity=1,
        variations=GiftItem.variations,
    )
    item.order = models.Order(payment_status="pending")
    assert "telegram_gift_url" not in item.to_dict()
    assert "_telegram_gift_url" not in item.to_dict()["variations"]

    item.order.payment_status = "paid"
    assert item.to_dict()["telegram_gift_url"] == "https://t.me/nft/ChillFlame-13081"
