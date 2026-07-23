"""Shared helper: apply ``?from=YYYY-MM-DD&to=YYYY-MM-DD`` filters to a
queryset. Detects whether the target field is a ``DateField`` or a
``DateTimeField`` so the lookup uses ``__date`` when needed.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from django.db.models import DateField, DateTimeField, QuerySet


def _parse(d: Optional[str]):
    if not d:
        return None
    try:
        return datetime.strptime(d[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def apply_date_range(qs: QuerySet, request, field: str) -> QuerySet:
    d_from = _parse(request.query_params.get("from"))
    d_to = _parse(request.query_params.get("to"))
    if not d_from and not d_to:
        return qs

    model_field = qs.model._meta.get_field(field)
    if isinstance(model_field, DateTimeField):
        lookup = f"{field}__date"
    elif isinstance(model_field, DateField):
        lookup = field
    else:
        return qs

    if d_from:
        qs = qs.filter(**{f"{lookup}__gte": d_from})
    if d_to:
        qs = qs.filter(**{f"{lookup}__lte": d_to})
    return qs
