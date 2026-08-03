from django.db.models import Q
from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from customers.models import Customer
from orders.models import Order
from sales.models import Invoice

from .search_serializers import (
    SearchCustomerSerializer as CustomerSerializer,
    SearchOrderSerializer as OrderSerializer,
    SearchInvoiceSerializer as InvoiceSerializer,
)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def global_search(request):
    """Simple global search across customers, orders, and invoices.

    Query parameters:
    - q: search term (required)
    - limit: per-entity result limit (optional, default 10, max 50)
    """
    q = (request.query_params.get("q") or "").strip()
    try:
        limit = int(request.query_params.get("limit") or 10)
    except (ValueError, TypeError):
        limit = 10
    limit = max(1, min(limit, 50))

    if not q:
        return Response({"customers": [], "orders": [], "invoices": []})

    # Include a global search version in the cache key so we can invalidate
    # all search caches by bumping the version on model changes.
    version = cache.get("global_search:version") or 1
    cache_key = f"global_search:v{version}:{q.lower()}:{limit}"
    cached = cache.get(cache_key)
    if cached is not None:
        return Response(cached)

    customer_q = (
        Q(name__icontains=q) | Q(company__icontains=q) |
        Q(contact_person__icontains=q) | Q(phone__icontains=q) | Q(email__icontains=q)
    )
    order_q = (
        Q(reference__icontains=q) | Q(external_id__icontains=q) |
        Q(customer_name__icontains=q) | Q(customer_phone__icontains=q) | Q(customer_email__icontains=q) |
        Q(store_source__icontains=q)
    )
    invoice_q = Q(invoice_number__icontains=q) | Q(customer__name__icontains=q)

    customers = Customer.objects.filter(customer_q).order_by("name")[:limit]
    orders = Order.objects.filter(order_q).order_by("-placed_at")[:limit]
    invoices = Invoice.objects.filter(invoice_q).order_by("-issue_date")[:limit]

    payload = {
        "customers": CustomerSerializer(customers, many=True).data,
        "orders": OrderSerializer(orders, many=True).data,
        "invoices": InvoiceSerializer(invoices, many=True).data,
    }
    # Cache for 60 seconds.
    try:
        cache.set(cache_key, payload, 60)
    except Exception:
        # Be resilient if cache backend misconfigured.
        pass
    return Response(payload)
