import os
import django
import sys

# Ensure project root is on path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "farm_erp.settings")

django.setup()

from django.contrib.auth import get_user_model
from accounts.serializers import UserRoleWriteSerializer
from accounts.roles import ROLE_CHOICES

User = get_user_model()
user = User.objects.first()
if not user:
    print("No users found in DB. Create a user and retry.")
    sys.exit(1)

print("User:", user)
print("Role choices:", [c[0] for c in ROLE_CHOICES])

# Representation
try:
    ser = UserRoleWriteSerializer(user)
    print("Serialized output:", ser.data)
except Exception as e:
    print("Representation error:", type(e).__name__, e)

# Attempt update with first role choice
test_role = [c[0] for c in ROLE_CHOICES][0]
print("Testing update with role=", test_role)
ser2 = UserRoleWriteSerializer(user, data={"role": test_role}, partial=True)
if not ser2.is_valid():
    print("Update validation failed:", ser2.errors)
else:
    try:
        ser2.update(user, ser2.validated_data)
        print("Update applied. Re-serialized:", UserRoleWriteSerializer(user).data)
    except Exception as e:
        print("Update error:", type(e).__name__, e)
