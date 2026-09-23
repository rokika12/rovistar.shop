"""Order endpoints: public create/list, owner management, receipts."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from datetime import datetime

import models
import schemas
from config import config
from database import get_db
from security import (get_optional_customer, get_current_admin, get_current_customer, get_current_shop_user, get_current_user,
                      log_activity, require_shop_access)
from services import pdf_service
from services import stock_service
from utils.helpers import generate_order_number
from routers.auth import _verify_email_token
from routers.payments import _mark_paid, _process_first_payment

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.post("")
def create_order(data: schemas.OrderCreate, db: Session = Depends(get_db),
                 customer: models.Customer = Depends(get_optional_customer)):
    """
    Create an order. REQUIRES a valid customer JWT (real Telegram login).

    If the customer is not logged in via Telegram, this returns 401 so the
    storefront blocks checkout until the user logs in.
    """
    shop = db.query(models.Shop).filter(models.Shop.id == data.shop_id).first()
    if not shop or shop.status != "active":
        raise HTTPException(status_code=404, detail="Shop not found or unavailable")
    if not data.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")
    if customer and customer.shop_id != data.shop_id:
        raise HTTPException(status_code=403, detail="This account is not registered at this shop")

    customer_email = (data.customer_email or "").strip().lower()
    if config.REQUIRE_ORDER_EMAIL_VERIFICATION and customer_email:
        token = (data.email_verification_token or "").strip()
        if not _verify_email_token(db, data.shop_id, customer_email, token):
            raise HTTPException(status_code=400, detail="Please verify your email before placing the order")

    payment_method = (data.payment_method or "khqr").lower()
    if payment_method not in ("khqr", "wallet"):
        raise HTTPException(status_code=400, detail="Invalid payment method")

    # Link the order to the logged-in Telegram customer
    customer_telegram = data.customer_telegram or (customer.telegram if customer else "") or (f"tg{customer.telegram_id}" if customer else "")
    order = models.Order(
        shop_id=data.shop_id,
        customer_id=customer.id if customer else None,
        order_number=generate_order_number(data.shop_id),
        customer_name=data.customer_name or (customer.name if customer else "Digital Customer"),
        customer_email=data.customer_email,
        customer_phone=data.customer_phone or (customer.phone if customer else "digital"),
        customer_telegram=customer_telegram if customer else "",
        customer_address=data.customer_address,
        customer_city=data.customer_city,
        customer_country=data.customer_country,
        customer_note=data.customer_note,
        shipping_fee=data.shipping_fee,
        discount=data.discount,
        currency=data.currency or shop.currency or "USD",
    )

    items_total = 0.0
    digital_only = True
    manual_service_links = []
    for item in data.items:
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        item_variations = dict(item.variations or {})
        if not product or product.shop_id != data.shop_id:
            raise HTTPException(status_code=400, detail=f"Product #{item.product_id} is not available in this shop")
        unit_price = product.sale_price if product.sale_price is not None else product.price
        product_meta = models.JSONText.loads(product.metadata_json, {})
        if product.status != "active":
            raise HTTPException(status_code=400, detail=f"Product #{item.product_id} is not available")
        if (product_meta.get("fulfillment_type") == "manual_service"
                and product_meta.get("manual_service_out_of_stock")):
            raise HTTPException(status_code=400, detail="This manual service is out of stock")
        # Package choices apply only to manual services. Regular products can
        # retain optional variations without blocking checkout.
        variations = models.JSONText.loads(product.variations, []) if product.variations else []
        variation_keys = {key for variation in variations for key in (variation.get("attrs") or {})}
        if product_meta.get("fulfillment_type") == "manual_service" and variation_keys:
            selected = {str(key).strip().lower(): value for key, value in item_variations.items()}
            match = next((variation for variation in variations if all(
                str((variation.get("attrs") or {}).get(key)) == str(selected.get(str(key).strip().lower()))
                for key in variation_keys
            )), None)
            if not match:
                raise HTTPException(status_code=400, detail="Please choose a valid service package")
            if match.get("price") is not None:
                unit_price = float(match["price"])
        # Stock is NOT deducted here — it is deducted automatically when the
        # payment is confirmed successful (see payments._mark_paid).
        items_total += float(unit_price) * item.quantity
        digital_only = digital_only and product_meta.get("product_type") == "digital"
        if product_meta.get("fulfillment_type") == "manual_service":
            service_link = str(item_variations.get("_service_link") or "").strip()
            service_platform = str(product_meta.get("service_platform") or "").lower()
            telegram_service = service_platform in {"telegram", "telegram_premium", "telegram_star"}
            game_target = service_platform in {"free_fire", "mobile_legends", "roblox"}
            valid_target = (
                bool(__import__("re").fullmatch(r"@[A-Za-z][A-Za-z0-9_]{4,31}", service_link))
                if telegram_service else bool(service_link)
                if game_target else service_link.startswith(("https://", "http://"))
            )
            if len(service_link) > 2048 or not valid_target:
                raise HTTPException(status_code=400, detail="Please enter a valid Telegram username" if telegram_service else "Please enter valid game account details" if game_target else "Please enter a valid public service link before payment")
            item_variations["_service_link"] = service_link
            service_video_url = str(product_meta.get("service_video_url") or "").strip()
            if service_video_url:
                item_variations["_service_video_url"] = service_video_url
            manual_service_links.append(service_link)
        delivery = None
        if product_meta.get("product_type") == "digital":
            pool = (product_meta.get("digital_delivery") or {}).get("credentials") or []
            delivery = pool[0] if pool else product_meta.get("digital_delivery")
        if delivery:
            item_variations["_digital_delivery"] = delivery
        db.add(models.OrderItem(
            order=order,
            product_id=item.product_id,
            product_name=item.name or (product.name if product else "Product"),
            price=float(unit_price),
            quantity=item.quantity,
            variations=models.JSONText.dumps(item_variations),
        ))

    order.items_total = round(items_total, 2)
    order.total = round(items_total + float(data.shipping_fee) - float(data.discount), 2)
    order.payment_method = payment_method
    if payment_method == "wallet":
        if not customer or not digital_only:
            raise HTTPException(status_code=400, detail="Wallet payment is available for digital products only")
        if float(customer.wallet_balance or 0) < order.total:
            raise HTTPException(status_code=400, detail="Insufficient wallet balance")
        customer.wallet_balance = round(float(customer.wallet_balance or 0) - order.total, 2)
        db.add(models.WalletTransaction(customer_id=customer.id, shop_id=data.shop_id,
                                        amount=-order.total, transaction_type="purchase",
                                        reference=order.order_number, note="Digital product purchase"))
        order.payment_status = "paid"
        order.paid_at = datetime.utcnow()
    if order.total <= 0:
        order.payment_status = "paid"
        order.paid_at = datetime.utcnow()

    # Upsert customer for the shop (the logged-in Telegram customer is primary)
    existing = db.query(models.Customer).filter(
        models.Customer.shop_id == data.shop_id,
        models.Customer.telegram_id == customer.telegram_id).first() if customer else None
    if not existing:
        existing = db.query(models.Customer).filter(
            models.Customer.shop_id == data.shop_id,
            models.Customer.phone == data.customer_phone,
            models.Customer.name == data.customer_name).first()
    if customer and existing:
        existing.telegram_id = customer.telegram_id or existing.telegram_id
        existing.telegram = data.customer_telegram or customer.telegram or existing.telegram
        existing.phone = data.customer_phone or existing.phone
        existing.address = data.customer_address or existing.address
        existing.city = data.customer_city or existing.city
        existing.country = data.customer_country or existing.country
        existing.email = data.customer_email or existing.email
    elif customer:
        db.add(models.Customer(
            shop_id=data.shop_id, name=data.customer_name or customer.name,
            phone=data.customer_phone or customer.phone,
            telegram=data.customer_telegram or customer.telegram,
            telegram_id=customer.telegram_id,
            email=data.customer_email, address=data.customer_address,
            city=data.customer_city, country=data.customer_country))

    db.add(order)
    db.commit()
    db.refresh(order)

    if order.payment_status == "paid":
        stock_service.deduct_stock_for_order(db, order)
        for item in order.items:
            product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
            metadata = models.JSONText.loads(product.metadata_json, {}) if product else {}
            delivery = models.JSONText.loads(item.variations, {}).get("_digital_delivery")
            pool = (metadata.get("digital_delivery") or {}).get("credentials") or []
            if delivery and pool:
                metadata["digital_delivery"]["credentials"] = [entry for entry in pool if entry != delivery]
                product.metadata_json = models.JSONText.dumps(metadata)
        db.commit()
        db.refresh(order)
        # Free and wallet orders are paid immediately. Run the same receipt and
        # full Telegram notification path as a confirmed ABA payment.
        shop = db.query(models.Shop).filter(models.Shop.id == order.shop_id).first()
        if shop:
            _process_first_payment(db, order, shop)

    # NOTE: no "new order" Telegram notification here — the shop's Telegram group
    # only receives a message when the payment is CONFIRMED SUCCESSFUL
    # (full details + updated stock; see payments._process_first_payment).

    log_activity(db, "create_order", f"New order #{order.order_number} ({order.total} {order.currency})",
                 data.shop_id)
    db.commit()
    return order.to_dict()


@router.post("/{order_id}/service-request")
def submit_service_request(order_id: int, data: schemas.ServiceRequestSubmit,
                           db: Session = Depends(get_db),
                           customer: models.Customer = Depends(get_current_customer)):
    """Save a paid manual-service link and send it to the shop's configured Telegram chat."""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.customer_id != customer.id or order.shop_id != customer.shop_id:
        raise HTTPException(status_code=403, detail="You do not have access to this order")
    if order.payment_status != "paid":
        raise HTTPException(status_code=400, detail="Payment must be confirmed before sending a service link")

    requested = any(
        bool(models.JSONText.loads(item.variations, {}).get("_service_request_required"))
        for item in order.items
    )
    if not requested:
        raise HTTPException(status_code=400, detail="This order does not need a service link")

    link = data.link.strip()
    if not link.startswith(("https://", "http://")):
        raise HTTPException(status_code=400, detail="Please enter a valid public link")
    note = data.note.strip()
    order.customer_note = f"[service-request]\nLink: {link}\nNote: {note}".rstrip()
    order.order_status = "processing"
    db.commit()
    db.refresh(order)

    shop = db.query(models.Shop).filter(models.Shop.id == order.shop_id).first()
    notified = False
    if shop:
        from services.telegram_service import notify_shop_service_request
        notified = notify_shop_service_request(shop, order, link, note)
    log_activity(db, "service_request", f"Customer submitted service link for #{order.order_number}", order.shop_id)
    db.commit()
    return {"order": order.to_dict(), "notified": notified}


@router.post("/pos")
def create_pos_order(data: schemas.POSOrderCreate, db: Session = Depends(get_db),
                     user: models.User = Depends(get_current_shop_user)):
    """
    POS sale created by the shop owner.
      - payment_method 'cash' (បង់ប្រាក់ផ្ទាល់): order is paid immediately →
        stock is deducted and the full payment-success message is sent to Telegram.
      - payment_method 'khqr': order stays pending; the frontend then calls
        /api/payments/aba/create and only when payment is confirmed does stock
        decrease and Telegram get notified.
    """
    require_shop_access(data.shop_id, user)
    shop = db.query(models.Shop).filter(models.Shop.id == data.shop_id).first()
    if not shop or shop.status != "active":
        raise HTTPException(status_code=404, detail="Shop not found")
    if not data.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")

    order = models.Order(
        shop_id=data.shop_id,
        order_number=generate_order_number(data.shop_id),
        customer_name=data.customer_name or "POS Customer",
        customer_phone=data.customer_phone or "",
        customer_note=data.customer_note or "POS sale",
        shipping_fee=0,
        discount=data.discount or 0,
        currency=shop.currency or "USD",
        payment_method=data.payment_method if data.payment_method in ("cash", "khqr") else "cash",
    )

    items_total = 0.0
    for item in data.items:
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if not product or product.shop_id != data.shop_id:
            raise HTTPException(status_code=400, detail=f"Product #{item.product_id} not found in this shop")

        # Resolve price: variation price > sale price > base price.
        unit_price = product.sale_price if product.sale_price is not None else product.price
        if item.variations:
            try:
                variations = models.JSONText.loads(product.variations, []) if product.variations else []
                for v in variations:
                    attrs = v.get("attrs") or {}
                    if all(str(attrs.get(k)) == str(val) for k, val in (item.variations or {}).items()):
                        if v.get("price"):
                            unit_price = float(v["price"])
                        break
            except Exception:
                pass

        items_total += float(unit_price or 0) * int(item.quantity or 1)
        db.add(models.OrderItem(
            order=order,
            product_id=item.product_id,
            product_name=item.name or product.name,
            price=round(float(unit_price or 0), 2),
            quantity=item.quantity,
            variations=models.JSONText.dumps(item.variations or {}),
        ))

    order.items_total = round(items_total, 2)
    order.total = round(items_total - float(data.discount or 0), 2)
    db.add(order)
    db.commit()
    db.refresh(order)

    log_activity(db, "pos_order", f"{user.username} created POS order #{order.order_number} "
                 f"({order.total} {order.currency})", data.shop_id, user)
    db.commit()

    result = {"order": order.to_dict(), "paid": False}

    # Cash payment (បង់ប្រាក់ផ្ទាល់): mark paid now → stock deducts + Telegram sends.
    if order.payment_method == "cash":
        newly = _mark_paid(db, order, f"POS-{order.id}", order.total)
        if newly:
            _process_first_payment(db, order, shop)
        db.refresh(order)
        result["paid"] = True
        result["order"] = order.to_dict()

    return result


@router.post("/public/history")
def customer_order_history(data: schemas.CustomerHistoryRequest, db: Session = Depends(get_db)):
    """
    Customer order history (secure per-shop).

    The customer "logs in" with their phone number and/or Telegram username —
    matching ONLY their own orders for this shop, so one customer cannot see
    another customer's history. At least one of phone / telegram is required.
    """
    if not data.phone.strip() and not data.telegram.strip():
        raise HTTPException(status_code=400,
                            detail="Please provide your phone number or Telegram username")

    q = db.query(models.Order).filter(models.Order.shop_id == data.shop_id)
    if data.phone.strip() and data.telegram.strip():
        q = q.filter(or_(models.Order.customer_phone == data.phone.strip(),
                         models.Order.customer_telegram == data.telegram.strip()))
    elif data.phone.strip():
        q = q.filter(models.Order.customer_phone == data.phone.strip())
    else:
        q = q.filter(models.Order.customer_telegram == data.telegram.strip())

    orders = q.order_by(models.Order.id.desc()).all()
    return {
        "shop_id": data.shop_id,
        "customer": {
            "phone": data.phone.strip(),
            "telegram": data.telegram.strip(),
        },
        "count": len(orders),
        "orders": [o.to_dict() for o in orders],
    }


@router.get("/public/track")
def track_order(order_number: str = Query(...), db: Session = Depends(get_db),
                customer: models.Customer = Depends(get_optional_customer)):
    order = db.query(models.Order).filter(models.Order.order_number == order_number).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    result = order.to_dict()
    # Paid digital guest orders need to remain visible to the buyer even without a
    # customer login, because the order number is stored in the browser as a guest
    # tracking reference. We still keep non-paid or unrelated orders hidden.
    owns_order = bool(customer and order.customer_id == customer.id)
    is_guest_digital_order = (
        order.payment_status == "paid"
        and (
            order.customer_id is None
            or str(order.customer_phone or "").lower() == "digital"
            or str(order.customer_name or "").lower() == "digital customer"
        )
    )
    if not owns_order and not is_guest_digital_order:
        for item in result.get("items", []):
            item.pop("digital_delivery", None)
    return result


@router.get("")
def list_orders(shop_id: int = Query(...), status: str = "",
                db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    require_shop_access(shop_id, user)
    q = db.query(models.Order).filter(models.Order.shop_id == shop_id)
    if status:
        q = q.filter(models.Order.order_status == status)
    orders = q.order_by(models.Order.id.desc()).all()
    return [o.to_dict() for o in orders]


@router.get("/all")
def list_all_orders(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    orders = db.query(models.Order).order_by(models.Order.id.desc()).limit(500).all()
    return [o.to_dict() for o in orders]


@router.get("/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db),
              user: models.User = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    require_shop_access(order.shop_id, user)
    return order.to_dict()


@router.put("/{order_id}/status")
def update_order_status(order_id: int, data: schemas.OrderStatusUpdate, db: Session = Depends(get_db),
                        user: models.User = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    require_shop_access(order.shop_id, user)
    if data.order_status:
        order.order_status = data.order_status
    if data.payment_status:
        order.payment_status = data.payment_status
    log_activity(db, "update_order", f"{user.username} updated order #{order.order_number} "
                 f"(status={order.order_status}, payment={order.payment_status})", order.shop_id, user)
    db.commit()
    return order.to_dict()


@router.get("/{order_id}/receipt")
def generate_order_receipt(order_id: int, db: Session = Depends(get_db),
                           user: models.User = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    require_shop_access(order.shop_id, user)
    shop = db.query(models.Shop).filter(models.Shop.id == order.shop_id).first()
    items = [i.to_dict() for i in order.items]
    try:
        url = pdf_service.generate_receipt(order, shop, items)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Receipt generation failed: {e}")
    order.receipt_url = url
    db.commit()
    return {"receipt_url": url}


@router.delete("/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db),
                 user: models.User = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    require_shop_access(order.shop_id, user)
    db.delete(order)
    db.commit()
    return {"ok": True}
