from django.contrib.auth import get_user_model
from rest_framework import mixins, permissions, viewsets
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView

from .permissions import module_permission
from .roles import MODULES, ROLE_CHOICES, ROLE_MATRIX
from .serializers import LoginSerializer, UserRoleWriteSerializer, UserSerializer

User = get_user_model()


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


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
