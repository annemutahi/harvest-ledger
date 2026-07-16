from rest_framework.routers import DefaultRouter

from .views import (CasualWageViewSet, CasualWorkerViewSet,
                    PurchaseViewSet, SupplierViewSet)

router = DefaultRouter()
router.register("suppliers", SupplierViewSet, basename="suppliers")
router.register("purchases", PurchaseViewSet, basename="purchases")
router.register("casual-workers", CasualWorkerViewSet, basename="casual-workers")
router.register("casual-wages", CasualWageViewSet, basename="casual-wages")

urlpatterns = router.urls
