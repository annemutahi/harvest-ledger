from django.urls import path

from products.public_views import product_feed

from .views import webhook

urlpatterns = [
    path("orders/webhook/", webhook, name="orders-webhook"),
    path("products/", product_feed, name="public-product-feed"),
]
