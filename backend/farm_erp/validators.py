"""Shared server-side input validation.

Mirrors the client-side rules in src/lib/validation.ts so that requests made
outside the UI (scripts, integrations, direct API calls) are held to the same
standard.
"""
from __future__ import annotations

import re
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from django.core.validators import validate_email as django_validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

MAX_AMOUNT = Decimal("1000000000")
EARLIEST_BUSINESS_YEAR = 2020

_STRIP = re.compile(r"[\s\-()]")


def normalize_phone(raw: str | None, *, required: bool = False, field: str = "phone") -> str:
    """Normalise a Kenyan phone number to E.164 (+2547XXXXXXXX).

    Accepts 07xx / 01xx / 7xx / 254… / +254… with spaces or dashes. Foreign
    numbers already in international form are accepted unchanged.
    """
    value = _STRIP.sub("", raw or "")
    if not value:
        if required:
            raise serializers.ValidationError({field: "Phone number is required."})
        return ""

    if re.fullmatch(r"\+(?!254)[1-9]\d{7,14}", value):
        return value

    digits = value[1:] if value.startswith("+") else value
    if digits.startswith("254"):
        digits = digits[3:]
    elif digits.startswith("0"):
        digits = digits[1:]

    if re.fullmatch(r"[17]\d{8}", digits) or re.fullmatch(r"[2-6]\d{7,8}", digits):
        return f"+254{digits}"

    raise serializers.ValidationError(
        {field: "Enter a valid phone number, e.g. 0712 345 678."},
    )


def normalize_email(raw: str | None, *, required: bool = False, field: str = "email") -> str:
    value = (raw or "").strip().lower()
    if not value:
        if required:
            raise serializers.ValidationError({field: "Email is required."})
        return ""
    if len(value) > 255:
        raise serializers.ValidationError({field: "Email must be under 255 characters."})
    try:
        django_validate_email(value)
    except DjangoValidationError as exc:  # pragma: no cover - message is static
        raise serializers.ValidationError({field: "Enter a valid email address."}) from exc
    return value


def validate_amount(value, *, field: str = "amount", positive: bool = False) -> Decimal:
    """Validate a money amount: finite, >= 0 (or > 0), max 2 decimal places."""
    if value is None:
        raise serializers.ValidationError({field: "Enter a valid amount."})
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise serializers.ValidationError({field: "Enter a valid amount."}) from exc
    if not amount.is_finite():
        raise serializers.ValidationError({field: "Enter a valid amount."})
    if positive and amount <= 0:
        raise serializers.ValidationError({field: "Amount must be greater than 0."})
    if amount < 0:
        raise serializers.ValidationError({field: "Amount cannot be negative."})
    if amount > MAX_AMOUNT:
        raise serializers.ValidationError({field: "Amount is too large."})
    if -amount.as_tuple().exponent > 2:
        raise serializers.ValidationError({field: "Use at most 2 decimal places."})
    return amount


def validate_quantity(value, *, field: str = "quantity") -> Decimal:
    try:
        quantity = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise serializers.ValidationError({field: "Enter a valid quantity."}) from exc
    if not quantity.is_finite() or quantity <= 0:
        raise serializers.ValidationError({field: "Quantity must be greater than 0."})
    if quantity > Decimal("1000000"):
        raise serializers.ValidationError({field: "Quantity is too large."})
    return quantity


def validate_business_date(
    value: date | None,
    *,
    field: str = "date",
    allow_future: bool = False,
    max_future_days: int = 0,
) -> date | None:
    """Reject nonsense dates: too far in the past, or (by default) in the future."""
    if value is None:
        return None
    if not isinstance(value, date):
        raise serializers.ValidationError({field: "Enter a valid date."})
    if value.year < EARLIEST_BUSINESS_YEAR:
        raise serializers.ValidationError({field: "Date is too far in the past."})
    today = date.today()
    if not allow_future and value > today:
        raise serializers.ValidationError({field: "Date cannot be in the future."})
    if allow_future and max_future_days and value > today + timedelta(days=max_future_days):
        raise serializers.ValidationError({field: "Date is too far in the future."})
    return value
