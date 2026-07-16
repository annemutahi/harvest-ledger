# Casual Labour module — Django backend guide

This document describes the Django REST Framework endpoints the frontend
`expensesStore` (workers + wages) expects. Follow it to replace the
localStorage stub in `src/lib/expenses-store.ts`.

## Models

```python
# casuals/models.py
from django.db import models
from django.conf import settings


class CasualWorker(models.Model):
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=32, blank=True, default="")
    daily_rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class CasualWage(models.Model):
    worker = models.ForeignKey(
        CasualWorker, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="wages",
    )
    worker_name = models.CharField(max_length=200)  # snapshot in case worker is removed
    date = models.DateField()
    days_worked = models.DecimalField(max_digits=6, decimal_places=2, default=1)
    rate_per_day = models.DecimalField(max_digits=12, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    task = models.CharField(max_length=200, blank=True, default="")
    paid = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")

    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="casual_wages_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def save(self, *args, **kwargs):
        # Always keep total in sync with days_worked * rate_per_day.
        self.total = (self.days_worked or 0) * (self.rate_per_day or 0)
        if self.worker and not self.worker_name:
            self.worker_name = self.worker.name
        super().save(*args, **kwargs)
```

## Serializers

```python
# casuals/serializers.py
from rest_framework import serializers
from .models import CasualWorker, CasualWage


class CasualWorkerSerializer(serializers.ModelSerializer):
    class Meta:
        model = CasualWorker
        fields = ["id", "name", "phone", "daily_rate", "active",
                  "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]


class CasualWageSerializer(serializers.ModelSerializer):
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = CasualWage
        fields = [
            "id", "worker", "worker_name", "date", "days_worked",
            "rate_per_day", "total", "task", "paid", "paid_at",
            "notes", "recorded_by", "created_at", "updated_at",
        ]
        read_only_fields = ["total", "recorded_by", "created_at", "updated_at"]

    def validate(self, attrs):
        worker = attrs.get("worker")
        if worker and not attrs.get("worker_name"):
            attrs["worker_name"] = worker.name
        if attrs.get("days_worked", 0) <= 0:
            raise serializers.ValidationError({"days_worked": "must be > 0"})
        if attrs.get("rate_per_day", 0) < 0:
            raise serializers.ValidationError({"rate_per_day": "must be >= 0"})
        return attrs
```

## Permissions

Only managers (staff) can create/update workers and mark wages as paid.
Any authenticated user (farmhands) can log wage entries.

```python
# casuals/permissions.py
from rest_framework import permissions


class IsManagerOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        return bool(request.user and request.user.is_staff)


class CanLogWages(permissions.BasePermission):
    """Farmhands may create wage entries but not mark them paid or delete."""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in ("DELETE",):
            return request.user.is_staff
        return True

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        # Only managers can toggle `paid` after creation.
        if not request.user.is_staff and "paid" in (request.data or {}):
            return False
        return True
```

## ViewSets

```python
# casuals/views.py
from django.db.models import Sum
from django.utils.timezone import now
from rest_framework import viewsets, decorators, response, status
from .models import CasualWorker, CasualWage
from .serializers import CasualWorkerSerializer, CasualWageSerializer
from .permissions import IsManagerOrReadOnly, CanLogWages


class CasualWorkerViewSet(viewsets.ModelViewSet):
    queryset = CasualWorker.objects.all()
    serializer_class = CasualWorkerSerializer
    permission_classes = [IsManagerOrReadOnly]


class CasualWageViewSet(viewsets.ModelViewSet):
    queryset = CasualWage.objects.select_related("worker", "recorded_by")
    serializer_class = CasualWageSerializer
    permission_classes = [CanLogWages]

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)

    @decorators.action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        if not request.user.is_staff:
            return response.Response({"detail": "forbidden"}, status=403)
        wage = self.get_object()
        wage.paid = True
        wage.paid_at = now()
        wage.save(update_fields=["paid", "paid_at", "updated_at"])
        return response.Response(CasualWageSerializer(wage).data)

    @decorators.action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Totals used by the dashboard Expenses card."""
        qs = self.get_queryset()
        month_from = request.query_params.get("from")
        month_to = request.query_params.get("to")
        if month_from:
            qs = qs.filter(date__gte=month_from)
        if month_to:
            qs = qs.filter(date__lte=month_to)
        totals = qs.aggregate(
            total=Sum("total"),
            outstanding=Sum("total", filter=~models.Q(paid=True)),
        )
        return response.Response({
            "total": totals["total"] or 0,
            "outstanding": totals["outstanding"] or 0,
            "count": qs.count(),
        })
```

## URLs

```python
# casuals/urls.py
from rest_framework.routers import DefaultRouter
from .views import CasualWorkerViewSet, CasualWageViewSet

router = DefaultRouter()
router.register("casual-workers", CasualWorkerViewSet, basename="casual-workers")
router.register("casual-wages", CasualWageViewSet, basename="casual-wages")

urlpatterns = router.urls
```

Mount under your API root, e.g. in the project `urls.py`:

```python
path("api/", include("casuals.urls")),
```

## Frontend integration

Replace the localStorage helpers in `src/lib/expenses-store.ts`:

| Local method                | HTTP call                                              |
| --------------------------- | ------------------------------------------------------ |
| `listWorkers()`             | `GET /api/casual-workers/`                             |
| `addWorker(data)`           | `POST /api/casual-workers/`                            |
| `removeWorker(id)`          | `DELETE /api/casual-workers/{id}/`                     |
| `listWages()`               | `GET /api/casual-wages/`                               |
| `addWage(data)`             | `POST /api/casual-wages/`                              |
| `updateWage(id, {paid})`    | `POST /api/casual-wages/{id}/mark-paid/`               |
| `removeWage(id)`            | `DELETE /api/casual-wages/{id}/`                       |
| dashboard summary           | `GET /api/casual-wages/summary/?from=…&to=…`           |

Field mapping (snake_case ↔ camelCase):

- `daily_rate` ↔ `dailyRate`
- `worker_name` ↔ `workerName`
- `days_worked` ↔ `daysWorked`
- `rate_per_day` ↔ `ratePerDay`
- `recorded_by` ↔ `recordedBy`

## Migrations

```bash
python manage.py makemigrations casuals
python manage.py migrate
```

## Permissions summary

- Farmhands (authenticated, non-staff): list workers, list wages, create wage entries.
- Managers (`is_staff`): create/update/delete workers, mark wages paid, delete wages.
- No anonymous access.
