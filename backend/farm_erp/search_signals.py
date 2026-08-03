from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.core.cache import cache

from customers.models import Customer
from orders.models import Order
from sales.models import Invoice


def bump_search_version():
    """Increment the global search cache version. Uses cache.incr when
    available for atomic increments; falls back to get/set.
    """
    try:
        # atomic if supported by backend
        cache.incr("global_search:version")
    except Exception:
        try:
            v = int(cache.get("global_search:version") or 0)
        except Exception:
            v = 0
        try:
            cache.set("global_search:version", v + 1)
        except Exception:
            # best-effort: ignore cache errors
            pass


@receiver(post_save, sender=Customer)
@receiver(post_delete, sender=Customer)
def customer_changed(sender, **kwargs):
    bump_search_version()


@receiver(post_save, sender=Order)
@receiver(post_delete, sender=Order)
def order_changed(sender, **kwargs):
    bump_search_version()


@receiver(post_save, sender=Invoice)
@receiver(post_delete, sender=Invoice)
def invoice_changed(sender, **kwargs):
    bump_search_version()
