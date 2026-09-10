"""Import new orders from the online store.

Run on a schedule, e.g. every 5 minutes:

    */5 * * * * cd /app && python manage.py sync_store_orders
"""
from django.core.management.base import BaseCommand

from orders.store_client import pull_orders


class Command(BaseCommand):
    help = "Pull new orders from the online store into the Orders module."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options):
        result = pull_orders(limit=options["limit"])
        if not result.get("ok"):
            self.stderr.write(self.style.ERROR(result.get("detail", "sync failed")))
            return
        self.stdout.write(self.style.SUCCESS(
            f"fetched={result['fetched']} imported={result['imported']} failed={result['failed']}"
        ))
