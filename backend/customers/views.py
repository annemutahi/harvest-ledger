from rest_framework import viewsets

from accounts.permissions import ReadOnlyForFarmhands
from audit.mixins import AuditedModelViewSetMixin

from .models import Customer
from .serializers import CustomerSerializer


class CustomerViewSet(AuditedModelViewSetMixin, viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [ReadOnlyForFarmhands]
    search_fields = ["name", "company", "contact_person", "phone", "email"]
    filterset_fields = ["type"]
    ordering_fields = ["name", "created_at"]
    audit_model_name = "Customer"
