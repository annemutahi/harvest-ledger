from rest_framework.routers import DefaultRouter

from .views import StockEntryViewSet

router = DefaultRouter()
router.register("stock", StockEntryViewSet, basename="stock")

urlpatterns = router.urls
