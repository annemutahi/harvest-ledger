from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from customers.models import Customer
from products.models import Product


class Invoice(models.Model):
    UNPAID = "unpaid"
    PARTIAL = "partially_paid"
    PAID = "paid"
    OVERDUE = "overdue"
    STATUS_CHOICES = [
        (UNPAID, "Unpaid"), (PARTIAL, "Partially Paid"),
        (PAID, "Paid"), (OVERDUE, "Overdue"),
    ]

    invoice_number = models.CharField(max_length=32, unique=True)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="invoices")
    issue_date = models.DateField(default=timezone.now)
    due_date = models.DateField()
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=UNPAID)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-issue_date", "-id"]

    def recompute_status(self):
        if self.amount_paid >= self.total_amount and self.total_amount > 0:
            self.status = self.PAID
        elif self.amount_paid > 0:
            self.status = self.PARTIAL
        elif self.due_date < timezone.localdate():
            self.status = self.OVERDUE
        else:
            self.status = self.UNPAID

    @property
    def outstanding_balance(self):
        return (self.total_amount or 0) - (self.amount_paid or 0)


class Sale(models.Model):
    CASH = "cash"
    CREDIT = "credit"
    PAYMENT_TYPE_CHOICES = [(CASH, "Cash"), (CREDIT, "Credit")]

    invoice = models.OneToOneField(Invoice, on_delete=models.CASCADE, related_name="sale")
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="sales")
    date = models.DateField(default=timezone.now)
    payment_type = models.CharField(max_length=16, choices=PAYMENT_TYPE_CHOICES, default=CREDIT)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="sales_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    product_name = models.CharField(max_length=200)  # snapshot
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    line_total = models.DecimalField(max_digits=14, decimal_places=2)

    def save(self, *args, **kwargs):
        self.line_total = Decimal(self.quantity) * Decimal(self.unit_price)
        if self.product and not self.product_name:
            self.product_name = self.product.name
        super().save(*args, **kwargs)


class Payment(models.Model):
    CASH = "cash"
    BANK = "bank_transfer"
    MOBILE = "mobile_money"
    CHEQUE = "cheque"
    METHOD_CHOICES = [
        (CASH, "Cash"), (BANK, "Bank Transfer"),
        (MOBILE, "Mobile Money"), (CHEQUE, "Cheque"),
    ]

    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="payments")
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="payments")
    date = models.DateField(default=timezone.now)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default=CASH)
    notes = models.TextField(blank=True, default="")
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="payments_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]
