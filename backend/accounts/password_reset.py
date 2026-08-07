"""Forgot-password / reset-password flow.

Two endpoints, both public but throttled:

  POST /api/auth/password-reset/          {email}                  -> always 200
  POST /api/auth/password-reset/confirm/  {uid, token, password}   -> 200 | 400

The request endpoint never reveals whether an email is registered — it always
returns the same response, so it can't be used to enumerate accounts.
"""
from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

User = get_user_model()

GENERIC_RESPONSE = {
    "detail": "If that email is registered, a password reset link is on its way."
}


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(min_length=12, write_only=True)


def _reset_link(uid: str, token: str) -> str:
    base = (settings.FRONTEND_URL or "").rstrip("/")
    return f"{base}/reset-password?uid={uid}&token={token}"


def _send_reset_email(user, link: str) -> None:
    name = user.get_full_name() or user.username
    send_mail(
        subject="Reset your Peaceful Acres Farm password",
        message=(
            f"Hi {name},\n\n"
            "We received a request to reset the password for your Peaceful Acres "
            "Farm account.\n\n"
            f"Reset your password here:\n{link}\n\n"
            "This link expires in a few hours and can only be used once. "
            "If you didn't request this, you can safely ignore this email — "
            "your password stays unchanged.\n\n"
            "— Peaceful Acres Farm Limited"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([ScopedRateThrottle])
def password_reset_request(request):
    serializer = PasswordResetRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"].strip()

    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user and user.email:
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        try:
            _send_reset_email(user, _reset_link(uid, token))
        except Exception:  # noqa: BLE001 - never leak mail errors to the caller
            import logging

            logging.getLogger(__name__).exception("Password reset email failed")

    return Response(GENERIC_RESPONSE)


password_reset_request.throttle_scope = "password_reset"


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([ScopedRateThrottle])
def password_reset_confirm(request):
    serializer = PasswordResetConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    invalid = Response(
        {"detail": "This reset link is invalid or has expired. Request a new one."},
        status=status.HTTP_400_BAD_REQUEST,
    )

    try:
        pk = force_str(urlsafe_base64_decode(data["uid"]))
        user = User.objects.get(pk=pk, is_active=True)
    except Exception:  # noqa: BLE001
        return invalid

    if not default_token_generator.check_token(user, data["token"]):
        return invalid

    try:
        validate_password(data["password"], user=user)
    except DjangoValidationError as exc:
        return Response({"password": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(data["password"])
    user.save(update_fields=["password"])
    return Response({"detail": "Password updated. You can now sign in."})


password_reset_confirm.throttle_scope = "password_reset"
