from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    CustomerViewSet, ProductViewSet, SaleViewSet,
    InvoiceViewSet, PaymentViewSet, receivables,
)

router = DefaultRouter()
router.register(r"customers", CustomerViewSet)
router.register(r"products", ProductViewSet)
router.register(r"sales", SaleViewSet)
router.register(r"invoices", InvoiceViewSet)
router.register(r"payments", PaymentViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("receivables/", receivables, name="receivables"),
]
