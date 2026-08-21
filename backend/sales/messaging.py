"""Send invoices to customers by email and SMS.

Both channels are pluggable: email uses Django's configured email backend
(console in dev), SMS posts to an HTTP gateway defined by
`settings.SMS_GATEWAY_URL` / `settings.SMS_GATEWAY_API_KEY`. Until a gateway is
connected the SMS is logged and recorded as `skipped` — no exception is raised,
so staff always get a clear per-channel result.
"""
from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

log = logging.getLogger(__name__)

SENT = "sent"
SKIPPED = "skipped"
FAILED = "failed"


def build_sms_text(invoice) -> str:
    """Short SMS: greets the customer, references invoice no. and amount."""
    name = (invoice.customer.contact_person or invoice.customer.name or "Customer").split(" ")[0]
    amount = f"KES {invoice.outstanding_balance or invoice.total_amount:,.2f}"
    company = getattr(settings, "COMPANY_NAME", "Peaceful Acres Farm")
    return (
        f"Hi {name}, invoice {invoice.invoice_number} of {amount} is due "
        f"{invoice.due_date:%d %b %Y}. Thank you for your business. {company}."
    )


def build_email_body(invoice) -> tuple[str, str]:
    name = invoice.customer.contact_person or invoice.customer.name or "Customer"
    lines = [
        f"{item.product_name} x {item.quantity} @ {item.unit_price}"
        for item in (invoice.sale.items.all() if getattr(invoice, "sale", None) else [])
    ]
    company = getattr(settings, "COMPANY_NAME", "Peaceful Acres Farm")
    text = (
        f"Dear {name},\n\n"
        f"Please find the details of invoice {invoice.invoice_number} below.\n\n"
        f"Issue date: {invoice.issue_date:%d %b %Y}\n"
        f"Due date:   {invoice.due_date:%d %b %Y}\n"
        + ("\n".join(lines) + "\n" if lines else "")
        + f"\nTotal:      KES {invoice.total_amount:,.2f}\n"
        f"Paid:       KES {invoice.amount_paid:,.2f}\n"
        f"Balance:    KES {invoice.outstanding_balance:,.2f}\n\n"
        f"View your invoice: {settings.FRONTEND_URL.rstrip('/')}/invoices/{invoice.id}\n\n"
        f"Thank you for your business.\n{company}\n"
    )
    subject = f"Invoice {invoice.invoice_number} — {company}"
    return subject, text


def send_email(invoice) -> tuple[str, str, str]:
    """Returns (status, recipient, detail)."""
    to = (invoice.customer.email or "").strip()
    if not to:
        return SKIPPED, "", "No email address on file for this customer."
    subject, text = build_email_body(invoice)
    try:
        message = EmailMultiAlternatives(
            subject, text, settings.DEFAULT_FROM_EMAIL, [to],
        )
        message.send(fail_silently=False)
    except Exception as exc:  # noqa: BLE001 — surfaced to staff, never fatal
        log.warning("invoice email failed for %s: %s", invoice.invoice_number, exc)
        return FAILED, to, str(exc)[:300]
    return SENT, to, "Email sent."


def send_sms(invoice) -> tuple[str, str, str]:
    """Returns (status, recipient, detail). No gateway configured => skipped."""
    to = (invoice.customer.phone or "").strip()
    if not to:
        return SKIPPED, "", "No phone number on file for this customer."

    text = build_sms_text(invoice)
    url = getattr(settings, "SMS_GATEWAY_URL", "")
    key = getattr(settings, "SMS_GATEWAY_API_KEY", "")
    if not url or not key:
        log.info("SMS (no gateway configured) to %s: %s", to, text)
        return SKIPPED, to, "SMS gateway not connected yet — message not sent."

    payload = json.dumps({
        "to": to,
        "message": text,
        "sender": getattr(settings, "SMS_SENDER_ID", ""),
    }).encode()
    req = urllib.request.Request(
        url, data=payload, method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:  # noqa: S310 — configured URL
            if resp.status >= 300:
                return FAILED, to, f"Gateway responded {resp.status}."
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        log.warning("invoice sms failed for %s: %s", invoice.invoice_number, exc)
        return FAILED, to, str(exc)[:300]
    return SENT, to, "SMS sent."
