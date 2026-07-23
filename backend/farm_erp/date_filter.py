"""Shared helper: apply ?from=YYYY-MM-DD&to=YYYY-MM-DD to a queryset.

Used by list endpoints (Sales, Invoices, Purchases, CasualWages, Orders,
Stock) so the Reports module and any date-scoped view can push the range
filter to the database instead of downloading everything to the client.
"""
from __future__ import annotations


def apply_date_range(qs, request, field: str):
    """Filter *qs* by request.query_params[from|to] against *field*.

    For DateTimeField, uses `__date__gte` / `__date__lte` so a plain date
    string works. For DateField, uses `__gte` / `__lte`.
    """
    d_from = request.query_params.get("from")
    d_to = request.query_params.get("to")
    if not (d_from or d_to):
        return qs
    # Detect datetime vs date by field descriptor.
    try:
        model_field = qs.model._meta.get_field(field)
        is_datetime = model_field.get_internal_type() == "DateTimeField"
    except Exception:
        is_datetime = False
    gte = f"{field}__date__gte" if is_datetime else f"{field}__gte"
    lte = f"{field}__date__lte" if is_datetime else f"{field}__lte"
    if d_from:
        qs = qs.filter(**{gte: d_from})
    if d_to:
        qs = qs.filter(**{lte: d_to})
    return qs
