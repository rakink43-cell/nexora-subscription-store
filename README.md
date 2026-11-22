# NEXORA — Digital Subscription Store

NEXORA is a digital subscription storefront built with React, TypeScript, Vite, Supabase
(Auth, PostgreSQL and private Storage), and Cloudflare Pages.

## Production

- Storefront: https://nexora-subscription-store.pages.dev
- Hosting: Cloudflare Pages using the free `pages.dev` subdomain
- Database/Auth project ref: `vxorwxecyfhuzzgtyowy`

The live database is initialized and the current migration history is applied. The existing
administrator account already has its admin role; this repository does not provide public
admin registration.

## Main capabilities

- Product catalogue, categories, product details, cart and checkout
- Guest checkout and account-based customer orders
- New-customer offers and coupon validation performed server-side
- Manual payment submission for configured payment methods
- Private payment proof uploads and short-lived signed previews
- Admin product/content/settings/payment-method management
- Customer and order management, payment verification and status workflow
- Analytics for visits and signups
- RLS-protected customer data and admin-only RPC operations

Payment is manually verified by an administrator; this project does not claim an automated
payment gateway integration.

## Tech stack

- React 19, TypeScript, Vite
- Supabase JS client, PostgreSQL, Row Level Security and Storage
- Cloudflare Pages
- Playwright for browser tests

## Local development

```bash
npm ci
npm run dev
```

Create a local `.env` from `.env.example` and configure only the Supabase publishable
key and project URL. Never put a service-role or secret key in frontend environment variables.

For a demo backend:

```bash
npm run dev:demo
```

## Database setup

The repository contains 44 ordered migrations in `supabase/migrations/`.

For a fresh development/test project:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

A full SQL bundle is available at `supabase/apply_all.sql` for a brand-new disposable
database. It contains all 45 migrations; run it once only. **Do not run it against the
existing production project.**

See [docs/SETUP.md](docs/SETUP.md) for current production operations and
[docs/TESTING.md](docs/TESTING.md) for verification limits and test commands.

## Validation scripts

```bash
npm run verify:migrations
npm run typecheck
npm run build
npm run db:test
npm run test:e2e
npm run verify:supabase
```

`npm run db:test` recreates a local test database. Never point it at production.
The full live payment lifecycle still needs a dedicated test customer/order in a safe
test environment before it can be marked end-to-end verified.

## Security notes

- Customer data is protected by RLS.
- Admin RPCs validate role internally.
- Payment proof storage is private.
- Product prices and coupon discounts are recalculated in PostgreSQL.
- Keep email confirmation enabled for production and configure a verified SMTP sender if
  Supabase's built-in mail service rate-limits confirmation emails.
