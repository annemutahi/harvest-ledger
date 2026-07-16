from django.contrib import admin

from .models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "type", "phone", "email", "credit_limit")
    search_fields = ("name", "company", "phone", "email")
