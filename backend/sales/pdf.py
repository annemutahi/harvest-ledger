"""Render an invoice to a PDF byte string with ReportLab.

Kept dependency-light and self-contained so invoices can be attached to email
without the customer ever needing to reach the ERP itself.
"""
from __future__ import annotations

from io import BytesIO

from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

FOREST = colors.HexColor("#14532d")
LIGHT = colors.HexColor("#f1f5f0")
MUTED = colors.HexColor("#4b5563")

COMPANY = {
    "name": getattr(settings, "COMPANY_NAME", "Peaceful Acres Farm Limited"),
    "address": "P.O. Box 49670-00100",
    "location": "Nairobi, Kenya",
    "phone": "+254 741 961 786",
    "email": "peacefulacres19@gmail.com",
}

MPESA_PAYBILL = getattr(settings, "MPESA_PAYBILL", "000000")
MPESA_ACCOUNT = getattr(settings, "MPESA_ACCOUNT_NAME", COMPANY["name"])


def _money(value) -> str:
    return f"{float(value or 0):,.2f}"


def _styles():
    base = ParagraphStyle("base", fontName="Helvetica", fontSize=9, leading=12)
    return {
        "base": base,
        "small": ParagraphStyle("small", parent=base, fontSize=8, textColor=MUTED),
        "title": ParagraphStyle(
            "title", parent=base, fontName="Helvetica-Bold", fontSize=18,
            textColor=colors.white, leading=22,
        ),
        "white": ParagraphStyle("white", parent=base, textColor=colors.white),
        "h": ParagraphStyle(
            "h", parent=base, fontName="Helvetica-Bold", fontSize=10, textColor=FOREST,
        ),
    }


def invoice_filename(invoice) -> str:
    return f"Invoice-{invoice.invoice_number}.pdf"


def render_invoice_pdf(invoice) -> bytes:
    s = _styles()
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=16 * mm, rightMargin=16 * mm,
        topMargin=14 * mm, bottomMargin=16 * mm,
        title=invoice_filename(invoice),
    )
    story: list = []

    customer = invoice.customer
    customer_name = customer.name
    if invoice.store_name:
        customer_name = f"{customer_name} — {invoice.store_name}"

    # Header band
    header = Table(
        [[
            Paragraph(COMPANY["name"], s["title"]),
            Paragraph("INVOICE", ParagraphStyle("inv", parent=s["title"], alignment=2)),
        ], [
            Paragraph(
                f"{COMPANY['address']}<br/>{COMPANY['location']}<br/>"
                f"{COMPANY['phone']} · {COMPANY['email']}",
                s["white"],
            ),
            Paragraph(
                f"No. {invoice.invoice_number}"
                + (f"<br/>KRA eTIMS: {invoice.etims_number}" if invoice.etims_number else ""),
                ParagraphStyle("r", parent=s["white"], alignment=2),
            ),
        ]],
        colWidths=[doc.width * 0.6, doc.width * 0.4],
    )
    header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), FOREST),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, 0), 12),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 12),
    ]))
    story += [header, Spacer(1, 10 * mm)]

    # Bill to / dates
    meta = Table(
        [[
            Paragraph(
                "<b>BILL TO</b><br/>" + customer_name
                + (f"<br/>{customer.contact_person}" if customer.contact_person else "")
                + (f"<br/>{customer.phone}" if customer.phone else "")
                + (f"<br/>{customer.email}" if customer.email else ""),
                s["base"],
            ),
            Paragraph(
                f"<b>Issue date</b>  {invoice.issue_date:%d %b %Y}<br/>"
                f"<b>Due date</b>  {invoice.due_date:%d %b %Y}<br/>"
                f"<b>Status</b>  {invoice.get_status_display()}",
                ParagraphStyle("r2", parent=s["base"], alignment=2),
            ),
        ]],
        colWidths=[doc.width * 0.6, doc.width * 0.4],
    )
    meta.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story += [meta, Spacer(1, 8 * mm)]

    # Items
    sale = getattr(invoice, "sale", None)
    items = list(sale.items.all()) if sale else []
    rows = [["Item", "Qty", "Unit price", "Amount"]]
    for item in items:
        rows.append([
            item.product_name,
            _money(item.quantity),
            _money(item.unit_price),
            _money(item.line_total),
        ])
    if not items:
        rows.append(["—", "", "", _money(invoice.total_amount)])

    table = Table(
        rows, colWidths=[doc.width * 0.5, doc.width * 0.13, doc.width * 0.18, doc.width * 0.19],
        repeatRows=1,
    )
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), FOREST),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#d1d5db")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story += [table, Spacer(1, 8 * mm)]

    # Payment details + totals
    totals = Table(
        [
            ["Subtotal", _money(invoice.total_amount)],
            ["Paid", _money(invoice.amount_paid)],
            ["Balance due", _money(invoice.outstanding_balance)],
        ],
        colWidths=[doc.width * 0.22, doc.width * 0.18],
    )
    totals.setStyle(TableStyle([
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, -1), (-1, -1), LIGHT),
        ("TEXTCOLOR", (0, -1), (-1, -1), FOREST),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))

    pay = Paragraph(
        "<b>PAYMENT DETAILS</b><br/>"
        f"M-Pesa Paybill: {MPESA_PAYBILL}<br/>"
        f"Account name: {MPESA_ACCOUNT}<br/>"
        f"Reference: {invoice.invoice_number}",
        s["base"],
    )
    footer = Table([[pay, totals]], colWidths=[doc.width * 0.55, doc.width * 0.45])
    footer.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
    ]))
    story += [footer, Spacer(1, 10 * mm)]

    story.append(Paragraph(
        "Thank you for your business. This invoice was generated by "
        f"{COMPANY['name']}.", s["small"],
    ))

    doc.build(story)
    return buffer.getvalue()
