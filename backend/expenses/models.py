from decimal import Decimal

from django.conf import settings
from django.db import models


class Supplier(models.Model):
    name = models.CharField(max_length=200)
    contact_person = models.CharField(max_length=200, blank=True, default="")
    phone = models.CharField(max_length=32, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]


class Purchase(models.Model):
    supplier = models.ForeignKey(
        Supplier, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="purchases",
    )
    supplier_name = models.CharField(max_length=200)  # snapshot
    date = models.DateField()
    category = models.CharField(max_length=100)
    item = models.CharField(max_length=200)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1)
    unit = models.CharField(max_length=32, blank=True, default="")
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2)
    total = models.DecimalField(max_digits=14, decimal_places=2)
    payment_method = models.CharField(max_length=32, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="purchases_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]

    def save(self, *args, **kwargs):
        self.total = Decimal(self.quantity or 0) * Decimal(self.unit_cost or 0)
        if self.supplier and not self.supplier_name:
            self.supplier_name = self.supplier.name
        super().save(*args, **kwargs)


class CasualWorker(models.Model):
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=32, blank=True, default="")
    daily_rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]


class CasualWage(models.Model):
    worker = models.ForeignKey(
        CasualWorker, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="wages",
    )
    worker_name = models.CharField(max_length=200)
    date = models.DateField()
    days_worked = models.DecimalField(max_digits=6, decimal_places=2, default=1)
    rate_per_day = models.DecimalField(max_digits=12, decimal_places=2)
    total = models.DecimalField(max_digits=14, decimal_places=2)
    task = models.CharField(max_length=200, blank=True, default="")
    paid = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="wages_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]

    def save(self, *args, **kwargs):
        self.total = Decimal(self.days_worked or 0) * Decimal(self.rate_per_day or 0)
        if self.worker and not self.worker_name:
            self.worker_name = self.worker.name
        super().save(*args, **kwargs)
