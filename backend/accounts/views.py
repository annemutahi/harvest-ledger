from django.contrib.auth import get_user_model
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView

from .permissions import module_permission
from .security import clear_failures, lock_seconds_remaining, register_failure
from .roles import MODULES, ROLE_CHOICES, ROLE_MATRIX
from .serializers import LoginSerializer, UserRoleWriteSerializer, UserSerializer

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
        if self.request.method in ("PUT", "PATCH"):
            return UserRoleWriteSerializer
        return UserSerializer
