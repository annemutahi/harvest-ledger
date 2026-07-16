from decimal import Decimal

from django.conf import settings
from django.db import models

from products.models import Product


class Order(models.Model):
    ONLINE = "online"
    IN_PERSON = "in-person"
    CHANNEL_CHOICES = [(ONLINE, "Online"), (IN_PERSON, "In-person")]

    PENDING = "pending"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    READY = "ready"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (PENDING, "Pending"), (CONFIRMED, "Confirmed"), (PREPARING, "Preparing"),
        (READY, "Ready"), (DELIVERED, "Delivered"), (CANCELLED, "Cancelled"),
    ]

    reference = models.CharField(max_length=64, unique=True)
    external_id = models.CharField(max_length=128, blank=True, default="")
    store_source = models.CharField(max_length=64, blank=True, default="")
    channel = models.CharField(max_length=16, choices=CHANNEL_CHOICES, default=IN_PERSON)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=PENDING)

    customer_name = models.CharField(max_length=200)
    customer_phone = models.CharField(max_length=32, blank=True, default="")
    customer_email = models.EmailField(blank=True, default="")
    delivery_address = models.TextField(blank=True, default="")
    notes = models.TextField(blank=True, default="")

    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    placed_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="orders_created",
    )

    class Meta:
        ordering = ["-placed_at"]


class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey(
        Product, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="order_items",
    )
    product_name = models.CharField(max_length=200)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total = models.DecimalField(max_digits=14, decimal_places=2)

    def save(self, *args, **kwargs):
        self.total = Decimal(self.quantity or 0) * Decimal(self.unit_price or 0)
        if self.product and not self.product_name:
            self.product_name = self.product.name
        super().save(*args, **kwargs)
