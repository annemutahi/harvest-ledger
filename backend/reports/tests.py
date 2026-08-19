"""Dashboard summary maths: only paid expenses reduce profit."""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import UserRole
from customers.models import Customer
from expenses.models import CasualWage, Purchase
from sales.models import Invoice, Payment

User = get_user_model()


class DashboardSummaryTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="mgr", password="Str0ng!Passw0rd#26")
        UserRole.objects.create(user=self.user, role="manager")
        self.client.force_authenticate(self.user)
        self.customer = Customer.objects.create(name="Acme Ltd")
        today = date.today()

        invoice = Invoice.objects.create(
            invoice_number="INV-R-1", customer=self.customer, due_date=today,
            total_amount=Decimal("1000.00"),
        )
        Payment.objects.create(
            invoice=invoice, customer=self.customer, amount=Decimal("1000.00"),
            method="cash", date=today,
        )
        invoice.amount_paid = Decimal("1000.00")
        invoice.recompute_status()
        invoice.save(update_fields=["amount_paid", "status"])

        Purchase.objects.create(
            supplier_name="Agrovet", date=today, category="Feed", item="Mash",
            quantity=1, unit_cost=Decimal("200.00"), paid=True,
        )
        Purchase.objects.create(
            supplier_name="Agrovet", date=today, category="Feed", item="Salt",
            quantity=1, unit_cost=Decimal("500.00"), paid=False,
        )
        CasualWage.objects.create(
            worker_name="Otieno", date=today, days_worked=1,
            rate_per_day=Decimal("300.00"), total=Decimal("300.00"), paid=True,
        )

    def test_profit_subtracts_paid_expenses_only(self):
        res = self.client.get("/api/reports/summary/")
        self.assertEqual(res.status_code, 200, res.content)
        data = res.data
        self.assertEqual(data["expenses"]["purchases_paid"], 200.0)
        self.assertEqual(data["expenses"]["wages_paid"], 300.0)
        self.assertEqual(data["expenses"]["paid_total"], 500.0)
        # 1000 sales - 500 paid expenses; the unpaid 500 purchase is excluded.
        self.assertEqual(data["profit"], data["sales"]["total"] - 500.0)

    def test_summary_requires_authentication(self):
        self.client.force_authenticate(None)
        self.assertIn(self.client.get("/api/reports/summary/").status_code, (401, 403))
