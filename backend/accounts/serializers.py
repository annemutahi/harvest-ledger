from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    can_edit_sales = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "is_staff", "is_superuser", "can_edit_sales"]

    def get_can_edit_sales(self, obj) -> bool:
        return bool(obj.is_staff or obj.is_superuser)


class LoginSerializer(TokenObtainPairSerializer):
    """Adds the user payload to the /auth/login/ response."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["is_staff"] = user.is_staff
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
