"""Push order status changes back to the online store.

Any exception raised here is caught in `OrderViewSet.status` — a failing
sync must never break the local status update.
"""
from __future__ import annotations

import logging

from .store_client import STATUS_OUT, _call, is_configured

log = logging.getLogger(__name__)


def push_status_to_store(order) -> None:
    if not is_configured() or not order.external_id:
        return
    store_status = STATUS_OUT.get(order.status)
    if not store_status:
        return
    _call("POST", "orders/", {
        "order_id": order.external_id,
        "erp_order_ref": order.reference,
        "status": store_status,
    })
    log.info("pushed status %s for %s to store", store_status, order.reference)
