import bot_worker


def test_callback_update_is_acknowledged_and_replaces_buttons(monkeypatch):
    calls = []
    monkeypatch.setattr(bot_worker, "_api_order_action", lambda shop, callback: {
        "ok": True,
        "text": "Order completed",
        "buttons": [[{"text": "done", "callback_data": "order:5:done"}]],
    })
    monkeypatch.setattr(bot_worker, "_tg_post", lambda token, method, payload: calls.append((token, method, payload)) or {"ok": True})

    bot_worker.handle_update({
        "callback_query": {
            "id": "callback-1", "data": "order:5:completed",
            "message": {"chat": {"id": 101}, "message_id": 42},
        },
    }, {"id": 7, "bot_token": "bot-token"})

    assert calls == [
        ("bot-token", "answerCallbackQuery", {"callback_query_id": "callback-1", "text": "Order completed"}),
        ("bot-token", "editMessageReplyMarkup", {
            "chat_id": 101, "message_id": 42,
            "reply_markup": {"inline_keyboard": [[{"text": "done", "callback_data": "order:5:done"}]]},
        }),
    ]
