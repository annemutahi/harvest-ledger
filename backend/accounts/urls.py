from django.urls import path
from rest_framework_simplejwt.views import TokenBlacklistView, TokenRefreshView

from .views import LoginView, me

urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("me/", me, name="auth-me"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("token/blacklist/", TokenBlacklistView.as_view(), name="token-blacklist"),
]
