# Orders module — Django backend guide

This document describes the Django REST Framework endpoints the frontend
`orders-store` expects. Follow it to replace the localStorage stub.

## Model

```python
# orders/models.py
from django.db import models
from django.conf import settings

class Order(models.Model):
    CHANNEL_CHOICES = [("online", "Online"), ("in-person", "In-person")]
    STATUS_CHOICES = [
        ("pending", "Pending"), ("confirmed", "Confirmed"),
        ("preparing", "Preparing"), ("ready", "Ready"),
        ("delivered", "Delivered"), ("cancelled", "Cancelled"),
    ]
    reference = models.CharField(max_length=64, unique=True)
    external_id = models.CharField(max_length=128, blank=True, default="")
    store_source = models.CharField(max_length=64, blank=True, default="")
    channel = models.CharField(max_length=16, choices=CHANNEL_CHOICES)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="pending")

    customer_name = models.CharField(max_length=200)
    customer_phone = models.CharField(max_length=32, blank=True, default="")
    customer_email = models.EmailField(blank=True, default="")
    delivery_address = models.TextField(blank=True, default="")
    notes = models.TextField(blank=True, default="")

    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    placed_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="orders_created",
    )

class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey("products.Product", null=True, blank=True, on_delete=models.SET_NULL)
    product_name = models.CharField(max_length=200)  # snapshot
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)
```

## Serializers

```python
# orders/serializers.py
from rest_framework import serializers
from .models import Order, OrderItem

class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ["id", "product", "product_name", "quantity", "unit_price", "total"]

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)

    class Meta:
        model = Order
        fields = "__all__"
        read_only_fields = ["placed_at", "updated_at", "total"]

    def create(self, validated_data):
        items = validated_data.pop("items", [])
        total = sum(i["quantity"] * i["unit_price"] for i in items)
        order = Order.objects.create(total=total, **validated_data)
        for item in items:
            OrderItem.objects.create(order=order, total=item["quantity"] * item["unit_price"], **item)
        return order
```

## ViewSet

```python
# orders/views.py
from rest_framework import viewsets, decorators, response, permissions, status
from .models import Order
from .serializers import OrderSerializer
from .store_sync import push_status_to_store  # your integration

class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.prefetch_related("items").order_by("-placed_at")
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, channel="in-person")

    @decorators.action(detail=True, methods=["patch"], url_path="status")
    def set_status(self, request, pk=None):
        order = self.get_object()
        new_status = request.data.get("status")
        if new_status not in dict(Order.STATUS_CHOICES):
            return response.Response({"detail": "invalid status"}, status=400)
        order.status = new_status
        order.save(update_fields=["status", "updated_at"])
        if order.channel == "online":
            push_status_to_store(order)  # sync back to online store
        return response.Response(OrderSerializer(order).data)
```

## Webhook (from online store)

```python
# orders/webhook.py
import hmac, hashlib, json
from django.conf import settings
from django.http import JsonResponse, HttpResponseForbidden
from django.views.decorators.csrf import csrf_exempt
from .models import Order, OrderItem

@csrf_exempt
def orders_webhook(request):
    if request.method != "POST":
        return JsonResponse({"detail": "method not allowed"}, status=405)

    secret = request.headers.get("X-Webhook-Secret", "")
    if not hmac.compare_digest(secret, settings.ORDERS_WEBHOOK_SECRET):
        return HttpResponseForbidden("invalid signature")

    payload = json.loads(request.body.decode("utf-8"))
    items = payload.get("items", [])
    total = sum(i["quantity"] * i["unit_price"] for i in items)

    order, _ = Order.objects.update_or_create(
        reference=payload["reference"],
        defaults=dict(
            external_id=payload.get("external_id", ""),
            store_source=payload.get("store_source", ""),
            channel="online",
            status="pending",
            customer_name=payload["customer"]["name"],
            customer_phone=payload["customer"].get("phone", ""),
            customer_email=payload["customer"].get("email", ""),
            delivery_address=payload["customer"].get("address", ""),
            notes=payload.get("notes", ""),
            total=total,
        ),
    )
    order.items.all().delete()
    for item in items:
        OrderItem.objects.create(
            order=order,
            product_id=item.get("product_id"),
            product_name=item["name"],
            quantity=item["quantity"],
            unit_price=item["unit_price"],
            total=item["quantity"] * item["unit_price"],
        )
    return JsonResponse({"ok": True, "id": order.id}, status=202)
```

## Store sync (status back to online store)

`orders/store_sync.py` — implement `push_status_to_store(order)` to call your
online store's REST API. Store the API key/secret in Django settings via env
vars, never hard-coded.

## URLs

```python
# orders/urls.py
from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import OrderViewSet
from .webhook import orders_webhook

router = DefaultRouter()
router.register("orders", OrderViewSet, basename="orders")

urlpatterns = router.urls + [
    path("public/orders/webhook/", orders_webhook, name="orders-webhook"),
]
```

## Environment

```
ORDERS_WEBHOOK_SECRET=<long-random-string>
STORE_API_URL=<your online store base URL>
STORE_API_KEY=<key>
```

## Permissions

- `is_staff` (or a group like `orders_managers`) can update status.
- Any authenticated user can view orders.
- The webhook is public but signed with `X-Webhook-Secret`.
