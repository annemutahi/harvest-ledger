from django.db import models


class Customer(models.Model):
    INDIVIDUAL = "individual"
    CORPORATE = "corporate"
    TYPE_CHOICES = [(INDIVIDUAL, "Individual"), (CORPORATE, "Corporate")]

    name = models.CharField(max_length=200)
    type = models.CharField(max_length=16, choices=TYPE_CHOICES, default=INDIVIDUAL)
    company = models.CharField(max_length=200, blank=True, default="")
    contact_person = models.CharField(max_length=200, blank=True, default="")
    phone = models.CharField(max_length=32, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    credit_limit = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    @property
    def outstanding_balance(self) -> float:
        # Sum of unpaid balances across invoices.
        from sales.models import Invoice
        agg = Invoice.objects.filter(customer=self).aggregate(
            total=models.Sum("total_amount"),
            paid=models.Sum("amount_paid"),
        )
        return float((agg["total"] or 0) - (agg["paid"] or 0))
