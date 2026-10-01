"""Smoke test the public support endpoints against the local application."""
from fastapi.testclient import TestClient

from database import SessionLocal
from main import app
import models


def main():
    db = SessionLocal()
    try:
        shop = db.query(models.Shop).filter(models.Shop.status == "active").first()
        assert shop, "seed data must include an active shop"
        client = TestClient(app)
        opened = client.post("/api/automation/public/support", json={
            "shop_id": shop.id,
            "visitor_name": "Smoke Test",
            "visitor_contact": "test@example.com",
            "message": "Can you help me?",
        })
        assert opened.status_code == 200, opened.text
        token = opened.json()["token"]
        history = client.get(f"/api/automation/public/support/{token}")
        assert history.status_code == 200, history.text
        assert history.json()["messages"][0]["body"] == "Can you help me?"
        reply = client.post(f"/api/automation/public/support/{token}/message", json={"body": "One more question"})
        assert reply.status_code == 200, reply.text
        print("automation support smoke test passed")
    finally:
        db.close()


if __name__ == "__main__":
    main()
