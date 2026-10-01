"""Design reference, domain mapping, and customer-support tools."""
import ipaddress
import re
import secrets
import base64
import hashlib
from datetime import datetime
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from config import config
from database import get_db
from security import get_current_admin, get_current_user, log_activity, require_shop_access
from services import telegram_service

router = APIRouter(prefix="/api/automation", tags=["automation"])
PORKBUN_API = "https://api.porkbun.com/api/json/v3"


def _safe_public_url(raw_url: str) -> str:
    parsed = urlparse(raw_url.strip())
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Enter a public http or https website URL")
    host = parsed.hostname.lower()
    if host in ("localhost",) or host.endswith(".local"):
        raise HTTPException(status_code=400, detail="Only public websites can be inspected")
    try:
        if ipaddress.ip_address(host).is_private or ipaddress.ip_address(host).is_loopback:
            raise HTTPException(status_code=400, detail="Only public websites can be inspected")
    except ValueError:
        pass
    return parsed.geturl()


def _extract_design_reference(html: str, source_url: str) -> dict:
    title = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    fonts = []
    for match in re.finditer(r"(?:font-family|family=)\s*[:=]?\s*['\"]?([^;'\"&}]+)", html, re.I):
        candidate = re.sub(r"\s+", " ", match.group(1)).strip()
        if candidate and candidate.lower() not in ("inherit", "sans-serif", "serif") and candidate not in fonts:
            fonts.append(candidate[:80])
    colors = []
    for color in re.findall(r"#[0-9a-fA-F]{3,8}\b", html):
        color = color.upper()
        if color not in colors:
            colors.append(color)
        if len(colors) >= 12:
            break
    return {
        "source_url": source_url,
        "title": re.sub(r"\s+", " ", title.group(1)).strip()[:160] if title else "Untitled website",
        "fonts": fonts[:8],
        "colors": colors,
        "suggested_theme": {
            "primary": colors[0] if colors else "#123B3A",
            "secondary": colors[1] if len(colors) > 1 else "#F4C95D",
            "font_family": fonts[0] if fonts else "Kantumruy Pro",
        },
        "notice": "Reference only: original copy, logos, product photos, and code are not imported.",
    }


@router.post("/design/inspect")
def inspect_design(data: schemas.DesignInspectRequest, admin: models.User = Depends(get_current_admin)):
    url = _safe_public_url(data.url)
    try:
        with httpx.Client(timeout=12, follow_redirects=True, headers={"User-Agent": "RovistarDesignReference/1.0"}) as client:
            response = client.get(url)
        if response.status_code >= 400:
            raise HTTPException(status_code=400, detail="The reference website could not be read")
        return _extract_design_reference(response.text[:1_000_000], str(response.url))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="The reference website could not be reached")


@router.post("/design/apply")
def apply_design(data: schemas.DesignApplyRequest, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    shop = db.get(models.Shop, data.shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    current = shop.theme_dict()
    current.update({key: value for key, value in data.theme.items() if key in ("primary", "secondary", "font_family") and isinstance(value, str)})
    shop.theme = models.JSONText.dumps(current)
    log_activity(db, "apply_design_reference", f"Admin updated design tokens for {shop.username}", shop.id, admin)
    db.commit()
    return shop.to_dict(include_private=True)


@router.get("/domains")
def list_domains(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    return [item.to_dict() for item in db.query(models.DomainMapping).order_by(models.DomainMapping.id.desc()).all()]


@router.get("/porkbun/status")
def porkbun_status(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    connection = db.query(models.PorkbunConnection).first()
    return {"connected": bool(connection and connection.api_key and connection.secret_key), "pending": bool(connection and connection.request_token)}


@router.post("/porkbun/connect/start")
def start_porkbun_connect(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).decode("ascii").rstrip("=")
    try:
        response = httpx.post(f"{PORKBUN_API}/apikey/request", json={"name": "Rovistar Domain Manager", "codeChallenge": challenge, "codeChallengeMethod": "S256"}, timeout=15)
        payload = response.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Porkbun could not be reached")
    if response.status_code >= 400 or not payload.get("authUrl"):
        raise HTTPException(status_code=400, detail=payload.get("message") or "Porkbun could not start authorization")
    connection = db.query(models.PorkbunConnection).first() or models.PorkbunConnection()
    connection.request_token = payload["requestToken"]
    connection.set_verifier(verifier)
    db.add(connection); db.commit()
    return {"auth_url": payload["authUrl"], "expires_at": payload.get("expiration")}


@router.post("/porkbun/connect/complete")
def complete_porkbun_connect(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    connection = db.query(models.PorkbunConnection).first()
    if not connection or not connection.request_token or not connection.verifier:
        raise HTTPException(status_code=400, detail="Start the Porkbun connection first")
    try:
        response = httpx.post(f"{PORKBUN_API}/apikey/retrieve", json={"requestToken": connection.request_token, "codeVerifier": connection.verifier}, timeout=15)
        payload = response.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Porkbun could not be reached")
    if payload.get("status") != "SUCCESS" or not payload.get("apikey") or not payload.get("secretapikey"):
        raise HTTPException(status_code=400, detail=payload.get("message") or "Porkbun approval is still pending")
    connection.set_credentials(payload["apikey"], payload["secretapikey"])
    connection.request_token = ""; connection.verifier_encrypted = ""; connection.connected_at = datetime.utcnow()
    db.commit()
    return {"connected": True}


@router.post("/domains")
def create_domain(data: schemas.DomainMappingCreate, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    domain = data.domain.strip().lower().removeprefix("https://").removeprefix("http://").split("/")[0]
    if not re.fullmatch(r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}", domain):
        raise HTTPException(status_code=400, detail="Enter a valid domain such as myshop.com")
    if db.query(models.DomainMapping).filter(models.DomainMapping.domain == domain).first():
        raise HTTPException(status_code=400, detail="This domain is already mapped")
    shop = db.get(models.Shop, data.shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    connection = db.query(models.PorkbunConnection).first()
    if not connection or not connection.api_key or not connection.secret_key:
        raise HTTPException(status_code=400, detail="Connect Porkbun before mapping a domain")
    destination = f"https://rovistar.shop/{shop.username}"
    auth = {"apikey": connection.api_key, "secretapikey": connection.secret_key}
    try:
        # Root wildcard forwarding also covers www and future subdomains in Porkbun.
        response = httpx.post(f"{PORKBUN_API}/domain/addUrlForward/{domain}", json={**auth, "subdomain": "", "location": destination, "type": "permanent", "includePath": "yes", "wildcard": "yes"}, timeout=15)
        payload = response.json()
        if payload.get("status") != "SUCCESS":
            raise HTTPException(status_code=400, detail=payload.get("message") or "Porkbun could not create the forward")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=502, detail="Porkbun could not create the domain forward")
    mapping = models.DomainMapping(shop_id=shop.id, domain=domain, status="active", dns_target=destination)
    db.add(mapping)
    log_activity(db, "add_domain_mapping", f"Admin mapped {domain} to {shop.username}", shop.id, admin)
    db.commit()
    return mapping.to_dict()


@router.get("/support")
def list_support(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    conversations = db.query(models.SupportConversation).order_by(models.SupportConversation.updated_at.desc()).all()
    output = []
    for conversation in conversations:
        item = conversation.to_dict()
        shop = db.get(models.Shop, conversation.shop_id)
        item["shop_name"] = shop.shop_name if shop else "Unknown shop"
        item["messages"] = [message.to_dict() for message in db.query(models.SupportMessage).filter(models.SupportMessage.conversation_id == conversation.id).order_by(models.SupportMessage.id).all()]
        output.append(item)
    return output


@router.post("/support/{conversation_id}/reply")
def admin_reply(conversation_id: int, data: schemas.SupportMessageCreate, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    conversation = db.get(models.SupportConversation, conversation_id)
    if not conversation or conversation.status != "open":
        raise HTTPException(status_code=404, detail="Open conversation not found")
    db.add(models.SupportMessage(conversation_id=conversation.id, sender="admin", body=data.body.strip()))
    conversation.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.get("/support/shop/{shop_id}")
def list_shop_support(shop_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Shop owners see only customer conversations for their own storefront."""
    require_shop_access(shop_id, user)
    conversations = db.query(models.SupportConversation).filter(
        models.SupportConversation.shop_id == shop_id
    ).order_by(models.SupportConversation.updated_at.desc()).all()
    output = []
    for conversation in conversations:
        item = conversation.to_dict()
        item["messages"] = [message.to_dict() for message in db.query(models.SupportMessage).filter(
            models.SupportMessage.conversation_id == conversation.id
        ).order_by(models.SupportMessage.id).all()]
        output.append(item)
    return output


@router.post("/support/shop/{shop_id}/{conversation_id}/reply")
def shop_reply(shop_id: int, conversation_id: int, data: schemas.SupportMessageCreate,
               db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    require_shop_access(shop_id, user)
    conversation = db.query(models.SupportConversation).filter(
        models.SupportConversation.id == conversation_id,
        models.SupportConversation.shop_id == shop_id,
        models.SupportConversation.status == "open",
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Open conversation not found")
    db.add(models.SupportMessage(conversation_id=conversation.id, sender="admin", body=data.body.strip()))
    conversation.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.post("/public/support")
def open_support(data: schemas.SupportConversationCreate, db: Session = Depends(get_db)):
    shop = db.get(models.Shop, data.shop_id)
    if not shop or shop.status != "active" or shop.is_expired():
        raise HTTPException(status_code=404, detail="Shop not found")
    conversation = models.SupportConversation(shop_id=shop.id, visitor_token=secrets.token_urlsafe(24), visitor_name=data.visitor_name.strip(), visitor_contact=data.visitor_contact.strip())
    db.add(conversation)
    db.flush()
    db.add(models.SupportMessage(conversation_id=conversation.id, sender="visitor", body=data.message.strip()))
    conversation.updated_at = datetime.utcnow()
    db.commit()
    dashboard_url = f"{config.BASE_URL.rstrip('/')}/admin/support"
    telegram_service.send_shop_notification(shop, f"💬 <b>New customer chat</b>\n🏪 {shop.shop_name or shop.username}\n👤 {conversation.visitor_name or 'Visitor'}\n💬 {data.message.strip()}\n\nOpen inbox: {dashboard_url}")
    return {"token": conversation.visitor_token}


@router.get("/public/support/{token}")
def get_public_support(token: str, db: Session = Depends(get_db)):
    conversation = db.query(models.SupportConversation).filter(models.SupportConversation.visitor_token == token).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": conversation.status, "messages": [item.to_dict() for item in db.query(models.SupportMessage).filter(models.SupportMessage.conversation_id == conversation.id).order_by(models.SupportMessage.id).all()]}


@router.post("/public/support/{token}/message")
def public_reply(token: str, data: schemas.SupportMessageCreate, db: Session = Depends(get_db)):
    conversation = db.query(models.SupportConversation).filter(models.SupportConversation.visitor_token == token, models.SupportConversation.status == "open").first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Open conversation not found")
    db.add(models.SupportMessage(conversation_id=conversation.id, sender="visitor", body=data.body.strip()))
    conversation.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}
