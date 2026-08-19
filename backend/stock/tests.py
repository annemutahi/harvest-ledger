"""Stock entry recording and approval flow."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import UserRole
from products.models import Product

from .models import StockEntry

User = get_user_model()
PASSWORD = "Str0ng!Passw0rd#26"


def make_user(username, role):
    user = User.objects.create_user(username=username, password=PASSWORD)
    UserRole.objects.create(user=user, role=role)
    return user


@override_settings(SECURE_SSL_REDIRECT=False)
class StockFlowTests(APITestCase):
    def setUp(self):
        self.storekeeper = make_user("keeper", "storekeeper")
        self.manager = make_user("boss", "manager")
        self.viewer = make_user("look", "viewer")
        self.product = Product.objects.create(
            name="Maize", unit_price=Decimal("100.00"), available_quantity=Decimal("10.00"),
        )

    def _entry(self, **kw):
        defaults = dict(
            product_name="Maize", quantity=Decimal("5.00"),
            status=StockEntry.PENDING, recorded_by=self.storekeeper,
        )
        defaults.update(kw)
        return StockEntry.objects.create(**defaults)

    def test_storekeeper_records_entry_and_is_attributed(self):
        self.client.force_authenticate(self.storekeeper)
        res = self.client.post(
            "/api/stock/",
            {"product_name": "Maize", "quantity": "5.00", "unit": "kg"},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        entry = StockEntry.objects.get(id=res.data["id"])
        self.assertEqual(entry.recorded_by, self.storekeeper)

    def test_viewer_cannot_record(self):
        self.client.force_authenticate(self.viewer)
        res = self.client.post(
            "/api/stock/", {"product_name": "Maize", "quantity": "1.00"}, format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_storekeeper_cannot_approve(self):
        entry = self._entry()
        self.client.force_authenticate(self.storekeeper)
        res = self.client.patch(
            f"/api/stock/{entry.id}/approve/", {"product_id": self.product.id}, format="json",
        )
        self.assertEqual(res.status_code, 403)
        self.product.refresh_from_db()
        self.assertEqual(self.product.available_quantity, Decimal("10.00"))

    def test_manager_approval_increments_product_quantity(self):
        entry = self._entry()
        self.client.force_authenticate(self.manager)
        res = self.client.patch(
            f"/api/stock/{entry.id}/approve/", {"product_id": self.product.id}, format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        entry.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(entry.status, StockEntry.APPROVED)
        self.assertEqual(entry.approved_by, self.manager)
        self.assertEqual(self.product.available_quantity, Decimal("15.00"))

    def test_approval_requires_a_product(self):
        entry = self._entry()
        self.client.force_authenticate(self.manager)
        res = self.client.patch(f"/api/stock/{entry.id}/approve/", {}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_rejection_leaves_stock_untouched(self):
        entry = self._entry()
        self.client.force_authenticate(self.manager)
        res = self.client.patch(f"/api/stock/{entry.id}/reject/", {}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        entry.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(entry.status, StockEntry.REJECTED)
        self.assertEqual(self.product.available_quantity, Decimal("10.00"))
