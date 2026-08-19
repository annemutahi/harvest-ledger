from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from customers.models import Customer
from products.models import Product
from sales.models import CreditApplication, Invoice, InvoiceAdjustment, Payment, Sale, SaleItem
from sales.serializers import InvoiceSerializer


class PaymentApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="manager", password="secure-test-password", is_staff=True,
        )
        self.customer = Customer.objects.create(name="Test customer")
        self.invoice = Invoice.objects.create(
            invoice_number="INV-TEST-0001",
            customer=self.customer,
            due_date=timezone.localdate(),
            total_amount=Decimal("100.00"),
        )
        self.client.force_authenticate(self.user)

    def test_recording_payment_updates_invoice_balance(self):
        response = self.client.post(reverse("api:payments-list"), {
            "invoice": self.invoice.id,
            "customer": self.customer.id,
            "amount": "25.00",
            "method": "cash",
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.amount_paid, Decimal("25.00"))
        self.assertEqual(self.invoice.status, Invoice.PARTIAL)
        self.assertEqual(Payment.objects.count(), 1)

    def test_overpayment_returns_validation_error(self):
        response = self.client.post(reverse("api:payments-list"), {
            "invoice": self.invoice.id,
            "customer": self.customer.id,
            "amount": "101.00",
            "method": "cash",
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("amount", response.data)

    def test_revising_a_paid_invoice_to_a_lower_total_marks_credit_and_records_note(self):
        product = Product.objects.create(name="Test product", unit_price=Decimal("100.00"))
        self.invoice.amount_paid = Decimal("100.00")
        self.invoice.save(update_fields=["amount_paid"])
        sale = Sale.objects.create(
            invoice=self.invoice,
            customer=self.customer,
            payment_type=Sale.CREDIT,
            total=Decimal("100.00"),
        )
        SaleItem.objects.create(
            sale=sale, product=product, product_name=product.name,
            quantity=Decimal("1.00"), unit_price=Decimal("100.00"),
        )

        response = self.client.put(reverse("api:sales-detail", args=[sale.id]), {
            "customer": self.customer.id,
            "payment_type": "credit",
            "date": str(timezone.localdate()),
            "items": [{"product": product.id, "quantity": "1.00", "unit_price": "75.00"}],
            "adjustment_note": "Corrected item price after payment.",
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, Invoice.CREDIT)
        adjustment = InvoiceAdjustment.objects.get(invoice=self.invoice)
        self.assertEqual(adjustment.kind, InvoiceAdjustment.CREDIT)
        self.assertEqual(adjustment.amount, Decimal("25.00"))
        self.assertEqual(adjustment.notes, "Corrected item price after payment.")

    def test_customer_credit_is_applied_to_the_next_credit_sale(self):
        self.invoice.amount_paid = Decimal("125.00")
        self.invoice.recompute_status()
        self.invoice.save(update_fields=["amount_paid", "status"])
        product = Product.objects.create(name="Credit product", unit_price=Decimal("100.00"), available_quantity=Decimal("10.00"))

        response = self.client.post(reverse("api:sales-list"), {
            "customer": self.customer.id,
            "payment_type": "credit",
            "date": str(timezone.localdate()),
            "due_date": str(timezone.localdate()),
            "items": [{"product": product.id, "quantity": "1.00", "unit_price": "100.00"}],
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        target = Invoice.objects.exclude(id=self.invoice.id).get()
        self.assertEqual(target.amount_paid, Decimal("25.00"))
        self.assertEqual(target.outstanding_balance, Decimal("75.00"))
        self.assertEqual(CreditApplication.objects.get(target_invoice=target).amount, Decimal("25.00"))
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, Invoice.PAID)
        self.assertEqual(self.invoice.available_credit, Decimal("0"))

    def test_cash_sale_creates_payment_with_sale_date(self):
        product = Product.objects.create(name="Cash product", unit_price=Decimal("50.00"), available_quantity=Decimal("10.00"))
        response = self.client.post(reverse("api:sales-list"), {
            "customer": self.customer.id,
            "payment_type": "cash",
            "date": str(timezone.localdate()),
            "due_date": str(timezone.localdate()),
            "items": [{"product": product.id, "quantity": "1.00", "unit_price": "50.00"}],
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        sale_id = response.data["id"]
        sale = Sale.objects.get(id=sale_id)
        self.assertEqual(Payment.objects.count(), 1)
        payment = Payment.objects.first()
        self.assertEqual(payment.method, Payment.CASH)
        self.assertEqual(payment.date, sale.date)
        self.assertEqual(payment.amount, Decimal("50.00"))

    def test_invoice_serialization_hides_zero_credit_fields(self):
        response = self.client.get(reverse("api:invoices-detail", args=[self.invoice.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("credit_applied", response.data)
        self.assertNotIn("available_credit", response.data)


class VoidTests(APITestCase):
    """Voiding reverses money and stock, and is one-way."""

    def setUp(self):
        from accounts.models import UserRole

        self.manager = get_user_model().objects.create_user(
            username="void-mgr", password="Str0ng!Passw0rd#26",
        )
        UserRole.objects.create(user=self.manager, role="manager")
        self.viewer = get_user_model().objects.create_user(
            username="void-viewer", password="Str0ng!Passw0rd#26",
        )
        UserRole.objects.create(user=self.viewer, role="viewer")
        self.customer = Customer.objects.create(name="Void customer")
        self.invoice = Invoice.objects.create(
            invoice_number="INV-VOID-1", customer=self.customer,
            due_date=timezone.localdate(), total_amount=Decimal("100.00"),
        )
        self.client.force_authenticate(self.manager)

    def _payment(self, amount="40.00"):
        res = self.client.post(reverse("api:payments-list"), {
            "invoice": self.invoice.id, "customer": self.customer.id,
            "amount": amount, "method": "cash",
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        return res.data["id"]

    def test_voiding_a_payment_restores_the_invoice_balance(self):
        payment_id = self._payment("40.00")
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.amount_paid, Decimal("40.00"))

        res = self.client.post(
            reverse("api:payments-detail", args=[payment_id]) + "void/",
            {"reason": "Recorded against the wrong invoice"}, format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.amount_paid, Decimal("0.00"))
        self.assertEqual(self.invoice.status, Invoice.UNPAID)

        payment = Payment.objects.get(id=payment_id)
        self.assertIsNotNone(payment.voided_at)
        self.assertEqual(payment.voided_by, self.manager)

    def test_a_payment_cannot_be_voided_twice(self):
        payment_id = self._payment()
        url = reverse("api:payments-detail", args=[payment_id]) + "void/"
        self.client.post(url, {"reason": "Duplicate entry"}, format="json")
        res = self.client.post(url, {"reason": "Duplicate entry"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invoice_with_live_payments_cannot_be_voided(self):
        self._payment()
        res = self.client.post(
            reverse("api:invoices-detail", args=[self.invoice.id]) + "void/",
            {"reason": "Issued in error"}, format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.invoice.refresh_from_db()
        self.assertFalse(self.invoice.is_voided)

    def test_voiding_an_invoice_returns_stock_and_blocks_edits(self):
        product = Product.objects.create(
            name="Void product", unit_price=Decimal("100.00"),
            available_quantity=Decimal("9.00"),
        )
        sale = Sale.objects.create(
            invoice=self.invoice, customer=self.customer,
            payment_type=Sale.CREDIT, total=Decimal("100.00"),
        )
        SaleItem.objects.create(
            sale=sale, product=product, product_name=product.name,
            quantity=Decimal("1.00"), unit_price=Decimal("100.00"),
        )

        res = self.client.post(
            reverse("api:invoices-detail", args=[self.invoice.id]) + "void/",
            {"reason": "Customer cancelled the order"}, format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        product.refresh_from_db()
        self.invoice.refresh_from_db()
        self.assertEqual(product.available_quantity, Decimal("10.00"))
        self.assertTrue(self.invoice.is_voided)
        self.assertEqual(self.invoice.void_reason, "Customer cancelled the order")

        edit = self.client.put(reverse("api:invoices-detail", args=[self.invoice.id]), {
            "invoice_number": self.invoice.invoice_number,
            "customer": self.customer.id,
            "due_date": str(timezone.localdate()),
            "total_amount": "50.00",
        }, format="json")
        self.assertEqual(edit.status_code, status.HTTP_400_BAD_REQUEST)

    def test_void_requires_a_reason_and_manager_rights(self):
        payment_id = self._payment()
        url = reverse("api:payments-detail", args=[payment_id]) + "void/"
        self.assertEqual(self.client.post(url, {}, format="json").status_code,
                         status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.viewer)
        res = self.client.post(url, {"reason": "Not allowed"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
