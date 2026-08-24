"""Business reporting endpoints: sales trends, inventory movement,
expenses breakdown, and profit & loss summary.

All endpoints accept optional `from` and `to` query params (YYYY-MM-DD).
"""
from __future__ import annotations

from datetime import date, timedelta

from django.db.models import Sum
from django.db.models.functions import TruncMonth
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from expenses.models import CasualWage, Purchase
from orders.models import Order
from products.models import Product
from sales.models import Invoice, Sale


def _range(request):
    today = date.today()
    d_from = request.query_params.get("from") or (today - timedelta(days=180)).isoformat()
    d_to = request.query_params.get("to") or today.isoformat()
    return d_from, d_to


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sales_report(request):
    d_from, d_to = _range(request)
    qs = Sale.objects.filter(date__gte=d_from, date__lte=d_to, invoice__voided_at__isnull=True)
    trend = list(
        qs.annotate(m=TruncMonth("date"))
        .values("m")
        .annotate(total=Sum("total"))
        .order_by("m")
    )
    receivables = list(
        Invoice.objects.filter(issue_date__gte=d_from, issue_date__lte=d_to, voided_at__isnull=True)
        .annotate(m=TruncMonth("issue_date"))
        .values("m")
        .annotate(outstanding=Sum("total_amount") - Sum("amount_paid"))
        .order_by("m")
    )
    return Response({
        "from": d_from, "to": d_to,
        "total_sales": qs.aggregate(t=Sum("total"))["t"] or 0,
        "count": qs.count(),
        "trend": [{"month": r["m"].strftime("%Y-%m"), "total": float(r["total"] or 0)}
                  for r in trend],
        "receivables": [{"month": r["m"].strftime("%Y-%m"),
                         "outstanding": float(r["outstanding"] or 0)} for r in receivables],
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def inventory_report(request):
    products = list(
        Product.objects.values("id", "name", "category", "unit",
                               "unit_price", "available_quantity")
        .order_by("name")
    )
    low_stock = [p for p in products if float(p["available_quantity"]) < 20]
    return Response({
        "products": [
            {**p,
             "unit_price": float(p["unit_price"] or 0),
             "available_quantity": float(p["available_quantity"] or 0)}
            for p in products
        ],
        "low_stock_count": len(low_stock),
        "total_products": len(products),
        "inventory_value": sum(
            float(p["unit_price"] or 0) * float(p["available_quantity"] or 0)
            for p in products
        ),
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def expenses_report(request):
    d_from, d_to = _range(request)
    purchases = Purchase.objects.filter(date__gte=d_from, date__lte=d_to)
    wages = CasualWage.objects.filter(date__gte=d_from, date__lte=d_to)

    by_category = list(
        purchases.values("category").annotate(total=Sum("total")).order_by("-total")
    )
    monthly = list(
        purchases.annotate(m=TruncMonth("date"))
        .values("m").annotate(total=Sum("total")).order_by("m")
    )
    wage_monthly = list(
        wages.annotate(m=TruncMonth("date"))
        .values("m").annotate(total=Sum("total")).order_by("m")
    )

    return Response({
        "from": d_from, "to": d_to,
        "purchases_total": float(purchases.aggregate(t=Sum("total"))["t"] or 0),
        "wages_total": float(wages.aggregate(t=Sum("total"))["t"] or 0),
        "by_category": [{"category": r["category"], "total": float(r["total"] or 0)}
                        for r in by_category],
        "purchases_monthly": [{"month": r["m"].strftime("%Y-%m"),
                               "total": float(r["total"] or 0)} for r in monthly],
        "wages_monthly": [{"month": r["m"].strftime("%Y-%m"),
                           "total": float(r["total"] or 0)} for r in wage_monthly],
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def pnl_report(request):
    """Cash-basis P&L: money actually received vs money actually paid out."""
    d_from, d_to = _range(request)
    revenue = Payment.objects.filter(
        date__gte=d_from, date__lte=d_to, voided_at__isnull=True
    ).aggregate(t=Sum("amount"))["t"] or 0
    purchases = Purchase.objects.filter(date__gte=d_from, date__lte=d_to, paid=True)\
        .aggregate(t=Sum("total"))["t"] or 0
    wages = CasualWage.objects.filter(date__gte=d_from, date__lte=d_to, paid=True)\
        .aggregate(t=Sum("total"))["t"] or 0
    expenses_total = float(purchases) + float(wages)
    return Response({
        "from": d_from, "to": d_to,
        "basis": "cash",
        "revenue": float(revenue),
        "expenses": {
            "purchases": float(purchases),
            "wages": float(wages),
            "total": expenses_total,
        },
        "gross_profit": float(revenue) - expenses_total,
    })



def _month_bounds(today: date | None = None):
    today = today or date.today()
    start = today.replace(day=1)
    if start.month == 12:
        next_start = start.replace(year=start.year + 1, month=1)
    else:
        next_start = start.replace(month=start.month + 1)
    return start, next_start - timedelta(days=1)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    """Consolidated dashboard aggregates.

    Optional `from`/`to` (YYYY-MM-DD) override the default month-to-date window.
    Returns invoice sales, delivered-order sales, expenses breakdown, profit,
    outstanding receivables and payments received in the range.
    """
    today = date.today()
    default_from, default_to = _month_bounds(today)
    d_from = request.query_params.get("from") or default_from.isoformat()
    d_to = request.query_params.get("to") or default_to.isoformat()

    invoices_qs = Invoice.objects.filter(issue_date__gte=d_from, issue_date__lte=d_to, voided_at__isnull=True)
    invoice_sales = float(invoices_qs.aggregate(t=Sum("total_amount"))["t"] or 0)

    delivered_orders_qs = Order.objects.filter(
        status=Order.DELIVERED, updated_at__date__gte=d_from, updated_at__date__lte=d_to
    )
    delivered_orders_total = float(delivered_orders_qs.aggregate(t=Sum("total"))["t"] or 0)

    purchases = float(
        Purchase.objects.filter(date__gte=d_from, date__lte=d_to)
        .aggregate(t=Sum("total"))["t"] or 0
    )
    wages = float(
        CasualWage.objects.filter(date__gte=d_from, date__lte=d_to)
        .aggregate(t=Sum("total"))["t"] or 0
    )
    expenses_total = purchases + wages

    # Profit counts only expenses that have actually been paid.
    purchases_paid = float(
        Purchase.objects.filter(date__gte=d_from, date__lte=d_to, paid=True)
        .aggregate(t=Sum("total"))["t"] or 0
    )
    wages_paid = float(
        CasualWage.objects.filter(date__gte=d_from, date__lte=d_to, paid=True)
        .aggregate(t=Sum("total"))["t"] or 0
    )
    expenses_paid_total = purchases_paid + wages_paid

    total_sales = invoice_sales + delivered_orders_total

    receivables_outstanding = float(
        (Invoice.objects.filter(voided_at__isnull=True).aggregate(t=Sum("total_amount"))["t"] or 0)
        - (Invoice.objects.filter(voided_at__isnull=True).aggregate(t=Sum("amount_paid"))["t"] or 0)
    )

    return Response({
        "from": d_from,
        "to": d_to,
        "sales": {
            "invoices": invoice_sales,
            "delivered_orders": delivered_orders_total,
            "total": total_sales,
        },
        "expenses": {
            "purchases": purchases,
            "wages": wages,
            "total": expenses_total,
            "purchases_paid": purchases_paid,
            "wages_paid": wages_paid,
            "paid_total": expenses_paid_total,
        },
        "profit": total_sales - expenses_paid_total,
        "receivables_outstanding": receivables_outstanding,
        "delivered_orders_count": delivered_orders_qs.count(),
    })
