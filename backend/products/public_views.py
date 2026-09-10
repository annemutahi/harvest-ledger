"""Public product feed consumed by the online store.

The store calls `GET {ERP_API_URL}/products/` (with ERP_API_URL pointing at
`https://<erp-host>/api/public`) and authenticates with a shared token sent as
`Authorization: Token <STORE_FEED_TOKEN>` or `X-API-Key`.
"""
from __future__ import annotations

import hmac

from django.conf import settings
from django.http import HttpResponseForbidden, HttpResponseNotAllowed, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import Product


def _authorized(request) -> bool:
    expected = settings.STORE_FEED_TOKEN or ""
    if not expected:
        return False
    provided = (
        request.headers.get("X-API-Key")
        or request.headers.get("Authorization", "").replace("Token ", "").replace("Bearer ", "")
    )
    return bool(provided) and hmac.compare_digest(expected.encode(), provided.encode())


@csrf_exempt
def product_feed(request):
    if request.method not in ("GET", "HEAD"):
        return HttpResponseNotAllowed(["GET"])
    if not _authorized(request):
        return HttpResponseForbidden("invalid token")

    products = Product.objects.filter(active=True).order_by("name")
    data = [
        {
            "id": str(p.id),
            "name": p.name,
            "category": p.category or "produce",
            "unit_price": float(p.unit_price),
            "unit": p.unit,
            "description": p.description,
            "stock_qty": float(p.available_quantity),
            "in_stock": p.available_quantity > 0,
        }
        for p in products
    ]
    return JsonResponse({"count": len(data), "results": data})
