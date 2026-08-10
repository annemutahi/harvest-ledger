from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenBlacklistView, TokenRefreshView

from .password_reset import password_reset_confirm, password_reset_request
from .views import LoginView, UserViewSet, change_password, me, role_matrix

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("me/", me, name="auth-me"),
    path("roles/", role_matrix, name="auth-roles"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("token/blacklist/", TokenBlacklistView.as_view(), name="token-blacklist"),
    path("password-reset/", password_reset_request, name="password-reset"),
    path("password-reset/confirm/", password_reset_confirm, name="password-reset-confirm"),
    path("change-password/", change_password, name="change-password"),
    path("", include(router.urls)),
]
