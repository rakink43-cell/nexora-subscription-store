# NEXORA — Current deployment & setup guide

Last verified: 2026-11-22

## Production status

- Storefront: https://nexora-subscription-store.pages.dev
- Hosting: Cloudflare Pages (free `pages.dev` subdomain)
- Database/auth/storage: Supabase project `vxorwxecyfhuzzgtyowy`
- The production schema is live and the migration history contains the current database changes.
- The existing administrator account already has its admin role. Do not run the bootstrap-admin example or create a public admin setup route.

## Database migrations

There are 46 SQL migrations in `supabase/migrations/`. The full ordered SQL bundle is
`supabase/apply_all.sql`; it now includes every migration through
`20261122191000_validate_payment_proof_object_exists.sql`.

### Existing production project

Do **not** paste `apply_all.sql` into the production SQL editor. Production migrations have
already been applied. For normal updates, use the next migration file, apply it once through
Supabase migration tooling, and record it in the repository. Do not rerun the destructive
local test runner against production.

### Fresh development/test project

Prefer the Supabase CLI so migration history is recorded:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

For a brand-new disposable database only, `supabase/apply_all.sql` is a complete ordered
schema bundle. Run it once in the SQL editor. It includes the initial schema, seed content,
RLS/storage policies, and subsequent security/business-logic migrations.

## Auth and admin access

- Email confirmation remains enabled. Do not turn it off as a production workaround.
- Supabase built-in SMTP has previously rate-limited confirmation emails. If email delivery is
  blocked, wait for the limit to reset or configure SMTP with a verified sender domain.
- Keep the production Site URL and redirect allowlist pointed at
  `https://nexora-subscription-store.pages.dev`.
- The existing admin account already has the admin role. Admin-only RPCs must retain their
  internal `is_admin()` checks; do not grant admin role through customer registration.
- Password minimum length is configured by Supabase Auth and enforced in the registration UI.

## Storage and payment proof privacy

- `product-images`: public read; admin-only write.
- `payment-proofs`: private; 5 MB limit; JPG/JPEG, PNG, WEBP or PDF.
- Proofs are stored using the order-scoped path
  `NX-######-#####/13-digit-timestamp.ext`.
- Customer/admin proof previews must use short-lived signed URLs. Never change the bucket to
  public and never store a public URL for a payment screenshot.
- A real upload → payment submission → admin preview → verification flow still needs a
  test customer and test order before it can be marked end-to-end verified.

## Security review notes

The Supabase Security Advisor currently reports:

1. **RLS enabled with no policies** on internal admin tables
   (`admin_bootstrap`, `admin_login_credentials`, `admin_password_setup_tokens`). These are
   intentionally not directly accessible through the API; access is through guarded server
   functions. Do not add broad policies to silence the informational warning.
2. **Public SECURITY DEFINER RPCs** for guest order lookup/checkout/payment submission and
   coupon validation. These are required for guest checkout and must validate the order
   access token, order state, product price, active payment method, coupon and input bounds.
3. **Authenticated SECURITY DEFINER RPCs** include admin operations. Their execute grants
   are intentional only when the function body checks admin role or the caller's ownership.
   Do not revoke all authenticated execute grants indiscriminately.
4. **Leaked-password protection is currently disabled** in Supabase Auth. Enable it in the
   Supabase Dashboard under Authentication → Security/Password security (label may vary),
   then rerun the Security Advisor. This is an Auth dashboard setting, not a SQL migration.

## Local validation

Run these only against a disposable local/test database:

```bash
npm ci
npm run typecheck
npm run build
npm run db:test
npm run test:e2e
```

- `npm run db:test` recreates the database named `nexora_test` (or
  `NEXORA_TEST_DB`). Never point it at production.
- The SQL regression suite creates throw-away `rls-test-*` users and orders, then cleans up
  test fixtures. It is not a production smoke test.
- Cloudflare Pages build/deploy status is the source of truth for whether the frontend
  deployment completed successfully.

## Operations checklist

- Keep Supabase publishable/anon key only in frontend environment variables.
- Never commit service-role or secret API keys.
- Keep payment proof bucket private.
- Review Security Advisor after migrations.
- Test admin/customer permission boundaries with separate accounts in a test environment.
