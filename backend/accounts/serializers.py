from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .roles import ROLE_CHOICES, has_perm, permissions_for, role_for

User = get_user_model()


class RoleField(serializers.Field):
    """Serializer field that reads the user's role via `role_for(user)` and
    accepts a role choice string on input.
    """

    def __init__(self, choices=None, **kwargs):
        # allow passing ROLE_CHOICES directly
        self._choices = [c[0] for c in choices] if choices is not None else None
        # don't override source; we'll control attribute access via get_attribute
        super().__init__(**kwargs)

    def get_attribute(self, instance):
        # During serialization, return the entire user instance so
        # `to_representation` receives the user object.
        return instance

    def to_representation(self, obj):
        # obj will be the User instance because source='*'
        return role_for(obj)

    def to_internal_value(self, data):
        if self._choices is not None and data not in self._choices:
            raise serializers.ValidationError("Invalid role")
        return data


class UserSerializer(serializers.ModelSerializer):
    can_edit_sales = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "is_staff",
            "is_superuser",
            "can_edit_sales",
            "role",
            "permissions",
        ]

    def get_can_edit_sales(self, obj) -> bool:
        return has_perm(obj, "sales", "change")

    def get_role(self, obj) -> str | None:
        return role_for(obj)

    def get_permissions(self, obj) -> dict:
        return permissions_for(obj)


class UserRoleWriteSerializer(UserSerializer):
    """Admin-facing serializer that allows changing a user's role."""

    role = RoleField(choices=ROLE_CHOICES)

    def update(self, instance, validated_data):
        role = validated_data.get("role")
        if role:
            from .models import UserRole

            UserRole.objects.update_or_create(user=instance, defaults={"role": role})
        return instance


class LoginSerializer(TokenObtainPairSerializer):
    """Adds the user payload to the /auth/login/ response."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["is_staff"] = user.is_staff
        token["role"] = role_for(user)
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
