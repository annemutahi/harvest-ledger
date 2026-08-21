"""Render an invoice to a PDF that mirrors the on-screen invoice document.

Same branding as the app: circular logo, forest-green header, boxed bill-to /
payment-method / invoice-number panels, green table head, payment details next
to the totals, signature lines, a faint farm watermark and the farm landscape
footer strip.
"""
from __future__ import annotations

from io import BytesIO
from pathlib import Path

from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

FOREST = colors.HexColor("#14532d")
FOREST_SOFT = colors.HexColor("#eaf1ea")
LIGHT = colors.HexColor("#f1f5f0")
MUTED = colors.HexColor("#4b5563")
BORDER = colors.HexColor("#a7bfa9")

ROOT = Path(getattr(settings, "BASE_DIR", Path(__file__).resolve().parents[2])).parent
LOGO_PATH = ROOT / "public" / "assets" / "favicon.png"
WATERMARK_PATH = ROOT / "src" / "assets" / "farm-watermark.png"
FOOTER_PATH = ROOT / "src" / "assets" / "farm-footer.png"

COMPANY = {
    "name": getattr(settings, "COMPANY_NAME", "Peaceful Acres Farm Limited"),
    "tagline": "Fresh, Organic Produce",
    "address": "P.O. Box 49670-00100",
    "location": "Nairobi, Kenya",
    "phone": "+254 741 961 786",
    "email": "peacefulacres19@gmail.com",
}

MPESA_PAYBILL = getattr(settings, "MPESA_PAYBILL", "522522")
MPESA_ACCOUNT_NUMBER = getattr(settings, "MPESA_ACCOUNT_NUMBER", "1266084088")
MPESA_ACCOUNT = getattr(settings, "MPESA_ACCOUNT_NAME", "Peaceful Acres Farm")

FOOTER_HEIGHT = 26 * mm


def _money(value) -> str:
    amount = float(value or 0)
    if abs(amount - round(amount)) < 0.005:
        return f"Ksh {round(amount):,}"
    return f"Ksh {amount:,.2f}"


def _qty(value) -> str:
    amount = float(value or 0)
    if abs(amount - round(amount)) < 0.005:
        return f"{round(amount):,}"
    return f"{amount:,.2f}"


class FlexSpacer(Spacer):
    """Grows to push the following block to the bottom of the page."""

    def __init__(self, reserved: float, minimum: float = 6 * mm):
        super().__init__(0, minimum)
        self.reserved = reserved
        self.minimum = minimum

    def wrap(self, availWidth, availHeight):  # noqa: N803
        return 0, max(self.minimum, availHeight - self.reserved)


def _styles():
    base = ParagraphStyle("base", fontName="Helvetica", fontSize=9, leading=12)
    return {
        "base": base,
        "small": ParagraphStyle("small", parent=base, fontSize=8, textColor=MUTED),
        "label": ParagraphStyle(
            "label", parent=base, fontName="Helvetica-Bold", fontSize=7,
            textColor=colors.white,
        ),
        "muted": ParagraphStyle("muted", parent=base, textColor=MUTED),
        "right": ParagraphStyle("right", parent=base, alignment=2),
        "title": ParagraphStyle(
            "title", parent=base, fontName="Helvetica-Bold", fontSize=17,
            textColor=FOREST, leading=20,
        ),
        "white": ParagraphStyle("white", parent=base, textColor=colors.white),
        "center": ParagraphStyle(
            "center", parent=base, alignment=1, textColor=FOREST,
            fontName="Helvetica-Bold",
        ),
    }


def invoice_filename(invoice) -> str:
    return f"Invoice-{invoice.invoice_number}.pdf"


def _chip(text, s, width=None):
    """A small green uppercase pill like the on-screen labels."""
    text = text.upper()
    pill_width = 5.2 * len(text) + 12
    chip = Table([[Paragraph(text, s["label"])]], colWidths=[pill_width], hAlign="LEFT")
    chip.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), FOREST),
        ("ROUNDEDCORNERS", [3, 3, 3, 3]),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    if width is None:
        return chip
    row = Table([[chip, ""]], colWidths=[pill_width, max(1, width - pill_width)])
    row.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return row


def _status_pill(text, s):
    pill = Table([[Paragraph(
        text.upper(),
        ParagraphStyle("pill", parent=s["base"], fontName="Helvetica-Bold",
                       fontSize=7, textColor=FOREST, alignment=1),
    )]], colWidths=[5.6 * len(text) + 12], hAlign="RIGHT")
    pill.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), FOREST_SOFT),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
    ]))
    return pill


def _panel(rows, width, background=None):
    """A bordered white panel wrapping the given flowable rows."""
    panel = Table([[r] for r in rows], colWidths=[width])
    style = [
        ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]
    if background is not None:
        style.append(("BACKGROUND", (0, 0), (-1, -1), background))
    panel.setStyle(TableStyle(style))
    return panel



def _decorations(canvas, doc):
    """Watermark behind the content and the farm landscape footer strip."""
    canvas.saveState()
    if WATERMARK_PATH.exists():
        try:
            img = ImageReader(str(WATERMARK_PATH))
            iw, ih = img.getSize()
            w = doc.width * 0.68
            h = w * ih / iw
            canvas.setFillAlpha(0.07)
            canvas.drawImage(
                img, (A4[0] - w) / 2, A4[1] * 0.30, width=w, height=h,
                mask="auto", preserveAspectRatio=True,
            )
            canvas.setFillAlpha(1)
        except Exception:  # noqa: BLE001 — decoration must never break the PDF
            pass
    if FOOTER_PATH.exists():
        try:
            canvas.drawImage(
                ImageReader(str(FOOTER_PATH)), 0, 0, width=A4[0], height=FOOTER_HEIGHT,
                mask="auto", preserveAspectRatio=False, anchor="c",
            )
        except Exception:  # noqa: BLE001
            pass
    canvas.restoreState()



def render_invoice_pdf(invoice) -> bytes:
    s = _styles()
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=12 * mm, bottomMargin=FOOTER_HEIGHT + 6 * mm,
        title=invoice_filename(invoice),
    )
    story: list = []
    W = doc.width

    customer = invoice.customer
    customer_name = customer.name
    if invoice.store_name:
        customer_name = f"{customer_name} - {invoice.store_name}"

    # ---- Header: logo + company, contacts on the right -------------------
    logo = (
        Image(str(LOGO_PATH), width=20 * mm, height=20 * mm)
        if LOGO_PATH.exists() else Paragraph("", s["base"])
    )
    brand = Table(
        [[logo, Paragraph(
            f"<b>{COMPANY['name']}</b><br/>"
            f"<font size=8 color='#4b5563'>{COMPANY['tagline']}</font>",
            s["title"],
        )]],
        colWidths=[23 * mm, W * 0.55 - 23 * mm],
    )
    brand.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ]))

    header = Table(
        [[brand, Paragraph(
            f"{COMPANY['phone']}<br/>{COMPANY['email']}<br/>"
            f"{COMPANY['address']}<br/>{COMPANY['location']}",
            ParagraphStyle("hr", parent=s["muted"], alignment=2),
        )]],
        colWidths=[W * 0.55, W * 0.45],
    )
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story += [header, Spacer(1, 4 * mm)]

    # ---- Bill to / payment method / invoice meta panels ------------------
    col = (W - 6 * mm) / 2
    inner = col - 16
    bill_lines = [
        _chip("Bill to", s, inner),
        Spacer(1, 3),
        Paragraph(f"<b>{customer_name}</b>", s["base"]),
    ]
    if customer.contact_person:
        bill_lines.append(Paragraph(customer.contact_person, s["muted"]))
    if customer.phone:
        bill_lines.append(Paragraph(customer.phone, s["muted"]))
    if customer.email:
        bill_lines.append(Paragraph(customer.email, s["muted"]))
    bill = _panel(bill_lines, inner + 16)

    payment_type = (getattr(invoice, "payment_type", "") or "Credit").title()
    method = _panel([
        _chip("Payment method", s, inner),
        Spacer(1, 3),
        Table(
            [[Paragraph(payment_type, s["base"]),
              _status_pill(invoice.get_status_display(), s)]],
            colWidths=[inner * 0.5, inner * 0.5],
            style=TableStyle([
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("RIGHTPADDING", (1, 0), (1, 0), 2),
            ]),
        ),
    ], inner + 16)

    key = ParagraphStyle("k", parent=s["muted"], fontSize=8)
    meta_rows = [
        [Paragraph("DATE", key), Paragraph(f"{invoice.issue_date:%d %b %Y}", s["right"])],
        [Paragraph("DUE", key), Paragraph(f"{invoice.due_date:%d %b %Y}", s["right"])],
    ]
    if invoice.etims_number:
        meta_rows.append([
            Paragraph("KRA ETIMS NO.", key),
            Paragraph(invoice.etims_number, s["right"]),
        ])
    right_inner = col + 6 * mm - 32
    meta_table = Table(meta_rows, colWidths=[right_inner * 0.45, right_inner * 0.55])
    meta_table.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))

    meta_head = Table(
        [[_chip("Invoice no.", s),
          Paragraph(f"<b>{invoice.invoice_number}</b>",
                    ParagraphStyle("no", parent=s["base"], alignment=2, fontSize=14,
                                   fontName="Helvetica-Bold", textColor=colors.black))]],
        colWidths=[right_inner * 0.45, right_inner * 0.55],
    )
    meta_head.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))

    left_stack = Table([[bill], [Spacer(1, 3 * mm)], [method]], colWidths=[col])
    left_stack.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    panels = Table(
        [[left_stack, _panel([meta_head, meta_table], right_inner + 16)]],
        colWidths=[col, col + 6 * mm],
    )
    panels.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (-1, 0), (-1, 0), 0),
    ]))
    story += [panels, Spacer(1, 6 * mm)]

    # Thick green rule separating the header block from the items
    rule = Table([[""]], colWidths=[W], rowHeights=[2.5])
    rule.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), FOREST)]))
    story += [rule, Spacer(1, 6 * mm)]

    # ---- Items -----------------------------------------------------------
    sale = getattr(invoice, "sale", None)
    items = list(sale.items.all()) if sale else []
    rows = [["NO.", "DESCRIPTION", "QTY", "UNIT PRICE (KSH)", "AMOUNT (KSH)"]]
    for i, item in enumerate(items, start=1):
        rows.append([
            str(i), item.product_name, _qty(item.quantity),
            _money(item.unit_price), _money(item.line_total),
        ])
    if not items:
        rows.append(["1", "—", "", "", _money(invoice.total_amount)])

    table = Table(
        rows,
        colWidths=[W * 0.08, W * 0.42, W * 0.12, W * 0.19, W * 0.19],
        repeatRows=1,
    )
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), FOREST),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#e5e7eb")),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story += [table]

    # ---- Payment details + totals ---------------------------------------
    pay = _panel([
        Paragraph("<b><font color='#14532d'>PAYMENT DETAILS</font></b>", s["small"]),
        Spacer(1, 3),
        Table(
            [
                [Paragraph("M-Pesa Paybill", s["muted"]), Paragraph(f"<b>{MPESA_PAYBILL}</b>", s["right"])],
                [Paragraph("Account number", s["muted"]), Paragraph(f"<b>{MPESA_ACCOUNT_NUMBER}</b>", s["right"])],
                [Paragraph(f"<b>{MPESA_ACCOUNT}</b>", s["base"]), Paragraph("", s["right"])],
            ],
            colWidths=[inner * 0.45, inner * 0.55],
            style=TableStyle([
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]),
        ),
    ], inner + 16, background=colors.HexColor("#f6faf6"))

    balance = float(invoice.outstanding_balance or 0)
    totals = Table(
        [
            ["Subtotal", _money(invoice.total_amount)],
            ["Paid", _money(invoice.amount_paid)],
            ["Overdraft" if balance < 0 else "Balance Due", _money(abs(balance))],
        ],
        colWidths=[col * 0.5, col * 0.5],
    )
    totals.setStyle(TableStyle([
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("TEXTCOLOR", (0, 0), (0, -2), MUTED),
        ("TEXTCOLOR", (1, 1), (1, 1), FOREST),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, colors.HexColor("#e5e7eb")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 11),
        ("BACKGROUND", (0, -1), (-1, -1), FOREST),
        ("TEXTCOLOR", (0, -1), (-1, -1), colors.white),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, -1), (-1, -1), 8),
        ("RIGHTPADDING", (0, -1), (-1, -1), 8),
    ]))

    footer = Table([[pay, totals]], colWidths=[col, col + 6 * mm])
    footer.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (-1, 0), (-1, 0), 0),
    ]))

    # ---- Signatures + closing line --------------------------------------
    signatures = Table(
        [[Paragraph("RECEIVED BY", s["small"]), Paragraph("CUSTOMER SIGNATURE", s["small"])],
         ["", ""]],
        colWidths=[col, col + 6 * mm], rowHeights=[12, 16],
    )
    signatures.setStyle(TableStyle([
        ("LINEBELOW", (0, 1), (0, 1), 0.6, colors.HexColor("#9ca3af")),
        ("LINEBELOW", (1, 1), (1, 1), 0.6, colors.HexColor("#9ca3af")),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("LINEABOVE", (0, 0), (-1, 0), 0.4, colors.HexColor("#e5e7eb")),
        ("TOPPADDING", (0, 0), (-1, 0), 10),
    ]))

    closing = Paragraph(
        "From Our Farm to Your Table. Thank you for supporting local farmers.",
        s["center"],
    )
    bottom_block = [footer, Spacer(1, 9 * mm), signatures, Spacer(1, 6 * mm), closing]

    reserved = 0.0
    for flowable in bottom_block:
        reserved += flowable.wrap(W, A4[1])[1]
    story.append(FlexSpacer(reserved + 4 * mm, minimum=10 * mm))
    story.append(KeepTogether(bottom_block))

    doc.build(story, onFirstPage=_decorations, onLaterPages=_decorations)

    return buffer.getvalue()
