from django.contrib import admin

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    inlines = [OrderItemInline]
    list_display = ("reference", "channel", "status", "customer_name", "total", "placed_at")
    list_filter = ("status", "channel")
    search_fields = ("reference", "customer_name", "customer_phone", "customer_email")
