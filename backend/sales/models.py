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
    CREDIT = "credit"
    STATUS_CHOICES = [
        (UNPAID, "Unpaid"), (PARTIAL, "Partially Paid"),
        (PAID, "Paid"), (OVERDUE, "Overdue"), (CREDIT, "Credit"),
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
        if self.available_credit > 0:
            self.status = self.CREDIT
        elif self.amount_paid >= self.total_amount and self.total_amount > 0:
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

    @property
    def available_credit(self):
        used = sum((application.amount for application in self.credit_uses.all()), Decimal("0"))
        return max((self.amount_paid or 0) - (self.total_amount or 0) - used, Decimal("0"))


class InvoiceAdjustment(models.Model):
    DEBIT = "debit"
    CREDIT = "credit"
    KIND_CHOICES = [(DEBIT, "Debit"), (CREDIT, "Credit")]

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="adjustments")
    kind = models.CharField(max_length=10, choices=KIND_CHOICES)
    previous_total = models.DecimalField(max_digits=14, decimal_places=2)
    new_total = models.DecimalField(max_digits=14, decimal_places=2)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="invoice_adjustments_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class CreditApplication(models.Model):
    """Records the use of excess payment on one invoice against another."""

    source_invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="credit_uses")
    target_invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="credit_applications")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="credit_application_amount_positive"),
        ]


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
    date = models.DateField(default=timezone.localdate)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default=CASH)
    notes = models.TextField(blank=True, default="")
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="payments_recorded",
    )
    idempotency_key = models.CharField(
        max_length=64, null=True, blank=True, unique=True, db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]
