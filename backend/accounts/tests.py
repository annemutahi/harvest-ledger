"""Role-based access tests for user management endpoints."""
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import UserRole

User = get_user_model()

PASSWORD = "Str0ng!Passw0rd#26"


def make_user(username, role):
    user = User.objects.create_user(username=username, password=PASSWORD)
    UserRole.objects.create(user=user, role=role)
    return user


@override_settings(SECURE_SSL_REDIRECT=False)
class UserManagementAccessTests(APITestCase):
    def setUp(self):
        self.users = {
            role: make_user(f"u_{role}", role)
            for role in ("admin", "manager", "sales", "storekeeper", "viewer")
        }

    def auth(self, role):
        self.client.force_authenticate(self.users[role])

    def test_list_users_access(self):
        # admin + manager can view the team; everyone else is denied
        for role, expected in [
            ("admin", 200),
            ("manager", 200),
            ("sales", 403),
            ("storekeeper", 403),
            ("viewer", 403),
        ]:
            self.auth(role)
            res = self.client.get("/api/auth/users/")
            self.assertEqual(res.status_code, expected, f"{role} list -> {res.status_code}")

    def test_create_user_only_admin(self):
        for role, expected in [
            ("manager", 403),
            ("sales", 403),
            ("storekeeper", 403),
            ("viewer", 403),
            ("admin", 201),
        ]:
            self.auth(role)
            res = self.client.post(
                "/api/auth/users/",
                {
                    "username": f"new_{role}",
                    "email": f"new_{role}@example.com",
                    "password": PASSWORD,
                    "role": "sales",
                },
                format="json",
            )
            self.assertEqual(res.status_code, expected, f"{role} create -> {res.content}")

    def test_created_user_can_sign_in_with_initial_password(self):
        self.auth("admin")
        res = self.client.post(
            "/api/auth/users/",
            {"username": "fieldhand", "password": PASSWORD, "role": "storekeeper"},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data["role"], "storekeeper")

        self.client.force_authenticate(None)
        login = self.client.post(
            "/api/auth/login/",
            {"username": "fieldhand", "password": PASSWORD},
            format="json",
        )
        self.assertEqual(login.status_code, 200, login.content)
        self.assertEqual(login.data["user"]["role"], "storekeeper")
        self.assertEqual(login.data["user"]["permissions"]["stock"], ["view", "add", "change"])
        self.assertEqual(login.data["user"]["permissions"]["users"], [])

    def test_weak_password_and_duplicates_rejected(self):
        self.auth("admin")
        weak = self.client.post(
            "/api/auth/users/",
            {"username": "weakling", "password": "12345", "role": "sales"},
            format="json",
        )
        self.assertEqual(weak.status_code, 400)

        dup = self.client.post(
            "/api/auth/users/",
            {"username": "U_Sales", "password": PASSWORD, "role": "sales"},
            format="json",
        )
        self.assertEqual(dup.status_code, 400)

    def test_role_change_allowed_for_admin_only(self):
        target = self.users["viewer"]
        self.auth("manager")
        res = self.client.patch(
            f"/api/auth/users/{target.id}/", {"role": "manager"}, format="json"
        )
        self.assertEqual(res.status_code, 403)

        self.auth("admin")
        res = self.client.patch(
            f"/api/auth/users/{target.id}/", {"role": "manager"}, format="json"
        )
        self.assertEqual(res.status_code, 200, res.content)
        target.refresh_from_db()
        self.assertEqual(target.role_profile.role, "manager")

    def test_anonymous_blocked(self):
        self.client.force_authenticate(None)
        self.assertIn(self.client.get("/api/auth/users/").status_code, (401, 403))
        self.assertIn(
            self.client.post(
                "/api/auth/users/",
                {"username": "x", "password": PASSWORD, "role": "admin"},
                format="json",
            ).status_code,
            (401, 403),
        )
