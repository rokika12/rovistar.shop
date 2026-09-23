"""Telegram notification endpoints + bot webhook + activity log endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

import models
import schemas
from config import config
from database import get_db
from security import get_current_admin, get_current_user, require_shop_access
from services import stock_service, telegram_service

router = APIRouter(prefix="/api", tags=["telegram"])


@router.get("/telegram/public-profile")
def public_telegram_profile(username: str = Query(...)):
    """Preview a public Telegram username before a customer buys a service."""
    result = telegram_service.resolve_public_profile_username(username)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result.get("detail", "Telegram username not found"))
    return result


@router.post("/telegram/webhook/{token}")
async def telegram_bot_webhook(token: str, request: Request, db: Session = Depends(get_db)):
    """
    Telegram bot webhook. The bot sends every user message here.

    Commands:
      /start            → welcome + how to link this chat to a shop
      LINK <ProfileID> <SecretKey>  → verify and link this chat to that shop
      /shop             → show the currently linked shop info
    After linking, the shop's notifications are delivered to this chat.
    """
    update = await request.json()

    # Bot added to a group → auto-welcome with the LINK command so the owner
    # can copy-paste it right there. my_chat_member arrives when the bot is
    # added/removed; status "member" means it was just added to the chat.
    my_chat_member = update.get("my_chat_member") or {}
    if my_chat_member:
        new_status = (my_chat_member.get("new_chat_member") or {}).get("status")
        new_chat = my_chat_member.get("chat") or {}
        new_chat_id = new_chat.get("id")
        if new_status == "member" and new_chat_id:
            for s in db.query(models.Shop).all():
                if (s.telegram_dict().get("bot_token") or "").strip() == token:
                    tg = telegram_service.ensure_shop_profile(s)
                    db.commit()
                    telegram_service.send_telegram_message(
                        token, str(new_chat_id),
                        f"👋 ស្វាគមន៍! Bot របស់ <b>{s.shop_name or s.username}</b> ត្រូវបានបន្ថែមចូលក្រុមនេះ! 🏪\n\n"
                        "ដើម្បីទទួល <b>ការជូនដំណឹងការបង់ប្រាក់ជោគជ័យ</b> របស់ហាងនៅទីនេះ "
                        "សូមផ្ញើ:\n\n"
                        f"<code>LINK {tg.get('profile_id')} {tg.get('secret_key')}</code>\n\n"
                        "អ្នកនឹងទទួលបានតែការជូនដំណឹងពេលអតិថិជនបង់ប្រាក់រួច "
                        "ជាមួយព័ត៌មានលម្អិត + ស្តុក។")
                    break
        return {"ok": True}

    # The token is part of the webhook URL, so resolve its owning shop before
    # handling either a normal message or an inline-button callback.
    shop = next((s for s in db.query(models.Shop).all()
                 if (s.telegram_dict().get("bot_token") or "").strip() == token), None)
    if not shop:
        return {"ok": True}
    bot_token = token

    callback = update.get("callback_query") or {}
    if callback:
        data = str(callback.get("data") or "")
        match = __import__("re").fullmatch(r"order:(\d+):(shipped|completed)", data)
        if not match:
            telegram_service.send_telegram_callback_reply(bot_token, callback.get("id", ""), "Action unavailable")
            return {"ok": True}
        order = db.query(models.Order).filter(models.Order.id == int(match.group(1)), models.Order.shop_id == shop.id).first()
        if not order:
            telegram_service.send_telegram_callback_reply(bot_token, callback.get("id", ""), "Order not found")
            return {"ok": True}
        action = match.group(2)
        if order.payment_status != "paid":
            telegram_service.send_telegram_callback_reply(bot_token, callback.get("id", ""), "Payment is not confirmed")
            return {"ok": True}
        if order.order_status in ("delivered", "completed", "cancelled"):
            telegram_service.send_telegram_callback_reply(bot_token, callback.get("id", ""), "Order is already closed")
            return {"ok": True}
        if action == "completed" and order.order_status not in ("shipped", "processing"):
            telegram_service.send_telegram_callback_reply(bot_token, callback.get("id", ""), "Mark this order as shipped first")
            return {"ok": True}
        next_status = "delivered" if action == "completed" else "shipped"
        order.order_status = next_status
        db.commit()
        delivered = next_status == "delivered"
        telegram_service.send_telegram_callback_reply(
            bot_token, callback.get("id", ""),
            "បានបញ្ជូនជោគជ័យ" if delivered else "បានកំណត់ថាកំពុងផ្ញើ",
        )
        message = callback.get("message") or {}
        next_buttons = [] if delivered else [[
            {"text": "✅ អីវ៉ាន់ផ្ញើជោគជ័យ", "callback_data": f"order:{order.id}:completed"},
        ]]
        telegram_service.update_telegram_order_buttons(
            bot_token, (message.get("chat") or {}).get("id"), message.get("message_id"), next_buttons,
        )
        return {"ok": True, "order_id": order.id, "order_status": order.order_status}

    message = update.get("message") or {}
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    text = (message.get("text") or "").strip()
    if not chat_id or not text:
        return {"ok": True}

    lower = text.lower()

    if lower == "/start" or lower == "start":
        tg = telegram_service.ensure_shop_profile(shop)
        db.commit()
        reply = (
            f"សូមស្វាគមន៍មកកាន់ <b>{shop.shop_name or shop.username}</b>! 🏪\n\n"
            "ដើម្បីទទួល <b>ការជូនដំណឹងនៅពេលអតិថិជនបង់ប្រាក់ជោគជ័យ</b> "
            "(ព័ត៌មានលម្អិតទំនិញ + ស្តុក) នៅក្នុង chat នេះ សូមផ្ញើ:\n\n"
            f"<code>LINK {tg.get('profile_id')} {tg.get('secret_key')}</code>\n\n"
            "អ្នកអាចរក Profile ID និង Secret Key នៅក្នុង "
            "<b>Shop Dashboard → Telegram Bot</b> ។"
        )
        telegram_service.send_telegram_message(bot_token, chat_id, reply)

    elif lower.startswith("link "):
        parts = text.split()
        if len(parts) >= 3:
            pid, sec = parts[1], parts[2]
            matched = None
            for s in db.query(models.Shop).all():
                tg = s.telegram_dict()
                if (tg.get("profile_id") or "") == pid and (tg.get("secret_key") or "") == sec:
                    matched = s
                    break
            if matched:
                tg = matched.telegram_dict()
                chats = list(tg.get("linked_chats") or [])
                if chat_id not in chats:
                    chats.append(chat_id)
                    tg["linked_chats"] = chats
                    matched.telegram_settings = models.JSONText.dumps(tg)
                    db.commit()
                telegram_service.send_telegram_message(
                    bot_token, chat_id,
                    f"✅ បានភ្ជាប់ជាមួយ <b>{matched.shop_name or matched.username}</b> ដោយជោគជ័យ! "
                    "ចាប់ពីពេលនេះ អ្នកនឹងទទួលបានការជូនដំណឹងការបង់ប្រាក់ជោគជ័យរបស់ហាងនៅទីនេះ។")
            else:
                telegram_service.send_telegram_message(
                    bot_token, chat_id,
                    "❌ Profile ID ឬ Secret Key មិនត្រឹមត្រូវ។ "
                    "សូមពិនិត្យមើល <b>Shop Dashboard → Telegram Bot</b> សម្រាប់ព័ត៌មាន។")
        else:
            telegram_service.send_telegram_message(
                bot_token, chat_id,
                "សូមផ្ញើតាមទម្រង់នេះ៖\n<code>LINK &lt;ProfileID&gt; &lt;SecretKey&gt;</code>")

    elif lower == "/shop":
        tg = shop.telegram_dict()
        telegram_service.send_telegram_message(
            bot_token, chat_id,
            f"🏪 <b>{shop.shop_name or shop.username}</b>\n"
            f"Profile ID: <code>{tg.get('profile_id', '')}</code>\n"
            f"ចំនួន chat ដែលបានភ្ជាប់: {len(tg.get('linked_chats') or [])}")

    return {"ok": True}


@router.post("/telegram/setwebhook")
def set_telegram_webhook(shop_id: int, db: Session = Depends(get_db),
                         user: models.User = Depends(get_current_user)):
    """Register the backend webhook URL with the shop's bot (required for /start + LINK)."""
    require_shop_access(shop_id, user)
    shop = db.query(models.Shop).filter(models.Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    tg = telegram_service.ensure_shop_profile(shop)
    db.commit()
    bot_token = (tg.get("bot_token") or "").strip()
    if not bot_token:
        raise HTTPException(status_code=400, detail="Bot token is not configured")

    import httpx
    webhook_url = f"{config.BASE_URL}/api/telegram/webhook/{bot_token}"
    try:
        with httpx.Client(timeout=20) as client:
            resp = client.post(
                f"https://api.telegram.org/bot{bot_token}/setWebhook",
                json={"url": webhook_url, "allowed_updates": ["message", "my_chat_member", "callback_query"]})
            data = resp.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not reach Telegram: {e}")

    if not data.get("ok"):
        raise HTTPException(status_code=400, detail=data.get("description", "setWebhook failed"))

    return {
        "ok": True,
        "detail": "Webhook registered. Users can now start the bot and link your shop.",
        "profile_id": tg.get("profile_id"),
        "secret_key": tg.get("secret_key"),
        "linked_chats": tg.get("linked_chats", []),
    }


@router.get("/telegram/settings")
def get_telegram_settings(shop_id: int, db: Session = Depends(get_db),
                          user: models.User = Depends(get_current_user)):
    """Owner: view the shop's bot profile (Profile ID, Secret Key, linked chats)."""
    require_shop_access(shop_id, user)
    shop = db.query(models.Shop).filter(models.Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    tg = telegram_service.ensure_shop_profile(shop)
    db.commit()
    return {
        "chat_id": tg.get("chat_id", ""),
        "chat_ids": telegram_service.configured_chat_ids(tg),
        "admin_chat_ids": telegram_service.normalize_chat_ids(tg.get("admin_chat_ids") or []),
        "enabled": tg.get("enabled", False),
        "bot_token_configured": bool(tg.get("bot_token")),
        "profile_id": tg.get("profile_id", ""),
        "secret_key": tg.get("secret_key", ""),
        "linked_chats": tg.get("linked_chats", []),
        "bot_username": telegram_service.get_bot_username(tg.get("bot_token", "")),
    }


@router.post("/telegram/settings/test-and-save")
def test_and_save_telegram_settings(data: schemas.TelegramSettingsSave,
                                    db: Session = Depends(get_db),
                                    user: models.User = Depends(get_current_user)):
    """Validate proposed Telegram settings, test every recipient, then save atomically."""
    require_shop_access(data.shop_id, user)
    shop = db.query(models.Shop).filter(models.Shop.id == data.shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    current = telegram_service.ensure_shop_profile(shop)
    bot_token = (data.bot_token or current.get("bot_token") or "").strip()
    validation = telegram_service.validate_bot_token(bot_token)
    if not validation.get("ok"):
        raise HTTPException(status_code=400, detail=validation.get("detail", "Invalid bot token"))

    chat_ids = telegram_service.normalize_chat_ids(data.chat_ids)
    test_recipients = telegram_service.normalize_chat_ids(chat_ids, current.get("linked_chats") or [])
    if not test_recipients:
        raise HTTPException(status_code=400, detail="Add at least one recipient chat ID or link a chat")

    message = f"🧪 Telegram settings test from Mini Shop Platform ({user.username})"
    failed_chat_ids = [
        chat_id for chat_id in test_recipients
        if not telegram_service.send_telegram_message(bot_token, chat_id, message)
    ]
    if failed_chat_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Test message failed for chat ID(s): {', '.join(failed_chat_ids)}. Settings were not saved.",
        )

    current.update({
        "bot_token": bot_token,
        "chat_ids": chat_ids,
        "chat_id": chat_ids[0] if chat_ids else "",
        "enabled": data.enabled,
    })
    shop.telegram_settings = models.JSONText.dumps(current)
    db.commit()
    return {
        "ok": True,
        "detail": f"Test sent to {len(test_recipients)} recipient(s); settings saved",
        "chat_ids": chat_ids,
        "tested_chat_ids": test_recipients,
        "enabled": data.enabled,
        "bot_token_configured": True,
        "bot_username": validation.get("username", ""),
    }


@router.get("/telegram/resolve-public-chat")
def resolve_public_telegram_chat(shop_id: int, username: str, db: Session = Depends(get_db),
                                 user: models.User = Depends(get_current_user)):
    """Check a public Telegram group/channel username before saving its chat ID."""
    require_shop_access(shop_id, user)
    shop = db.query(models.Shop).filter(models.Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    bot_token = (shop.telegram_dict().get("bot_token") or "").strip()
    return telegram_service.resolve_public_chat_username(bot_token, username)


@router.post("/telegram/test")
def test_telegram(data: schemas.TelegramTest, db: Session = Depends(get_db),
                  user: models.User = Depends(get_current_user)):
    """Send a test notification using a shop's configured bot token + chat id."""
    if data.shop_id:
        require_shop_access(data.shop_id, user)
        shop = db.query(models.Shop).filter(models.Shop.id == data.shop_id).first()
        if not shop:
            raise HTTPException(status_code=404, detail="Shop not found")
        tg = shop.telegram_dict()
        bot_token = tg.get("bot_token", "")
        chat_ids = telegram_service.recipient_chat_ids(tg)
    else:
        if user.role != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
        bot_token = __import__("config").config.TELEGRAM_BOT_TOKEN
        chat_ids = []

    if not bot_token or not chat_ids:
        raise HTTPException(status_code=400, detail="Bot token or chat ID is not configured")

    failed_chat_ids = [
        chat_id for chat_id in chat_ids
        if not telegram_service.send_telegram_message(
            bot_token, chat_id,
            f"{data.message}\n\n— Sent from Mini Shop Platform ({user.username})")
    ]
    ok = not failed_chat_ids
    return {
        "ok": ok,
        "detail": "Notification sent to all recipients" if ok else "Failed to send to one or more recipients",
        "sent_count": len(chat_ids) - len(failed_chat_ids),
        "recipient_count": len(chat_ids),
    }


@router.post("/telegram/stock-alert")
def send_stock_alert(shop_id: int, db: Session = Depends(get_db),
                     user: models.User = Depends(get_current_user)):
    """Send a low-stock alert to the shop's Telegram group using the shop's bot token."""
    require_shop_access(shop_id, user)
    shop = db.query(models.Shop).filter(models.Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    ok = stock_service.send_low_stock_alerts(db, shop)
    if not ok:
        raise HTTPException(status_code=400,
                            detail="No low-stock items, or the bot token / chat ID is not configured "
                                   "in Telegram Settings")
    return {"ok": True, "detail": "Low-stock alert sent to your Telegram group"}


@router.get("/activity")
def list_activity(shop_id: int = None, username: str = "", limit: int = 100,
                  db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Activity logs, filterable by shop/user. Admin sees all."""
    q = db.query(models.ActivityLog)
    if user.role != "admin":
        q = q.filter(models.ActivityLog.shop_id == user.shop_id)
    if shop_id is not None and user.role == "admin":
        q = q.filter(models.ActivityLog.shop_id == shop_id)
    if username:
        q = q.filter(models.ActivityLog.username.ilike(f"%{username}%"))
    logs = q.order_by(models.ActivityLog.id.desc()).limit(limit).all()
    return [l.to_dict() for l in logs]
