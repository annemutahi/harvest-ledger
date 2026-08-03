import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("sales", "0003_mark_existing_overpayments_as_credit")]

    operations = [
        migrations.CreateModel(
            name="CreditApplication",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("amount", models.DecimalField(decimal_places=2, max_digits=14)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("source_invoice", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="credit_uses", to="sales.invoice")),
                ("target_invoice", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="credit_applications", to="sales.invoice")),
            ],
            options={"ordering": ["created_at", "id"]},
        ),
        migrations.AddConstraint(
            model_name="creditapplication",
            constraint=models.CheckConstraint(condition=models.Q(("amount__gt", 0)), name="credit_application_amount_positive"),
        ),
    ]
