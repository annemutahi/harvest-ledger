# What's still essential (and small)

The system already covers sales, invoices with eTIMS entry, payments with idempotency, credit handling, statements, orders, stock, expenses, reports, roles and password reset. Three gaps stand out as genuinely essential for daily use; everything else can wait.

## 1. Void / reverse with a reason (highest value)

Today mistakes can only be corrected by editing. There is no controlled way to cancel a payment or an invoice, and payments can currently be deleted outright through the API, which silently rewrites history.

- Add a "Void" action (Admin/Manager only) on a payment and on an invoice, requiring a short reason.
- Voiding a payment reverses the invoice's paid amount and status; voiding an invoice marks it cancelled and excludes it from statements, receivables and reports.
- Voided records stay visible, greyed, with the reason and who did it — never hard-deleted. Block hard delete on payments.

## 2. Customer receivables at a glance / aging

Debt tracking is the point of the system, but there is no single "who owes what, and how late" view.

- Add an Aging summary (Current / 1-30 / 31-60 / 61-90 / 90+) on the Customers list and as a card on the dashboard.
- One click through to that customer's statement. Export to Excel.

## 3. Data safety: real database + backups

The backend still runs on SQLite with no backup routine. One corrupted file loses everything.

- Move to Postgres and add a scheduled daily database dump with retention, plus a documented restore step.

## Deliberately left out (keeps it simple)

Notifications/reminders (already deferred), multi-currency, stock valuation accounting, and an eTIMS API integration — the manual eTIMS field is enough until KRA integration is approved.

## Technical notes

- Void: add `voided_at`, `voided_by`, `void_reason` to `Invoice` and `Payment`; filter voided rows out of statement, receivables and report querysets; restrict the action through the existing `ModulePermission` matrix; remove destroy from `PaymentViewSet`.
- Aging: computed server-side from unpaid invoice due dates so large customer lists stay fast, surfaced as buckets on the customers list endpoint.
- Postgres: switch `DATABASES` to a `DATABASE_URL` env var, keep migrations unchanged, add a backup command and schedule.

## Suggested order

Void/reverse first, aging second, Postgres + backups third.
