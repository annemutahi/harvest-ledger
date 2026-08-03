from django.urls import path
from rest_framework_simplejwt.views import TokenBlacklistView, TokenRefreshView

from .password_reset import password_reset_confirm, password_reset_request
from .views import LoginView, me

urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("me/", me, name="auth-me"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("token/blacklist/", TokenBlacklistView.as_view(), name="token-blacklist"),
    path("password-reset/", password_reset_request, name="password-reset"),
    path("password-reset/confirm/", password_reset_confirm, name="password-reset-confirm"),
]
