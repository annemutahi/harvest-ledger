from django.db import models


class Product(models.Model):
    name = models.CharField(max_length=200, unique=True)
    category = models.CharField(max_length=100, blank=True, default="")
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    available_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit = models.CharField(max_length=32, default="piece")
    description = models.TextField(blank=True, default="")
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name
