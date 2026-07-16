from rest_framework import viewsets

from accounts.permissions import ReadOnlyForFarmhands

from .models import Product
from .serializers import ProductSerializer


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [ReadOnlyForFarmhands]
    search_fields = ["name", "category"]
    filterset_fields = ["category", "active"]
    ordering_fields = ["name", "unit_price", "available_quantity"]
