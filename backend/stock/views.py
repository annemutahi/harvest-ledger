from django.db import transaction
from django.db.models import F
from rest_framework import decorators, response, status, viewsets

from accounts.permissions import is_manager
from farm_erp.date_filter import apply_date_range
from products.models import Product

from .models import StockEntry
from .serializers import StockEntrySerializer


class StockEntryViewSet(viewsets.ModelViewSet):
    """Farmhands POST daily stock. Managers approve/reject; approval
    increments the matched product's `available_quantity`.
    """
    queryset = StockEntry.objects.select_related("matched_product")
    serializer_class = StockEntrySerializer
    filterset_fields = ["status", "matched_product"]

    def get_queryset(self):
        return apply_date_range(super().get_queryset(), self.request, "recorded_at")

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)

    @decorators.action(detail=True, methods=["patch"])
    def approve(self, request, pk=None):
        if not is_manager(request.user):
            return response.Response({"detail": "forbidden"}, status=status.HTTP_403_FORBIDDEN)
        entry = self.get_object()
        product_id = request.data.get("product_id") or (
            entry.matched_product_id if entry.matched_product_id else None
        )
        if not product_id:
            return response.Response(
                {"detail": "product_id is required to approve."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            Product.objects.filter(pk=product_id).update(
                available_quantity=F("available_quantity") + entry.quantity,
            )
            entry.status = StockEntry.APPROVED
            entry.matched_product_id = product_id
            entry.approved_by = request.user
            entry.save(update_fields=["status", "matched_product", "approved_by", "updated_at"])
        return response.Response(StockEntrySerializer(entry).data)

    @decorators.action(detail=True, methods=["patch"])
    def reject(self, request, pk=None):
        if not is_manager(request.user):
            return response.Response({"detail": "forbidden"}, status=status.HTTP_403_FORBIDDEN)
        entry = self.get_object()
        entry.status = StockEntry.REJECTED
        entry.approved_by = request.user
        entry.save(update_fields=["status", "approved_by", "updated_at"])
        return response.Response(StockEntrySerializer(entry).data)
