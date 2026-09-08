from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

from .pdf import invoice_filename, render_invoice_pdf

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
        f"{invoice.due_date:%d %b %Y}. Thank you for supporting our business. {company}."
    )


def build_email_body(invoice) -> tuple[str, str]:
    """Short covering note; the invoice itself travels as a PDF attachment."""
    name = invoice.customer.contact_person or invoice.customer.name or "Customer"
    company = getattr(settings, "COMPANY_NAME", "Peaceful Acres Farm")
    text = (
        f"Dear {name},\n\n"
        f"Please find attached invoice {invoice.invoice_number} for "
        f"KES {invoice.total_amount:,.2f}, due {invoice.due_date:%d %b %Y}.\n\n"
        f"Thank you for supporting our business.\n{company}\n"
    )
    subject = f"Invoice {invoice.invoice_number} - {company}"
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
        try:
            message.attach(
                invoice_filename(invoice), render_invoice_pdf(invoice), "application/pdf",
            )
        except Exception as exc:  # noqa: BLE001 — never block the send on rendering
            log.warning("invoice pdf failed for %s: %s", invoice.invoice_number, exc)
        message.send(fail_silently=False)
    except Exception as exc:  # noqa: BLE001 — surfaced to staff, never fatal
        log.warning("invoice email failed for %s: %s", invoice.invoice_number, exc)
        return FAILED, to, str(exc)[:300]
    return SENT, to, "Email sent with the invoice PDF attached."


def normalise_msisdn(raw: str, country_code: str = "254") -> str:
    """Turn 0722..., 722..., +254722... into +254722... (E.164)."""
    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        return ""
    if digits.startswith(country_code):
        pass
    elif digits.startswith("0"):
        digits = country_code + digits[1:]
    else:
        digits = country_code + digits
    return "+" + digits


def _africastalking_send(to: str, text: str) -> tuple[str, str, str]:
    username = getattr(settings, "AT_USERNAME", "")
    api_key = getattr(settings, "AT_API_KEY", "")
    base = (
        "https://api.sandbox.africastalking.com"
        if username == "sandbox" or getattr(settings, "AT_SANDBOX", False)
        else "https://api.africastalking.com"
    )
    url = f"{base}/version1/messaging"
    fields = {"username": username, "to": to, "message": text}
    sender = getattr(settings, "AT_SENDER_ID", "") or getattr(settings, "SMS_SENDER_ID", "")
    if sender:
        fields["from"] = sender

    req = urllib.request.Request(
        url,
        data=urllib.parse.urlencode(fields).encode(),
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "apiKey": api_key,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:  # noqa: S310 — fixed host
            body = json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:300]
        log.warning("africastalking http %s: %s", exc.code, detail)
        return FAILED, to, f"Africa's Talking responded {exc.code}: {detail}"
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
        log.warning("africastalking sms failed: %s", exc)
        return FAILED, to, str(exc)[:300]

    recipients = (body.get("SMSMessageData") or {}).get("Recipients") or []
    if not recipients:
        message = (body.get("SMSMessageData") or {}).get("Message", "No recipients accepted.")
        return FAILED, to, str(message)[:300]
    first = recipients[0]
    status_code = int(first.get("statusCode") or 0)
    if status_code in (100, 101, 102):
        return SENT, to, f"SMS queued by Africa's Talking ({first.get('status', 'Success')})."
    return FAILED, to, f"Africa's Talking: {first.get('status', 'rejected')} ({status_code})."


def send_sms(invoice) -> tuple[str, str, str]:
    """Returns (status, recipient, detail). No gateway configured => skipped."""
    raw = (invoice.customer.phone or "").strip()
    if not raw:
        return SKIPPED, "", "No phone number on file for this customer."
    to = normalise_msisdn(raw)
    if not to:
        return SKIPPED, raw, "Phone number on file is not a valid number."

    text = build_sms_text(invoice)

    if getattr(settings, "AT_USERNAME", "") and getattr(settings, "AT_API_KEY", ""):
        return _africastalking_send(to, text)

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
