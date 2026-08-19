"""Purchases and casual wages: totals, paid toggle, access control."""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import UserRole

from .models import CasualWage, CasualWorker, Purchase, Supplier

User = get_user_model()
PASSWORD = "Str0ng!Passw0rd#26"


def make_user(username, role):
    user = User.objects.create_user(username=username, password=PASSWORD)
    UserRole.objects.create(user=user, role=role)
    return user


@override_settings(SECURE_SSL_REDIRECT=False)
class PurchaseTests(APITestCase):
    def setUp(self):
        self.manager = make_user("mgr", "manager")
        self.viewer = make_user("vw", "viewer")
        self.supplier = Supplier.objects.create(name="Agrovet Ltd")

    def test_total_is_derived_from_quantity_and_unit_cost(self):
        self.client.force_authenticate(self.manager)
        res = self.client.post(
            "/api/purchases/",
            {
                "supplier": self.supplier.id,
                "supplier_name": "Agrovet Ltd",
                "date": str(date.today()),
                "category": "Feed",
                "item": "Layers mash",
                "quantity": "3",
                "unit_cost": "2500.00",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        purchase = Purchase.objects.get(id=res.data["id"])
        self.assertEqual(purchase.total, Decimal("7500.00"))
        self.assertFalse(purchase.paid)

    def test_marking_paid_stamps_paid_at(self):
        purchase = Purchase.objects.create(
            supplier_name="Agrovet Ltd", date=date.today(), category="Feed",
            item="Mash", quantity=1, unit_cost=Decimal("100.00"),
        )
        self.client.force_authenticate(self.manager)
        res = self.client.post(
            f"/api/purchases/{purchase.id}/set-paid/", {"paid": True}, format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        purchase.refresh_from_db()
        self.assertTrue(purchase.paid)
        self.assertIsNotNone(purchase.paid_at)

        res = self.client.post(
            f"/api/purchases/{purchase.id}/set-paid/", {"paid": False}, format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        purchase.refresh_from_db()
        self.assertFalse(purchase.paid)

    def test_viewer_cannot_create_a_purchase(self):
        self.client.force_authenticate(self.viewer)
        res = self.client.post(
            "/api/purchases/",
            {
                "supplier_name": "X", "date": str(date.today()), "category": "Feed",
                "item": "Mash", "quantity": "1", "unit_cost": "10.00",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_anonymous_cannot_create_a_wage(self):
        self.client.force_authenticate(None)
        res = self.client.post(
            "/api/casual-wages/",
            {"worker_name": "Ghost", "date": str(date.today()), "rate_per_day": "500"},
            format="json",
        )
        self.assertIn(res.status_code, (401, 403))
        self.assertFalse(CasualWage.objects.exists())


@override_settings(SECURE_SSL_REDIRECT=False)
class CasualWageTests(APITestCase):
    def setUp(self):
        self.manager = make_user("mgr2", "manager")
        self.worker = CasualWorker.objects.create(name="Otieno", daily_rate=Decimal("500.00"))
        self.client.force_authenticate(self.manager)

    def test_wage_total_follows_days_and_rate(self):
        res = self.client.post(
            "/api/casual-wages/",
            {
                "worker": self.worker.id,
                "worker_name": self.worker.name,
                "date": str(date.today()),
                "days_worked": "2",
                "rate_per_day": "500.00",
                "task": "Weeding",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        wage = CasualWage.objects.get(id=res.data["id"])
        self.assertEqual(wage.total, Decimal("1000.00"))
        self.assertFalse(wage.paid)

    def test_wage_can_be_marked_paid(self):
        wage = CasualWage.objects.create(
            worker=self.worker, worker_name="Otieno", date=date.today(),
            days_worked=1, rate_per_day=Decimal("500.00"), total=Decimal("500.00"),
        )
        res = self.client.post(f"/api/casual-wages/{wage.id}/set-paid/", {"paid": True}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        wage.refresh_from_db()
        self.assertTrue(wage.paid)
        self.assertIsNotNone(wage.paid_at)
