from django.urls import path

from .views import (
    dashboard_summary,
    expenses_report,
    inventory_report,
    pnl_report,
    sales_report,
)

urlpatterns = [
    path("summary/", dashboard_summary, name="reports-summary"),
    path("sales/", sales_report, name="reports-sales"),
    path("inventory/", inventory_report, name="reports-inventory"),
    path("expenses/", expenses_report, name="reports-expenses"),
    path("pnl/", pnl_report, name="reports-pnl"),
]
