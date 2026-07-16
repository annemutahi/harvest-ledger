from django.contrib import admin

from .models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "unit_price", "available_quantity", "active")
    list_filter = ("category", "active")
    search_fields = ("name",)
