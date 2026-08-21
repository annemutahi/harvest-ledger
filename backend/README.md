# Peaceful Acres Farm — Django Backend

Full Django REST Framework backend for the Peaceful Acres Farm ERP.
Implements every endpoint the frontend (`src/lib/api/index.ts` and the
stores under `src/lib/*`) already calls, plus the new modules:

- **accounts** — JWT auth (SimpleJWT), roles, `/auth/login`, `/auth/me`,
  `/auth/token/refresh`, `/auth/token/blacklist`
- **customers** — `/customers/`
- **products** — `/products/`
- **sales** — `/sales/`, `/invoices/`, `/payments/`
- **stock** — `/stock/` (farmhand daily entries + manager approval)
- **expenses** — `/suppliers/`, `/purchases/`, `/casual-workers/`,
  `/casual-wages/`
- **orders** — `/orders/` (in-person + online) with public HMAC-signed
  webhook at `/public/orders/webhook/`
- **reports** — `/reports/sales/`, `/reports/inventory/`,
  `/reports/expenses/`, `/reports/pnl/`

## Security

- JWT access + refresh tokens with rotation and blacklist on logout
- Argon2 password hashing
- Strict CORS allow-list (env-driven)
- HTTPS/HSTS, `SECURE_*` headers, secure cookies in production
- DRF throttling: `anon` 30/min, `user` 240/min, `login` 10/min
- Role-based permissions (`IsManagerOrReadOnly`, `CanEditSales`, etc.)
- Signed webhook (`X-Webhook-Secret`) with `hmac.compare_digest`
- Django ORM parametrised queries (no raw SQL) + input validation on
  every serializer

## Quickstart

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then edit values
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

Frontend already points at `http://127.0.0.1:8000/api` via
`VITE_API_URL` — no frontend changes required.

## Roles

Roles live in the `accounts_userrole` table (created by `accounts/migrations/0001_initial.py`).
Run `python manage.py migrate` after pulling: without that table every account
falls back to the legacy staff flags, which is why an "admin" could get
`403 Forbidden` on `/auth/users/`.

Existing accounts are seeded automatically (superuser → Admin, staff → Manager,
everyone else → Sales). To change a role from the shell:

```bash
python manage.py set_role <username> admin
```

## Environment

See `.env.example`. Required in production:

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG=False`
- `DJANGO_ALLOWED_HOSTS=api.yourdomain.com`
- `CORS_ALLOWED_ORIGINS=https://app.yourdomain.com`
- `DATABASE_URL=postgres://…`
- `ORDERS_WEBHOOK_SECRET=<64+ char random string>`
- `STORE_API_URL` / `STORE_API_KEY` (only if you push order status back)

## Roles

- **Superuser / staff (manager)** — full access, can approve stock,
  edit sales, mark wages paid, update order status, manage products.
- **Authenticated non-staff (farmhand)** — read most data, record
  stock entries, log casual wages, create in-person orders. Cannot
  approve stock, edit prices, or mark wages paid.
- **Anonymous** — no access except the signed webhook.
