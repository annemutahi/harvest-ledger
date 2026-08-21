"""Assign an app role to a user.

Usage:
    python manage.py set_role <username> admin
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from accounts.models import UserRole
from accounts.roles import ADMIN, MANAGER, ROLE_CHOICES

ROLE_VALUES = [value for value, _ in ROLE_CHOICES]


class Command(BaseCommand):
    help = "Assign an app role (admin, manager, sales, storekeeper, viewer) to a user."

    def add_arguments(self, parser):
        parser.add_argument("username")
        parser.add_argument("role", choices=ROLE_VALUES)

    def handle(self, *args, **options):
        User = get_user_model()
        username = options["username"]
        role = options["role"]
        user = User.objects.filter(username__iexact=username).first()
        if not user:
            raise CommandError(f"No user named {username!r}.")

        UserRole.objects.update_or_create(user=user, defaults={"role": role})
        if role in (ADMIN, MANAGER) and not user.is_staff:
            user.is_staff = True
            user.save(update_fields=["is_staff"])

        self.stdout.write(self.style.SUCCESS(f"{user.username} is now {role}."))
