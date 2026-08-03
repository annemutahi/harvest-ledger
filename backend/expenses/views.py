from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import decorators, permissions, response, status, viewsets

from accounts.permissions import IsManagerOrReadOnly, ReadOnlyForFarmhands, is_manager
from farm_erp.date_filter import apply_date_range

from .models import CasualWage, CasualWorker, Purchase, Supplier
from .serializers import (CasualWageSerializer, CasualWorkerSerializer,
                          PurchaseSerializer, SupplierSerializer)


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsManagerOrReadOnly]
    search_fields = ["name", "phone", "email"]


class PurchaseViewSet(viewsets.ModelViewSet):
    queryset = Purchase.objects.select_related("supplier")
    serializer_class = PurchaseSerializer
    permission_classes = [ReadOnlyForFarmhands]
    filterset_fields = ["supplier", "category", "payment_method"]
    search_fields = ["item", "supplier_name", "notes"]
    ordering_fields = ["date", "total"]

    def get_queryset(self):
        return apply_date_range(super().get_queryset(), self.request, "date")

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)

    @decorators.action(detail=False, methods=["get"])
    def summary(self, request):
        qs = self.get_queryset()
        d_from = request.query_params.get("from")
        d_to = request.query_params.get("to")
        if d_from:
            qs = qs.filter(date__gte=d_from)
        if d_to:
            qs = qs.filter(date__lte=d_to)
        return response.Response({
            "total": qs.aggregate(t=Sum("total"))["t"] or 0,
            "count": qs.count(),
        })


class CasualWorkerViewSet(viewsets.ModelViewSet):
    queryset = CasualWorker.objects.all()
    serializer_class = CasualWorkerSerializer
    permission_classes = [IsManagerOrReadOnly]
    search_fields = ["name", "phone"]


class CasualWageViewSet(viewsets.ModelViewSet):
    queryset = CasualWage.objects.select_related("worker")
    serializer_class = CasualWageSerializer
    filterset_fields = ["worker", "paid"]
    search_fields = ["worker_name", "task"]
    ordering_fields = ["date", "total"]

    def get_queryset(self):
        return apply_date_range(super().get_queryset(), self.request, "date")

    def get_permissions(self):
        # Farmhands may list + create (must be logged in). Only managers may update/delete.
        if self.action == "create":
            return [permissions.IsAuthenticated()]
        if self.action in ("list", "retrieve", "mark_paid", "summary"):
            return [ReadOnlyForFarmhands()]
        return [IsManagerOrReadOnly()]

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)

    @decorators.action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        if not is_manager(request.user):
            return response.Response({"detail": "forbidden"}, status=status.HTTP_403_FORBIDDEN)
        wage = self.get_object()
        wage.paid = True
        wage.paid_at = timezone.now()
        wage.save(update_fields=["paid", "paid_at"])
        return response.Response(CasualWageSerializer(wage).data)

    @decorators.action(detail=False, methods=["get"])
    def summary(self, request):
        qs = self.get_queryset()
        d_from = request.query_params.get("from")
        d_to = request.query_params.get("to")
        if d_from:
            qs = qs.filter(date__gte=d_from)
        if d_to:
            qs = qs.filter(date__lte=d_to)
        totals = qs.aggregate(
            total=Sum("total"),
            outstanding=Sum("total", filter=Q(paid=False)),
        )
        return response.Response({
            "total": totals["total"] or 0,
            "outstanding": totals["outstanding"] or 0,
            "count": qs.count(),
        })
