"""Optional: push order status changes back to the online store.

Implement this to call your store's REST API. Credentials come from
`settings.STORE_API_URL` / `settings.STORE_API_KEY`.

Any exception raised here is caught in `OrderViewSet.status` — a failing
sync must never break the local status update.
"""
from __future__ import annotations

import logging

from django.conf import settings

log = logging.getLogger(__name__)


def push_status_to_store(order) -> None:
    if not settings.STORE_API_URL or not settings.STORE_API_KEY:
        return
    # Example (using stdlib http.client so we don't require `requests`):
    #
    #   import http.client, json
    #   from urllib.parse import urlparse
    #   u = urlparse(settings.STORE_API_URL)
    #   conn = http.client.HTTPSConnection(u.netloc, timeout=5)
    #   body = json.dumps({"reference": order.reference, "status": order.status})
    #   conn.request("POST", f"{u.path.rstrip('/')}/orders/{order.external_id}/status",
    #                body=body,
    #                headers={
    #                    "Content-Type": "application/json",
    #                    "Authorization": f"Bearer {settings.STORE_API_KEY}",
    #                })
    #   resp = conn.getresponse(); resp.read(); conn.close()
    #   if resp.status >= 400:
    #       raise RuntimeError(f"store returned {resp.status}")
    log.info("would push status %s for %s to %s", order.status, order.reference,
             settings.STORE_API_URL)
