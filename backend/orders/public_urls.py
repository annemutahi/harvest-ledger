from django.urls import path

from .views import webhook

urlpatterns = [
    path("orders/webhook/", webhook, name="orders-webhook"),
]
