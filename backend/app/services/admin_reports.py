"""Finance report generation — CSV (always available) + PDF (reportlab).

Used by /admin/payments/reports. Each report type is a small pure builder
that takes a SQLAlchemy session + date range and returns a list of rows
(headers + data). Output formatters then turn rows into a streamable file.

Report types:
  * daily_collections          — one row per day (gross, commission, net, tx_count)
  * weekly_collections         — one row per ISO week
  * monthly_collections        — one row per calendar month
  * country_breakdown          — collections grouped by country_code
  * commission_revenue         — daily commission earned
  * pending_liabilities        — current snapshot of pending payouts per beneficiary
  * completed_settlements      — settled withdrawal requests in range
  * failed_payments            — failed transactions in range
  * vendor_earnings            — net earned per service-providing user
  * organizer_earnings         — net earned per event-organizing user
"""

from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Iterable

from sqlalchemy import func, and_
from sqlalchemy.orm import Session

from models.payments import Transaction, Wallet
from models.withdrawal_requests import WithdrawalRequest
from models.users import User
from models.events import Event
from models.services import UserService
from models.enums import (
    TransactionStatusEnum,
    PaymentTargetTypeEnum,
    WithdrawalRequestStatusEnum,
)


# ──────────────────────────────────────────────
# Builders — return (headers, rows) tuple
# ──────────────────────────────────────────────

ReportRow = list
Report = tuple[list[str], list[ReportRow]]


def _completed_tx_query(db: Session, start: date, end: date):
    return (
        db.query(Transaction)
        .filter(
            Transaction.status.in_([TransactionStatusEnum.paid, TransactionStatusEnum.credited]),
            func.date(Transaction.completed_at) >= start,
            func.date(Transaction.completed_at) <= end,
        )
    )


def daily_collections(db: Session, start: date, end: date) -> Report:
    rows = (
        _completed_tx_query(db, start, end)
        .with_entities(
            func.date(Transaction.completed_at).label("d"),
            func.count(Transaction.id),
            func.coalesce(func.sum(Transaction.gross_amount), 0),
            func.coalesce(func.sum(Transaction.commission_amount), 0),
            func.coalesce(func.sum(Transaction.net_amount), 0),
        )
        .group_by("d")
        .order_by("d")
        .all()
    )
    return (
        ["Date", "Transactions", "Gross", "Commission", "Net"],
        [[str(r[0]), int(r[1]), float(r[2]), float(r[3]), float(r[4])] for r in rows],
    )


def weekly_collections(db: Session, start: date, end: date) -> Report:
    rows = (
        _completed_tx_query(db, start, end)
        .with_entities(
            func.to_char(Transaction.completed_at, "IYYY-IW").label("wk"),
            func.count(Transaction.id),
            func.coalesce(func.sum(Transaction.gross_amount), 0),
            func.coalesce(func.sum(Transaction.commission_amount), 0),
            func.coalesce(func.sum(Transaction.net_amount), 0),
        )
        .group_by("wk")
        .order_by("wk")
        .all()
    )
    return (
        ["ISO Week", "Transactions", "Gross", "Commission", "Net"],
        [[r[0], int(r[1]), float(r[2]), float(r[3]), float(r[4])] for r in rows],
    )


def monthly_collections(db: Session, start: date, end: date) -> Report:
    rows = (
        _completed_tx_query(db, start, end)
        .with_entities(
            func.to_char(Transaction.completed_at, "YYYY-MM").label("m"),
            func.count(Transaction.id),
            func.coalesce(func.sum(Transaction.gross_amount), 0),
            func.coalesce(func.sum(Transaction.commission_amount), 0),
            func.coalesce(func.sum(Transaction.net_amount), 0),
        )
        .group_by("m")
        .order_by("m")
        .all()
    )
    return (
        ["Month", "Transactions", "Gross", "Commission", "Net"],
        [[r[0], int(r[1]), float(r[2]), float(r[3]), float(r[4])] for r in rows],
    )


def country_breakdown(db: Session, start: date, end: date) -> Report:
    rows = (
        _completed_tx_query(db, start, end)
        .with_entities(
            Transaction.country_code,
            Transaction.currency_code,
            func.count(Transaction.id),
            func.coalesce(func.sum(Transaction.gross_amount), 0),
            func.coalesce(func.sum(Transaction.commission_amount), 0),
            func.coalesce(func.sum(Transaction.net_amount), 0),
        )
        .group_by(Transaction.country_code, Transaction.currency_code)
        .order_by(Transaction.country_code)
        .all()
    )
    return (
        ["Country", "Currency", "Transactions", "Gross", "Commission", "Net"],
        [[r[0], r[1], int(r[2]), float(r[3]), float(r[4]), float(r[5])] for r in rows],
    )


def commission_revenue(db: Session, start: date, end: date) -> Report:
    rows = (
        _completed_tx_query(db, start, end)
        .with_entities(
            func.date(Transaction.completed_at).label("d"),
            Transaction.currency_code,
            func.coalesce(func.sum(Transaction.commission_amount), 0),
        )
        .group_by("d", Transaction.currency_code)
        .order_by("d")
        .all()
    )
    return (
        ["Date", "Currency", "Commission Earned"],
        [[str(r[0]), r[1], float(r[2])] for r in rows],
    )


def pending_liabilities(db: Session, start: date, end: date) -> Report:
    """Snapshot — date range is informational only; this is the live picture."""
    rows = (
        db.query(
            Wallet.user_id,
            User.first_name,
            User.last_name,
            User.phone,
            Wallet.currency_code,
            Wallet.pending_balance,
            Wallet.available_balance,
        )
        .join(User, User.id == Wallet.user_id)
        .filter(Wallet.pending_balance > 0)
        .order_by(Wallet.pending_balance.desc())
        .all()
    )
    return (
        ["User ID", "First Name", "Last Name", "Phone", "Currency", "Pending", "Available"],
        [[str(r[0]), r[1] or "", r[2] or "", r[3] or "", r[4], float(r[5]), float(r[6])] for r in rows],
    )


def completed_settlements(db: Session, start: date, end: date) -> Report:
    rows = (
        db.query(WithdrawalRequest, User)
        .join(User, User.id == WithdrawalRequest.user_id)
        .filter(
            WithdrawalRequest.status == WithdrawalRequestStatusEnum.settled,
            func.date(WithdrawalRequest.settled_at) >= start,
            func.date(WithdrawalRequest.settled_at) <= end,
        )
        .order_by(WithdrawalRequest.settled_at.desc())
        .all()
    )
    out = []
    for wd, u in rows:
        out.append([
            wd.request_code,
            (u.first_name or "") + " " + (u.last_name or ""),
            u.phone or "",
            wd.currency_code,
            float(wd.amount),
            wd.payout_method or "",
            wd.payout_provider_name or "",
            wd.payout_account_number or "",
            wd.external_reference or "",
            wd.settled_at.isoformat() if wd.settled_at else "",
        ])
    return (
        ["Request Code", "Beneficiary", "Phone", "Currency", "Amount",
         "Method", "Provider", "Account", "External Ref", "Settled At"],
        out,
    )


def failed_payments(db: Session, start: date, end: date) -> Report:
    rows = (
        db.query(Transaction, User)
        .outerjoin(User, User.id == Transaction.payer_user_id)
        .filter(
            Transaction.status == TransactionStatusEnum.failed,
            func.date(Transaction.created_at) >= start,
            func.date(Transaction.created_at) <= end,
        )
        .order_by(Transaction.created_at.desc())
        .all()
    )
    out = []
    for t, u in rows:
        out.append([
            t.transaction_code,
            (u.first_name or "") + " " + (u.last_name or "") if u else "",
            u.phone if u else "",
            t.country_code,
            t.currency_code,
            float(t.gross_amount),
            t.method_type,
            t.provider_name or "",
            t.failure_reason or "",
            t.created_at.isoformat() if t.created_at else "",
        ])
    return (
        ["TX Code", "Payer", "Phone", "Country", "Currency", "Amount",
         "Method", "Provider", "Reason", "Created At"],
        out,
    )


def _earnings_by_target(db: Session, start: date, end: date, target_type: PaymentTargetTypeEnum) -> Report:
    rows = (
        _completed_tx_query(db, start, end)
        .filter(Transaction.target_type == target_type, Transaction.beneficiary_user_id.isnot(None))
        .with_entities(
            Transaction.beneficiary_user_id,
            Transaction.currency_code,
            func.count(Transaction.id),
            func.coalesce(func.sum(Transaction.gross_amount), 0),
            func.coalesce(func.sum(Transaction.commission_amount), 0),
            func.coalesce(func.sum(Transaction.net_amount), 0),
        )
        .group_by(Transaction.beneficiary_user_id, Transaction.currency_code)
        .order_by(func.sum(Transaction.net_amount).desc())
        .all()
    )
    if not rows:
        return (["User ID", "Name", "Phone", "Currency", "Transactions", "Gross", "Commission", "Net"], [])
    user_ids = [r[0] for r in rows]
    user_map = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}
    out = []
    for r in rows:
        u = user_map.get(r[0])
        name = ((u.first_name or "") + " " + (u.last_name or "")) if u else ""
        out.append([str(r[0]), name.strip(), (u.phone if u else "") or "", r[1],
                    int(r[2]), float(r[3]), float(r[4]), float(r[5])])
    return (
        ["User ID", "Name", "Phone", "Currency", "Transactions", "Gross", "Commission", "Net"],
        out,
    )


def vendor_earnings(db: Session, start: date, end: date) -> Report:
    return _earnings_by_target(db, start, end, PaymentTargetTypeEnum.booking)


def organizer_earnings(db: Session, start: date, end: date) -> Report:
    # Aggregate event + ticket targets together.
    h1, r1 = _earnings_by_target(db, start, end, PaymentTargetTypeEnum.event_contribution) \
        if hasattr(PaymentTargetTypeEnum, "event_contribution") else (None, [])
    h2, r2 = _earnings_by_target(db, start, end, PaymentTargetTypeEnum.ticket)
    headers = h2 or h1 or ["User ID", "Name", "Phone", "Currency", "Transactions", "Gross", "Commission", "Net"]
    return (headers, list(r1) + list(r2))


# ──────────────────────────────────────────────
# Registry
# ──────────────────────────────────────────────

REPORTS: dict[str, tuple[str, callable]] = {
    "daily_collections":     ("Daily Collections",      daily_collections),
    "weekly_collections":    ("Weekly Collections",     weekly_collections),
    "monthly_collections":   ("Monthly Collections",    monthly_collections),
    "country_breakdown":     ("Country Breakdown",      country_breakdown),
    "commission_revenue":    ("Commission Revenue",     commission_revenue),
    "pending_liabilities":   ("Pending Liabilities",    pending_liabilities),
    "completed_settlements": ("Completed Settlements",  completed_settlements),
    "failed_payments":       ("Failed Payments",        failed_payments),
    "vendor_earnings":       ("Vendor Earnings",        vendor_earnings),
    "organizer_earnings":    ("Organizer Earnings",     organizer_earnings),
}


# ──────────────────────────────────────────────
# Output formatters
# ──────────────────────────────────────────────

def to_csv(headers: list[str], rows: list[ReportRow]) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(headers)
    w.writerows(rows)
    return buf.getvalue().encode("utf-8")


def to_pdf(title: str, headers: list[str], rows: list[ReportRow],
           start: date, end: date, generated_by: str) -> bytes:
    """Branded landscape PDF using reportlab Platypus."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import landscape, A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=12 * mm, rightMargin=12 * mm,
        topMargin=12 * mm, bottomMargin=12 * mm,
        title=f"Nuru — {title}",
    )

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"],
                        fontSize=16, leading=20, textColor=colors.HexColor("#0f172a"))
    sub = ParagraphStyle("sub", parent=styles["Normal"],
                         fontSize=9, textColor=colors.HexColor("#64748b"))

    story = []
    story.append(Paragraph(f"Nuru Finance — {title}", h1))
    story.append(Paragraph(
        f"Date range: <b>{start.isoformat()}</b> → <b>{end.isoformat()}</b> &nbsp;·&nbsp; "
        f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} &nbsp;·&nbsp; "
        f"By: {generated_by}",
        sub,
    ))
    story.append(Spacer(1, 8))

    if not rows:
        story.append(Paragraph("<i>No data in this date range.</i>", styles["Normal"]))
    else:
        # Format numbers a bit
        def fmt(v):
            if isinstance(v, float):
                return f"{v:,.2f}"
            return str(v) if v is not None else ""

        data = [headers] + [[fmt(c) for c in row] for row in rows]
        # Add totals row when first column is a date/period.
        try:
            numeric_cols = [i for i, v in enumerate(rows[0]) if isinstance(v, (int, float))]
            if numeric_cols:
                totals = [""] * len(headers)
                totals[0] = "TOTAL"
                for i in numeric_cols:
                    totals[i] = sum((r[i] for r in rows), 0)
                data.append([fmt(c) for c in totals])
        except Exception:
            pass

        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f8fafc")]),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e2e8f0")),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(table)

    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "<font size=7 color='#94a3b8'>Confidential — Nuru Finance Operations.</font>",
        styles["Normal"],
    ))

    doc.build(story)
    return buf.getvalue()
