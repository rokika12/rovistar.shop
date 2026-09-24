"""Telegram bot notification + Login Widget verification service."""
import hashlib
import hmac
import re
import secrets
import time

import httpx

import models
from config import config


def normalize_chat_ids(*chat_id_groups) -> list[str]:
    """Return non-empty Telegram chat IDs in stable, de-duplicated order."""
    result = []
    seen = set()
    for group in chat_id_groups:
        if group is None:
            continue
        values = group if isinstance(group, (list, tuple, set)) else [group]
        for value in values:
            chat_id = str(value or "").strip()
            if chat_id and chat_id not in seen:
                seen.add(chat_id)
                result.append(chat_id)
    return result


def configured_chat_ids(settings: dict) -> list[str]:
    """Read the new recipient list plus the legacy single chat_id field."""
    return normalize_chat_ids(settings.get("chat_ids") or [], settings.get("chat_id"))


def recipient_chat_ids(settings: dict) -> list[str]:
    """Return configured, admin, and bot-linked recipient chats once each."""
    return normalize_chat_ids(
        configured_chat_ids(settings),
        settings.get("admin_chat_ids") or [],
        settings.get("linked_chats") or [],
    )


def send_telegram_message(bot_token: str, chat_id: str, text: str) -> bool:
    """Send a text message via the Telegram Bot API. Returns True on success.

    If the HTML-styled send fails (e.g. very long message / an unescaped character),
    it automatically retries as plain text so the notification is never lost.
    """
    if not bot_token or not chat_id:
        return False
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payloads = (
        {"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True},
        {"chat_id": chat_id, "text": text, "disable_web_page_preview": True},
    )
    for payload in payloads:
        try:
            with httpx.Client(timeout=15) as client:
                resp = client.post(url, json=payload)
                data = resp.json()
            if resp.status_code == 200 and data.get("ok") is True:
                return True
        except Exception:
            continue
    return False


def send_telegram_message_with_buttons(bot_token: str, chat_id: str, text: str, buttons: list[list[dict]]) -> bool:
    """Send a shop alert with Telegram inline action buttons for order updates."""
    if not bot_token or not chat_id:
        return False
    try:
        with httpx.Client(timeout=15) as client:
            response = client.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                    "reply_markup": {"inline_keyboard": buttons},
                },
            )
            return response.status_code == 200 and response.json().get("ok") is True
    except Exception:
        return False


def send_telegram_photo(bot_token: str, chat_id: str, photo_url: str, caption: str) -> bool:
    """Send a selected product photo before the full text order notification."""
    if not bot_token or not chat_id or not photo_url:
        return False
    try:
        with httpx.Client(timeout=20) as client:
            response = client.post(
                f"https://api.telegram.org/bot{bot_token}/sendPhoto",
                json={"chat_id": chat_id, "photo": photo_url, "caption": caption[:1024], "parse_mode": "HTML"},
            )
            return response.status_code == 200 and response.json().get("ok") is True
    except Exception:
        return False


def send_telegram_callback_reply(bot_token: str, callback_id: str, text: str = "") -> None:
    """Dismiss Telegram's button spinner after a shop owner changes an order."""
    if not bot_token or not callback_id:
        return
    try:
        with httpx.Client(timeout=15) as client:
            client.post(
                f"https://api.telegram.org/bot{bot_token}/answerCallbackQuery",
                json={"callback_query_id": callback_id, "text": text},
            )
    except Exception:
        pass


def update_telegram_order_buttons(bot_token: str, chat_id, message_id, buttons: list[list[dict]]) -> None:
    """Keep only the next valid status action after a Telegram button is pressed."""
    if not bot_token or not chat_id or not message_id:
        return
    try:
        with httpx.Client(timeout=15) as client:
            client.post(
                f"https://api.telegram.org/bot{bot_token}/editMessageReplyMarkup",
                json={"chat_id": chat_id, "message_id": message_id, "reply_markup": {"inline_keyboard": buttons}},
            )
    except Exception:
        pass


def telegram_order_buttons(order_id: int, order_status: str) -> list[list[dict]]:
    """Render the remaining valid status controls for an order notification."""
    done = {"text": "✅ Order completed", "callback_data": f"order:{order_id}:done"}
    if order_status in ("delivered", "completed", "cancelled"):
        return [[done]]
    if order_status == "shipped":
        return [[
            {"text": "✅ Marked as shipped", "callback_data": f"order:{order_id}:done"},
            {"text": "✅ Mark delivered", "callback_data": f"order:{order_id}:completed"},
        ]]
    return [[
        {"text": "🚚 Mark as shipped", "callback_data": f"order:{order_id}:shipped"},
        {"text": "✅ Mark delivered", "callback_data": f"order:{order_id}:completed"},
    ]]


def ensure_shop_profile(shop) -> dict:
    """
    Make sure the shop has a bot Profile ID (used to link the Telegram bot to a shop)
    a linked_chats list, and the multi-recipient chat_ids list. Stores them in
    shop.telegram_settings while preserving the legacy chat_id field.
    """
    tg = shop.telegram_dict()
    changed = False
    if not tg.get("profile_id"):
        tg["profile_id"] = f"SHOP{shop.id}-{secrets.token_hex(4).upper()}"
        changed = True
    if not tg.get("secret_key"):
        tg["secret_key"] = secrets.token_hex(8)
        changed = True
    if "linked_chats" not in tg:
        tg["linked_chats"] = []
        changed = True
    normalized_chat_ids = configured_chat_ids(tg)
    if tg.get("chat_ids") != normalized_chat_ids:
        tg["chat_ids"] = normalized_chat_ids
        changed = True
    if changed:
        shop.telegram_settings = models.JSONText.dumps(tg)
    return tg


def send_shop_notification(shop, text: str) -> bool:
    """Send a message to every configured or bot-linked recipient chat."""
    tg = shop.telegram_dict()
    bot_token = (tg.get("bot_token") or "").strip()
    if not bot_token:
        return False
    sent = False
    for cid in recipient_chat_ids(tg):
        if send_telegram_message(bot_token, cid, text):
            sent = True
    return sent


def notify_shop_new_order(shop, order_number, amount, currency, customer_name) -> bool:
    text = (
        f"🛒 <b>New Order Placed!</b>\n\n"
        f"🏪 <b>Shop:</b> {shop.shop_name or shop.username}\n"
        f"🧾 <b>Order:</b> #{order_number}\n"
        f"💰 <b>Amount:</b> {amount:,.2f} {currency}\n"
        f"👤 <b>Customer:</b> {customer_name}"
    )
    return send_shop_notification(shop, text)


def notify_shop_payment_success(shop, order_number, amount, currency, customer_name) -> bool:
    text = (
        f"✅ <b>Payment Successful!</b>\n\n"
        f"🏪 <b>Shop:</b> {shop.shop_name or shop.username}\n"
        f"🧾 <b>Order:</b> #{order_number}\n"
        f"💰 <b>Amount:</b> {amount:,.2f} {currency}\n"
        f"👤 <b>Customer:</b> {customer_name}\n"
        f"🕒 <b>Time:</b> {time.strftime('%Y-%m-%d %H:%M:%S')}"
    )
    return send_shop_notification(shop, text)


def notify_shop_service_request(shop, order, link: str, note: str = "") -> bool:
    """Alert the shop only after a paid customer submits a manual-service link."""
    lines = [
        "🔗 <b>សំណើសេវាកម្មថ្មី</b>",
        "",
        f"🧾 <b>លេខកុម្ម៉ង់:</b> #{_html(order.order_number)}",
        f"👤 <b>អតិថិជន:</b> {_html(order.customer_name or '-')}",
        f"🔗 <b>Link:</b> {_html(link)}",
    ]
    if note:
        lines.append(f"📝 <b>កំណត់ចំណាំ:</b> {_html(note)}")
    return send_shop_notification(shop, "\n".join(lines))


def send_verification_code(bot_token: str, chat_id, code: str) -> bool:
    """Send a one-time login verification code to a Telegram user via the bot."""
    text = (
        f"🔐 <b>Mini Shop Login</b>\n\n"
        f"Your verification code is:\n\n"
        f"<b>{code}</b>\n\n"
        f"Enter it on the website to complete your Telegram login. "
        f"It expires in 5 minutes."
    )
    return send_telegram_message(bot_token, str(chat_id), text)


def get_bot_username(bot_token: str):
    """Resolve a bot token to its public @username via the getMe API."""
    result = validate_bot_token(bot_token)
    return result.get("username") if result.get("ok") else None


def validate_bot_token(bot_token: str) -> dict:
    """Validate a bot token with Telegram getMe without returning the token."""
    if not bot_token:
        return {"ok": False, "detail": "Bot token is not configured"}
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(f"https://api.telegram.org/bot{bot_token}/getMe")
            data = resp.json()
        if resp.status_code == 200 and data.get("ok") is True:
            bot = data.get("result") or {}
            return {"ok": True, "username": bot.get("username") or "", "bot_id": bot.get("id")}
        return {"ok": False, "detail": data.get("description") or "Telegram rejected the bot token"}
    except Exception:
        return {"ok": False, "detail": "Telegram could not be reached. Please try again."}


def resolve_public_chat_username(bot_token: str, username: str) -> dict:
    """Resolve a public group/channel username through Telegram's getChat API.

    Telegram does not expose private user profiles by username. A customer must
    start the bot first before their name and chat ID can be trusted or stored.
    """
    normalized = str(username or "").strip().lstrip("@")
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{4,31}", normalized):
        return {"ok": False, "detail": "Enter a valid Telegram username (for example @my_shop_group)."}
    if not bot_token:
        return {"ok": False, "detail": "Save the bot token before checking a Telegram username."}
    try:
        with httpx.Client(timeout=15) as client:
            response = client.get(
                f"https://api.telegram.org/bot{bot_token}/getChat",
                params={"chat_id": f"@{normalized}"},
            )
        payload = response.json()
    except Exception:
        return {"ok": False, "detail": "Telegram could not be reached. Please try again."}
    if not payload.get("ok"):
        return {
            "ok": False,
            "detail": "Telegram could not find that public group or channel. Private users must first press Start on the bot.",
        }
    chat = payload.get("result") or {}
    display_name = chat.get("title") or " ".join(filter(None, [chat.get("first_name"), chat.get("last_name")]))
    return {
        "ok": True,
        "username": chat.get("username") or normalized,
        "name": display_name or f"@{normalized}",
        "chat_type": chat.get("type") or "unknown",
    }


def resolve_public_profile_username(username: str) -> dict:
    """Read public Telegram profile metadata without accessing private accounts."""
    normalized = str(username or "").strip().lstrip("@")
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{4,31}", normalized):
        return {"ok": False, "detail": "Enter a valid Telegram username (for example @username)."}
    try:
        with httpx.Client(timeout=10, follow_redirects=True) as client:
            response = client.get(f"https://t.me/{normalized}")
        if response.status_code != 200:
            return {"ok": False, "detail": "Telegram could not find that public username."}
        page = response.text
    except httpx.HTTPError:
        return {"ok": False, "detail": "Telegram could not be reached. Please try again."}

    if "tgme_page" not in page and "telegram.me" not in page and "t.me" not in str(response.url):
        return {"ok": False, "detail": "This Telegram username is not publicly visible."}
    # Telegram's public page metadata is not a verified identity record. Do not
    # show its title or image as a customer's name/avatar because it can be
    # stale or refer to a channel, which caused incorrect names to be displayed.
    return {
        "ok": True,
        "username": normalized,
        "name": "",
        "avatar_url": "",
        "detail": "Public username found. Telegram does not expose a verified display name or avatar by public username.",
    }


def verify_telegram_login(bot_token: str, auth_data: dict) -> bool:
    """
    Verify the signature of the Telegram Login Widget callback.

    The widget returns the logged-in user as {id, first_name, last_name, username,
    photo_url, auth_date, hash}. The hash is an HMAC-SHA256 signature:

        secret_key        = SHA256(bot_token)
        data_check_string = sorted "key=value" lines (excluding hash), joined by \n
        hash              = HMAC_SHA256(data_check_string, secret_key) hex

    Also rejects stale auth_data (older than 24h).
    """
    received = (auth_data or {}).get("hash", "")
    if not received or not bot_token:
        return False

    check = dict(auth_data or {})
    check.pop("hash", None)

    # Freshness check
    try:
        if time.time() - int(check.get("auth_date", 0)) > 24 * 3600:
            return False
    except (TypeError, ValueError):
        return False

    secret_key = hashlib.sha256(bot_token.encode("utf-8")).digest()
    data_check_string = "\n".join(f"{k}={check[k]}" for k in sorted(check))
    calculated = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(calculated, received)


def notify_payment_success(bot_token: str, chat_id: str, order_number: str, amount: float,
                           currency: str, customer_name: str, shop_name: str) -> bool:
    """Send a payment-success notification to a Telegram group/channel."""
    text = (
        f"✅ <b>Payment Successful!</b>\n\n"
        f"🏪 <b>Shop:</b> {shop_name}\n"
        f"🧾 <b>Order:</b> #{order_number}\n"
        f"💰 <b>Amount:</b> {amount:,.2f} {currency}\n"
        f"👤 <b>Customer:</b> {customer_name}\n"
        f"🕒 <b>Time:</b> {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )
    return send_telegram_message(bot_token, chat_id, text)


def notify_new_order(bot_token: str, chat_id: str, order_number: str, amount: float,
                     currency: str, customer_name: str, shop_name: str) -> bool:
    text = (
        f"🛒 <b>New Order Placed!</b>\n\n"
        f"🏪 <b>Shop:</b> {shop_name}\n"
        f"🧾 <b>Order:</b> #{order_number}\n"
        f"💰 <b>Amount:</b> {amount:,.2f} {currency}\n"
        f"👤 <b>Customer:</b> {customer_name}"
    )
    return send_telegram_message(bot_token, chat_id, text)


def send_default_payment_notification(order_number: str, amount: float, currency: str, shop_name: str) -> bool:
    """Fallback notification using the platform-wide default bot token (no chat id)."""
    return False


def _html(text) -> str:
    """Escape text for Telegram HTML parse mode (safe inside <b>/<code> tags)."""
    return (str(text or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def _money(amount, currency) -> str:
    return f"{float(amount or 0):,.2f} {currency}"


def _public_receipt_url(order) -> str:
    """Build a safe, public receipt URL for Telegram.

    Never sends filesystem/database paths: a raw path (e.g. C:\\...\\receipt.pdf,
    /data/minishop.db) is reduced to just the filename and re-built as a clean
    /uploads/receipts/<name> URL. Non-PDF values (like the database file) are
    dropped entirely.
    """
    raw = str(getattr(order, "receipt_url", "") or "").strip()
    if not raw:
        return ""
    if raw.startswith(("http://", "https://")):
        return raw
    if raw.lower().endswith(".pdf"):
        name = raw.replace("\\", "/").split("/")[-1]
        return f"{config.BASE_URL}/uploads/receipts/{name}"
    return ""


def _public_product_image_url(image: str) -> str:
    """Turn a stored product-image reference into a Telegram-fetchable URL."""
    image = str(image or "").strip()
    if image.startswith(("https://", "http://")):
        return image
    if image.startswith("/"):
        return f"{config.BASE_URL.rstrip('/')}{image}"
    return ""


def _telegram_customer_username(order) -> str:
    """Keep the delivery username readable and avoid leaking JSON-like details."""
    for item in order.items:
        try:
            target = str(models.JSONText.loads(item.variations, {}).get("_service_link") or "").strip()
        except Exception:
            target = ""
        if target:
            return target if target.startswith("@") else target[:120]
    value = str(getattr(order, "customer_telegram", "") or "").strip()
    return value if value.startswith("@") or not value else f"@{value}"


def _telegram_item_selection(item) -> str:
    """Show only customer-facing package choices, never delivery payloads."""
    try:
        values = models.JSONText.loads(item.variations, {}) if item.variations else {}
    except Exception:
        values = {}
    choices = [f"{key}: {value}" for key, value in values.items()
               if not str(key).startswith("_") and str(value).strip()]
    return " | ".join(choices)


def notify_shop_payment_success_full(shop, order, stock_summary=None) -> bool:
    """
    Send a FULL payment-success notification (in Khmer) to every chat linked to
    the shop. Includes: order number, payment method + transaction id, paid time,
    complete customer details, every ordered item (name, variations, qty x price,
    line total), subtotal / shipping / discount / grand total, remaining stock per
    product, and the receipt link.

    stock_summary: optional dict from stock_service.deduct_stock_for_order, shaped
    {product_id: {"name": str, "deducted": int, "remaining": int}}.
    """
    from datetime import datetime

    if not telegram_settings_enabled(shop):
        return False

    # Force-load every related row now (items relationship) before building text.
    _ = [i for i in order.items]

    currency = order.currency or "USD"
    txn = order.transaction_id or ""
    paid_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    if getattr(order, "paid_at", None):
        try:
            paid_time = order.paid_at.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            pass

    sep = "━━━━━━━━━━━━"
    method_label = {
        "cash": "បង់ប្រាក់ផ្ទាល់ (Cash)",
        "khqr": "ABA Pay (KHQR)",
        "aba": "ABA Pay (KHQR)",
    }.get((order.payment_method or "aba").lower(), order.payment_method or "ABA Pay")
    lines = [
        "✅ <b>ការទូទាត់បានជោគជ័យ</b>",
        f"🧾 <b>លេខកុម្ម៉ង់:</b> #{_html(order.order_number)}",
        f"💳 <b>ទូទាត់ដោយ:</b> {method_label}",
        f"💰 <b>សរុបបង់:</b> {_money(order.total, currency)}",
        "",
        sep,
        "🛍️ <b>ទំនិញ / Package ដែលភ្ញៀវជ្រើស</b>",
    ]

    stock_by_pid = {pid: s for pid, s in (stock_summary or {}).items()}
    for i in order.items:
        name = i.product_name or f"Product #{i.product_id}"
        selected = _telegram_item_selection(i)
        line_total = float(i.price or 0) * int(i.quantity or 1)
        lines.append(
            f"▫️ <b>{_html(name)}</b>\n"
            + (f"    🎯 <b>ជ្រើស:</b> {_html(selected)}\n" if selected else "")
            + f"    📦 <b>ចំនួន:</b> {int(i.quantity)} | 💵 <b>តម្លៃ:</b> {_money(i.price, currency)}\n"
            + f"    💰 <b>សរុប:</b> {_money(line_total, currency)}"
        )
        s = stock_by_pid.get(i.product_id)
        if s:
            if s.get("variation"):
                lines.append(
                    f"    📦 ស្តុក ({_html(s['variation']['label'])}) នៅសល់: "
                    f"<b>{int(s['variation']['remaining'])}</b>"
                )
            else:
                lines.append(f"    📦 ស្តុកនៅសល់: <b>{int(s.get('remaining', 0))}</b>")

    lines += [
        "",
        sep,
        f"សរុបទំនិញ: {_money(order.items_total, currency)}",
    ]
    if float(order.shipping_fee or 0) > 0:
        lines.append(f"ថ្លៃដឹកជញ្ជូន: +{_money(order.shipping_fee, currency)}")
    if float(order.discount or 0) > 0:
        lines.append(f"បញ្ចុះតម្លៃ: -{_money(order.discount, currency)}")
    lines += [
        "",
        sep,
        "👤 <b>ព័ត៌មានសម្រាប់ផ្ញើទំនិញ</b>",
        f"ឈ្មោះ: {_html(order.customer_name or '-')}",
    ]
    delivery_username = _telegram_customer_username(order)
    if delivery_username:
        lines.append(f"🎯 <b>Username / ID ទទួល:</b> <code>{_html(delivery_username)}</code>")
    if order.customer_phone:
        lines.append(f"ទូរស័ព្ទ: {_html(order.customer_phone)}")
    if order.customer_email:
        lines.append(f"អ៊ីមែល: {_html(order.customer_email)}")
    if order.customer_address:
        lines.append(f"អាសយដ្ឋាន: {_html(order.customer_address)}")
    city_country = ", ".join(x for x in [order.customer_city, order.customer_country] if x)
    if city_country:
        lines.append(f"ទីក្រុង/ប្រទេស: {_html(city_country)}")
    if order.customer_note:
        lines.append(f"កំណត់ចំណាំ: {_html(order.customer_note)}")
    receipt_link = _public_receipt_url(order)
    if receipt_link:
        lines.append("")
        lines.append(f"🧾 <b>បង្កាន់ដៃ:</b> {_html(receipt_link)}")

    text = "\n".join(lines)
    buttons = telegram_order_buttons(order.id, order.order_status)
    tg = shop.telegram_dict()
    bot_token = (tg.get("bot_token") or "").strip()
    if not bot_token:
        return False
    sent = False
    image_url = next((_public_product_image_url(getattr(item, "image", ""))
                      for item in order.items if getattr(item, "image", "")), "")
    for chat_id in recipient_chat_ids(tg):
        if image_url:
            send_telegram_photo(
                bot_token, chat_id, image_url,
                f"🛍️ <b>Order #{_html(order.order_number)}</b> product image",
            )
        if send_telegram_message_with_buttons(bot_token, chat_id, text, buttons):
            sent = True
    return sent


def telegram_settings_enabled(shop) -> bool:
    """Master switch: is Telegram notification delivery enabled for this shop?"""
    tg = shop.telegram_dict()
    return bool(tg.get("enabled"))
