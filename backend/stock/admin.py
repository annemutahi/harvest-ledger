from django.contrib import admin

from .models import StockEntry


@admin.register(StockEntry)
class StockEntryAdmin(admin.ModelAdmin):
    list_display = ("product_name", "quantity", "status", "recorded_by", "recorded_at")
    list_filter = ("status",)
