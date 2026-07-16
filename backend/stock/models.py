from django.conf import settings
from django.db import models

from products.models import Product


class StockEntry(models.Model):
    MATCHED = "matched"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    STATUS_CHOICES = [
        (MATCHED, "Matched"), (PENDING, "Pending"),
        (APPROVED, "Approved"), (REJECTED, "Rejected"),
    ]

    product_name = models.CharField(max_length=200)
    category = models.CharField(max_length=100, blank=True, default="")
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit = models.CharField(max_length=32, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=PENDING)
    matched_product = models.ForeignKey(
        Product, null=True, blank=True, on_delete=models.SET_NULL, related_name="stock_entries",
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="stock_recorded",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="stock_approved",
    )
    recorded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-recorded_at"]
