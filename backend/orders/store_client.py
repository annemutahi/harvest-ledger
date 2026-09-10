"""Pull orders from the online store (Peaceful Acres Farm Store).

The store exposes a machine-to-machine feed:

    GET  {STORE_API_URL}/orders/?unsynced=true&limit=100   -> { count, orders: [...] }
    POST {STORE_API_URL}/orders/                            -> acknowledge / push status

Both are authenticated with the shared key `STORE_API_KEY`, sent in the
`X-API-Key` header. Store order rows look like:

    {
      "id": "<uuid>", "status": "paid",
      "items": [{"productId","name","unit","price","quantity"}],
      "contact": {"fullName","email","phone"},
      "delivery": {"address","city","notes"},
      "payment_method": "mpesa", "payment_ref": "...",
      "subtotal": 1234.00, "created_at": "..."
    }
"""
from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import transaction

from products.models import Product

from .models import Order, OrderItem

log = logging.getLogger(__name__)

TIMEOUT = 15

# store status -> ERP status
STATUS_IN = {
    "pending": Order.PENDING,
    "awaiting_payment": Order.PENDING,
    "paid": Order.CONFIRMED,
    "processing": Order.PREPARING,
    "dispatched": Order.READY,
    "delivered": Order.DELIVERED,
    "cancelled": Order.CANCELLED,
    "failed": Order.CANCELLED,
}

# ERP status -> store status
STATUS_OUT = {
    Order.PENDING: "pending",
    Order.CONFIRMED: "processing",
    Order.PREPARING: "processing",
    Order.READY: "dispatched",
    Order.DELIVERED: "delivered",
    Order.CANCELLED: "cancelled",
}


def is_configured() -> bool:
    return bool(settings.STORE_API_URL and settings.STORE_API_KEY)


def _url(path: str) -> str:
    return f"{settings.STORE_API_URL.rstrip('/')}/{path.lstrip('/')}"


def _call(method: str, path: str, body: dict | None = None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(_url(path), data=data, method=method)
    req.add_header("Accept", "application/json")
    req.add_header("X-API-Key", settings.STORE_API_KEY)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:  # noqa: S310 (fixed host)
        raw = resp.read().decode("utf-8") or "{}"
    return json.loads(raw)


def _dec(value, default="0") -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


@transaction.atomic
def _import_order(row: dict) -> Order | None:
    store_id = str(row.get("id") or "").strip()
    if not store_id:
        return None

    contact = row.get("contact") or {}
    delivery = row.get("delivery") or {}
    items = row.get("items") or []
    if not isinstance(items, list):
        items = []

    reference = f"WEB-{store_id.replace('-', '')[:10].upper()}"
    address = ", ".join(
        part for part in [delivery.get("address"), delivery.get("city")] if part
    )
    notes_parts = [delivery.get("notes") or ""]
    if row.get("payment_method"):
        notes_parts.append(f"Paid via {row['payment_method']}")
    if row.get("payment_ref"):
        notes_parts.append(f"Ref {row['payment_ref']}")

    total = _dec(row.get("subtotal")) or sum(
        (_dec(i.get("quantity")) * _dec(i.get("price")) for i in items), Decimal("0")
    )

    order, _created = Order.objects.update_or_create(
        external_id=store_id,
        defaults=dict(
            reference=reference,
            store_source="online-store",
            channel=Order.ONLINE,
            status=STATUS_IN.get(str(row.get("status") or ""), Order.PENDING),
            customer_name=(contact.get("fullName") or "Online customer")[:200],
            customer_phone=(contact.get("phone") or "")[:32],
            customer_email=contact.get("email") or "",
            delivery_address=address,
            notes=" • ".join(p for p in notes_parts if p),
            total=total,
        ),
    )

    order.items.all().delete()
    for i in items:
        name = str(i.get("name") or "Item")[:200]
        product = Product.objects.filter(name__iexact=name).first()
        OrderItem.objects.create(
            order=order,
            product=product,
            product_name=name,
            quantity=_dec(i.get("quantity"), "1"),
            unit_price=_dec(i.get("price")),
        )
    return order


def pull_orders(limit: int = 100) -> dict:
    """Fetch un-synced store orders, import them, and acknowledge each one."""
    if not is_configured():
        return {"ok": False, "detail": "Store integration is not configured.",
                "imported": 0, "failed": 0}

    try:
        payload = _call("GET", f"orders/?unsynced=true&limit={int(limit)}")
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError, TimeoutError) as exc:
        log.warning("store order pull failed: %s", exc)
        return {"ok": False, "detail": f"Could not reach the online store: {exc}",
                "imported": 0, "failed": 0}

    rows = payload.get("orders") or []
    imported, failed = 0, 0
    for row in rows:
        try:
            order = _import_order(row)
            if order is None:
                failed += 1
                continue
            imported += 1
            try:
                _call("POST", "orders/", {
                    "order_id": row.get("id"),
                    "erp_order_ref": order.reference,
                })
            except Exception as exc:  # ack failure => re-imported next run, harmless
                log.warning("store ack failed for %s: %s", order.reference, exc)
        except Exception as exc:
            failed += 1
            log.exception("failed to import store order %s: %s", row.get("id"), exc)

    return {"ok": True, "imported": imported, "failed": failed, "fetched": len(rows)}
