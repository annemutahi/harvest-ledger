from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from customers.models import Customer
from products.models import Product
from sales.models import CreditApplication, Invoice, InvoiceAdjustment, Payment, Sale, SaleItem


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
