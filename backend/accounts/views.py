from django.contrib.auth import get_user_model
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView

from .permissions import module_permission
from .security import clear_failures, lock_seconds_remaining, register_failure
from .roles import MODULES, ROLE_CHOICES, ROLE_MATRIX
from .serializers import (
    LoginSerializer,
    UserCreateSerializer,
    UserRoleWriteSerializer,
    UserSerializer,
)

User = get_user_model()


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request, *args, **kwargs):
        username = str(request.data.get("username", ""))
        locked = lock_seconds_remaining(username)
        if locked:
            minutes = max(1, round(locked / 60))
            return Response(
                {
                    "detail": (
                        "Too many failed sign-in attempts. This account is locked for "
                        f"{minutes} more minute(s)."
                    )
                },
                status=status.HTTP_423_LOCKED,
            )

        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            locked = register_failure(username)
            if locked:
                minutes = max(1, round(locked / 60))
                return Response(
                    {
                        "detail": (
                            "Too many failed sign-in attempts. This account is locked "
                            f"for {minutes} minute(s)."
                        )
                    },
                    status=status.HTTP_423_LOCKED,
                )
            raise

        clear_failures(username)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user).data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def role_matrix(request):
    """Reference data for the permissions screen."""
    return Response(
        {
            "modules": MODULES,
            "roles": [{"value": v, "label": label} for v, label in ROLE_CHOICES],
            "matrix": ROLE_MATRIX,
        }
    )


class UserViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Managers can view team members; admins can change roles."""

    queryset = User.objects.select_related("role_profile").order_by("username")
    permission_classes = [module_permission("users")]
    search_fields = ["username", "email"]
    ordering_fields = ["username"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return UserCreateSerializer
        if self.request.method in ("PUT", "PATCH"):
            return UserRoleWriteSerializer
        return UserSerializer


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    """Let a signed-in user change their own password."""
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError as DjangoValidationError

    current = str(request.data.get("current_password") or "")
    new_password = str(request.data.get("new_password") or "")

    if not current or not new_password:
        return Response(
            {"detail": "Current and new password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = request.user
    if not user.check_password(current):
        return Response(
            {"current_password": ["That is not your current password."]},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if current == new_password:
        return Response(
            {"new_password": ["Choose a password different from the current one."]},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        validate_password(new_password, user)
    except DjangoValidationError as exc:
        return Response(
            {"new_password": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST
        )

    user.set_password(new_password)
    user.save(update_fields=["password"])
    clear_failures(user.get_username())
    return Response({"detail": "Password updated."}, status=status.HTTP_200_OK)
