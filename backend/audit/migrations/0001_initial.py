from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AuditLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("timestamp", models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ("username", models.CharField(blank=True, default="", max_length=150)),
                ("action", models.CharField(choices=[
                    ("create", "Create"), ("update", "Update"), ("delete", "Delete"),
                    ("restore", "Restore"), ("login", "Login"), ("logout", "Logout"),
                ], max_length=16)),
                ("model", models.CharField(db_index=True, max_length=100)),
                ("object_id", models.CharField(blank=True, default="", max_length=64)),
                ("object_repr", models.CharField(blank=True, default="", max_length=255)),
                ("changes", models.JSONField(blank=True, null=True)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("user", models.ForeignKey(blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="+", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-timestamp"],
            },
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["model", "object_id"], name="audit_audit_model_a3ee6d_idx"),
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["action", "-timestamp"], name="audit_audit_action_54b1e2_idx"),
        ),
    ]
