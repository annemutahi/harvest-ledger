import hmac
import json
import logging

from django.conf import settings
from django.http import JsonResponse, HttpResponseForbidden, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt
from rest_framework import decorators, response, status, viewsets
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import module_permission
from accounts.roles import has_perm
from farm_erp.date_filter import apply_date_range

from .models import Order, OrderItem
from .serializers import OrderSerializer

log = logging.getLogger(__name__)


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.prefetch_related("items")
    serializer_class = OrderSerializer
    permission_classes = [module_permission("orders")]
    filterset_fields = ["status", "channel"]
    search_fields = ["reference", "customer_name", "customer_phone", "customer_email"]
    ordering_fields = ["placed_at", "total"]

    def get_queryset(self):
        return apply_date_range(super().get_queryset(), self.request, "placed_at")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, channel=Order.IN_PERSON)

    @decorators.action(detail=True, methods=["patch"])
    def status(self, request, pk=None):
        if not has_perm(request.user, "orders", "change"):
            return response.Response({"detail": "forbidden"},
                                     status=status.HTTP_403_FORBIDDEN)
        order = self.get_object()
        new_status = request.data.get("status")
        if new_status not in dict(Order.STATUS_CHOICES):
            return response.Response({"detail": "invalid status"},
                                     status=status.HTTP_400_BAD_REQUEST)
        order.status = new_status
        order.save(update_fields=["status", "updated_at"])
        if order.channel == Order.ONLINE:
            try:
                from .store_sync import push_status_to_store
                push_status_to_store(order)
            except Exception as exc:  # never fail the local update
                log.warning("push_status_to_store failed for %s: %s", order.reference, exc)
        return response.Response(OrderSerializer(order).data)


@csrf_exempt
def webhook(request):
    """Public webhook: online store POSTs new orders here.

    Auth is a shared secret in the `X-Webhook-Secret` header, compared with
    hmac.compare_digest to prevent timing attacks. No user session required.
    """
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    expected = settings.ORDERS_WEBHOOK_SECRET or ""
    provided = request.headers.get("X-Webhook-Secret", "")
    if not expected or not hmac.compare_digest(expected.encode(), provided.encode()):
        return HttpResponseForbidden("invalid signature")

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({"detail": "invalid json"}, status=400)

    ref = payload.get("reference")
    customer = payload.get("customer") or {}
    items = payload.get("items") or []
    if not ref or not customer.get("name") or not isinstance(items, list) or not items:
        return JsonResponse({"detail": "missing required fields"}, status=400)

    total = sum(float(i["quantity"]) * float(i["unit_price"]) for i in items)

    order, _created = Order.objects.update_or_create(
        reference=ref,
        defaults=dict(
            external_id=payload.get("external_id", ""),
            store_source=payload.get("store_source", ""),
            channel=Order.ONLINE,
            status=Order.PENDING,
            customer_name=customer["name"],
            customer_phone=customer.get("phone", ""),
            customer_email=customer.get("email", ""),
            delivery_address=customer.get("address", ""),
            notes=payload.get("notes", ""),
            total=total,
        ),
    )
    order.items.all().delete()
    for i in items:
        OrderItem.objects.create(
            order=order,
            product_name=i.get("name", ""),
            quantity=i["quantity"],
            unit_price=i["unit_price"],
        )
    return JsonResponse({"ok": True, "id": order.id, "reference": order.reference}, status=202)
