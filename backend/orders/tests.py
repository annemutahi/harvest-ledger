"""Inbound store webhook and order status transitions."""
import json

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import UserRole

from .models import Order

User = get_user_model()
SECRET = "test-webhook-secret"
PASSWORD = "Str0ng!Passw0rd#26"

PAYLOAD = {
    "reference": "WEB-1001",
    "external_id": "gid://1",
    "store_source": "shop",
    "customer": {"name": "Jane Doe", "phone": "+254712345678", "address": "Nairobi"},
    "items": [
        {"name": "Maize 2kg", "quantity": 2, "unit_price": 150},
        {"name": "Kale bunch", "quantity": 1, "unit_price": 50},
    ],
}


@override_settings(SECURE_SSL_REDIRECT=False, ORDERS_WEBHOOK_SECRET=SECRET)
class OrderWebhookTests(APITestCase):
    url = "/api/public/orders/webhook/"

    def post(self, payload, secret=SECRET):
        headers = {"HTTP_X_WEBHOOK_SECRET": secret} if secret is not None else {}
        return self.client.post(
            self.url, data=json.dumps(payload), content_type="application/json", **headers,
        )

    def test_valid_payload_creates_pending_online_order(self):
        res = self.post(PAYLOAD)
        self.assertEqual(res.status_code, 202, res.content)
        order = Order.objects.get(reference="WEB-1001")
        self.assertEqual(order.channel, Order.ONLINE)
        self.assertEqual(order.status, Order.PENDING)
        self.assertEqual(order.customer_name, "Jane Doe")
        self.assertEqual(float(order.total), 350.0)
        self.assertEqual(order.items.count(), 2)

    def test_replay_updates_instead_of_duplicating(self):
        self.post(PAYLOAD)
        changed = {**PAYLOAD, "items": [{"name": "Maize 2kg", "quantity": 1, "unit_price": 150}]}
        res = self.post(changed)
        self.assertEqual(res.status_code, 202)
        self.assertEqual(Order.objects.filter(reference="WEB-1001").count(), 1)
        order = Order.objects.get(reference="WEB-1001")
        self.assertEqual(order.items.count(), 1)
        self.assertEqual(float(order.total), 150.0)

    def test_missing_or_wrong_secret_is_forbidden(self):
        self.assertEqual(self.post(PAYLOAD, secret="nope").status_code, 403)
        self.assertEqual(self.post(PAYLOAD, secret=None).status_code, 403)
        self.assertFalse(Order.objects.exists())

    def test_malformed_payloads_rejected(self):
        res = self.client.post(
            self.url, data="not json", content_type="application/json",
            HTTP_X_WEBHOOK_SECRET=SECRET,
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self.post({"reference": "X", "items": []}).status_code, 400)

    def test_get_not_allowed(self):
        self.assertEqual(self.client.get(self.url).status_code, 405)


@override_settings(SECURE_SSL_REDIRECT=False, ORDERS_WEBHOOK_SECRET=SECRET)
class OrderStatusTests(APITestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username="mgr", password=PASSWORD)
        UserRole.objects.create(user=self.manager, role="manager")
        self.viewer = User.objects.create_user(username="vw", password=PASSWORD)
        UserRole.objects.create(user=self.viewer, role="viewer")
        self.order = Order.objects.create(
            reference="WEB-2002", channel=Order.ONLINE, status=Order.PENDING,
            customer_name="Jane", total=100,
        )

    def test_manager_can_advance_status(self):
        self.client.force_authenticate(self.manager)
        res = self.client.patch(
            f"/api/orders/{self.order.id}/status/", {"status": "delivered"}, format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "delivered")

    def test_invalid_status_rejected(self):
        self.client.force_authenticate(self.manager)
        res = self.client.patch(
            f"/api/orders/{self.order.id}/status/", {"status": "teleported"}, format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_viewer_cannot_change_status(self):
        self.client.force_authenticate(self.viewer)
        res = self.client.patch(
            f"/api/orders/{self.order.id}/status/", {"status": "delivered"}, format="json",
        )
        self.assertEqual(res.status_code, 403)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.PENDING)
