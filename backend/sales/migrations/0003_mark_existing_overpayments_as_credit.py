from django.db import migrations
from django.db.models import F


def mark_overpayments_as_credit(apps, schema_editor):
    Invoice = apps.get_model("sales", "Invoice")
    Invoice.objects.filter(amount_paid__gt=F("total_amount")).update(status="credit")


def restore_paid_status(apps, schema_editor):
    Invoice = apps.get_model("sales", "Invoice")
    Invoice.objects.filter(status="credit").update(status="paid")


class Migration(migrations.Migration):
    dependencies = [("sales", "0002_invoice_credit_and_adjustments")]

    operations = [migrations.RunPython(mark_overpayments_as_credit, restore_paid_status)]
