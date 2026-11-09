# NEXORA — Supabase Setup Guide

This guide takes your project from **empty Supabase database** to **fully live storefront**.
It matches the code in this repository exactly. Nothing here is optional unless marked.

> **Current state of your project:** the environment variables are already configured and
> the app is running in *setup mode* — the storefront renders, but sign-up, checkout and the
> admin panel are deliberately blocked. To finish, complete **Step 2** below.
> Verify at any time with `npm run verify:supabase`.

---

## Contents

1. [What the three modes mean](#1-what-the-three-modes-mean)
2. [Run the database migrations](#2-run-the-database-migrations) ← **the only manual step**
3. [Configure Supabase Auth](#3-configure-supabase-auth)
4. [Create the payment-proof storage buckets](#4-create-the-payment-proof-storage-buckets)
5. [Create your administrator account](#5-create-your-administrator-account)
6. [Verify everything](#6-verify-everything)
7. [Troubleshooting](#7-troubleshooting)
8. [Security model](#8-security-model)

---

## 1. What the three modes mean

The app detects the real state of your database at startup and never pretends.

| Mode | When | Storefront | Auth / Orders / Payments / Admin |
|---|---|---|---|
| **`demo`** | no `VITE_SUPABASE_*` keys in `.env` | full catalogue from bundled seed data | blocked |
| **`setup`** | keys present, tables missing | catalogue falls back to demo data | **blocked** — shows "database is not initialised" |
| **`live`** | keys present, tables reachable | reads from Supabase | **fully working** |

*Setup mode* is what your project is in right now. It exists so a half-configured deployment can
never take a customer's money and lose the order. You will see a rose banner reading
**"Setup required"** and a footer badge reading **"Migrations pending"**.

```
src/lib/api.ts  →  initDataSource()  →  probes `products` with a real SELECT
                                        PGRST205 / 42P01 / 404  → "setup"
                                        reachable                → "live"
```

---

## 2. Run the database migrations

**This is the step that is not done yet, and it cannot be done with an API key.**
Supabase's publishable (anon) key cannot run DDL. Migrations must be applied with the
dashboard SQL editor, the Supabase CLI with a database password, or a secret key. Use the
dashboard — it needs no extra tooling.

### Option A — Dashboard SQL editor (recommended)

1. Open <https://supabase.com/dashboard/project/vxorwxecyfhuzzgtyowy/sql/new>
2. Open the file **`supabase/apply_all.sql`** from this repository.
3. Copy the **entire** file and paste it into the editor.
4. Press **Run**. It executes in one transaction and is **idempotent** — if anything fails,
   fix the cause and run the whole file again.
5. Expect "Success. No rows returned." The seed data loads 6 categories and 33 products.

`apply_all.sql` is a generated bundle of everything in `supabase/migrations/`:

| File | Contents |
|---|---|
| `0001_extensions_and_enums.sql` | `pgcrypto`, `citext`, enums (order status, payment status, payment method…) |
| `0002_core_tables.sql` | profiles, user_roles, categories, products, product_images, orders, order_items, payments, coupons, … |
| `0003_content_tables.sql` | website_settings, promotions, faqs, reviews, support tickets, `public_products` view |
| `0004_grants_and_rls.sql` | grants + **39 RLS policies** (one set per table) |
| `0005_triggers.sql` | `updated_at`, profile-on-signup, order totals, stock decrement |
| `0006_rpc_functions.sql` | `place_order`, `get_order`, `submit_payment`, `validate_coupon`, `admin_dashboard_stats`, `admin_verify_payment`, `admin_update_order_status`, `claim_guest_order`, `bootstrap_admin` |
| `0007_seed_data.sql` | 6 categories, 33 products, payment methods, settings, FAQs, coupons |
| `0008_admin_setup.sql` | `user_roles`, `is_admin()`, `admin_bootstrap` table, admin RPC guards |
| `0009_storage.sql` | `product-images` (public) and `payment-proofs` (private) buckets + policies |

### Option B — Supabase CLI

```bash
supabase link --project-ref vxorwxecyfhuzzgtyowy
supabase db push          # applies supabase/migrations/0001…0009 in order
```

### Option C — plain PostgreSQL (self-hosting or CI)

```bash
createdb nexora
for f in supabase/migrations/000*.sql; do psql -v ON_ERROR_STOP=1 -d nexora -f "$f"; done
```

`0009_storage.sql` detects the absence of Supabase's `storage` schema and skips itself, so
plain PostgreSQL works without errors. Run the full assertion suite with:

```bash
npm run db:test    # → 72 assertions, ALL TESTS PASSED
```

### What you should see afterwards

19 tables, 39 policies, 23 functions, RLS enabled on every table, 33 products.
All of this has been validated against PostgreSQL 17 locally — the bundle applies cleanly
and applies a second time without error.

---

## 3. Configure Supabase Auth

Dashboard → **Authentication**.

### 3.1 Email provider

**Providers → Email** must be **enabled** (it already is on your project).

### 3.2 Turn off e-mail confirmation for testing

> **This is currently blocking you.** Your project has `mailer_autoconfirm: false`, so a
> new user cannot log in until they click a link in a confirmation e-mail. Supabase's
> built-in SMTP is rate-limited to a handful of messages per hour, and while probing your
> project we already tripped it (`429 over_email_send_rate_limit`).

For launch-ready testing, either:

* **Quickest:** Authentication → Providers → Email → turn **Confirm email** *off*, then
  create your accounts. Turn it back on before you take real money.
* **Production-correct:** Authentication → Emails → set up your own SMTP (Resend, Postmark,
  Mailgun, or Gmail app password) and keep confirmation on.

Also note Supabase **rejects reserved TLDs** — `@example.com`, `@test.com` and `.test` all
fail with `email_address_invalid`. Use a real mailbox.

### 3.3 Site URL and redirects

Authentication → **URL Configuration**:

| Setting | Local | Production |
|---|---|---|
| Site URL | `http://localhost:5173` | `https://your-domain.com` |
| Redirect URLs | `http://localhost:5173/**` | `https://your-domain.com/**` |

Both are required; the production entry must be present before you deploy to Cloudflare Pages.

### 3.4 Password policy

Authentication → **Policies** (or Providers → Email): minimum length **8**.
The app also enforces this client-side in `RegisterPage.tsx`, but the server rule is what counts.

### 3.5 Profiles are automatic

You do **not** create profile rows by hand. The trigger `handle_new_user()` on `auth.users`
inserts into `public.profiles` with `full_name` taken from sign-up metadata, and the RLS
policy `profiles_select_own` lets each customer read only their own row.

---

## 4. Create the payment-proof storage buckets

`0009_storage.sql` already created them **if** you ran the bundle in step 2. Confirm at
**Storage**:

| Bucket | Visibility | Limit | MIME types | Who can write |
|---|---|---|---|---|
| `product-images` | **public** | 4 MB | jpeg, png, webp | admins only |
| `payment-proofs` | **private** | 5 MB | jpeg, png, webp, pdf | the owning customer; admins can read |

If they are missing, run `supabase/migrations/0009_storage.sql` in the SQL editor.
`npm run verify:supabase` reports them correctly — a missing bucket answers `NoSuchBucket`,
whereas an existing bucket rejects an anonymous upload with a policy error.

> **Why `payment-proofs` is private:** bKash/Nagad screenshots contain phone numbers and
> transaction IDs. They are served through short-lived signed URLs, visible to the customer
> who uploaded them and to admins only.

---

## 5. Create your administrator account

There is **no public admin registration** and no default password. You promote an existing
account using a one-time, single-use secret.

### 5.1 Register the account first

Sign up normally at `/register` (or Auth → Users → **Add user**). Whichever e-mail you use
becomes the administrator. Confirm the address if confirmation is enabled.

### 5.2 Run the bootstrap script

Open `supabase/migrations/0010_admin_bootstrap_EXAMPLE.sql`, edit **two** placeholders:

```sql
-- STEP 1
encode(extensions.digest('YOUR-LONG-SECRET', 'sha256'), 'hex')

-- STEP 2
select public.bootstrap_admin('YOUR-ADMIN-EMAIL', 'YOUR-LONG-SECRET');
```

* `YOUR-ADMIN-EMAIL` — the account from 5.1.
* `YOUR-LONG-SECRET` — 32+ random characters, never reused, never shared over chat or e-mail.

Run the file in the SQL editor. Success prints:

```json
{"ok": true, "user_id": "…", "role": "admin"}
```

### 5.3 Close the door

The script's **STEP 4** deletes the bootstrap row. Run that statement. Afterwards
`bootstrap_admin()` raises `Admin bootstrap is disabled on this project.` for any caller —
verified behaviour, not a claim.

### 5.4 How this is protected

| Threat | Defence |
|---|---|
| Someone self-registers as admin | `user_roles` has RLS; only admins can insert. Customers cannot escalate. |
| Secret leaks from the repo | The file ships with placeholders, never a real secret. Only the SHA-256 hash is stored. |
| Someone re-runs the script | `used_at` is stamped on first success; later calls raise. |
| Forgotten backdoor | Deleting the `admin_bootstrap` row disables the function permanently. |
| Guessing the admin e-mail | Knowing the e-mail is not enough; the secret must match the stored hash. |

### 5.5 Promoting further staff later

Run as an existing admin (or in the SQL editor):

```sql
insert into public.user_roles (user_id, role)
select id, 'staff' from auth.users where email = 'staff@yourdomain.com'
on conflict do nothing;
```

Roles available: `admin` (everything), `staff` (fulfilment: orders, reviews, support),
`customer` (implicit — no row needed).

---

## 6. Verify everything

```bash
npm run verify:supabase
```

It checks 5 groups and never writes data:

1. **schema** — all 14 tables exist; sensitive tables return **0 rows** to anonymous users
2. **server functions** — all 8 RPCs exist and reject bad input
3. **storage** — both buckets exist and refuse anonymous uploads
4. **catalogue content** — 33 products, 6 categories seeded
5. **admin protection** — `admin_dashboard_stats()` refuses anonymous callers

A ready project prints `✓ PROJECT READY`. Right now it reports **27 problems**, which is
correct and expected — the database is still empty.

Then restart the dev server so the app re-probes the schema:

```bash
npm run dev
```

The rose banner disappears and sign-up, login, cart, checkout, payment submission and the
admin panel all go live.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Rose "Setup required" banner stays | tables missing, or dev server not restarted | run `apply_all.sql`, then `npm run dev` |
| `PGRST205` in the console | table not in schema cache | step 2 not run, or run partially |
| `PGRST202` on checkout | RPC missing | `0006_rpc_functions.sql` / `0008_admin_setup.sql` missing |
| `429 over_email_send_rate_limit` | Supabase's built-in SMTP limit | wait, disable email confirm, or add your own SMTP |
| `email_address_invalid` on signup | reserved domain (`example.com`, `.test`) | use a real mailbox |
| Login works but admin pages 403 | account is not in `user_roles` | step 5 |
| Upload fails with `new row violates row-level security policy` | not signed in as admin | sign in as the admin account |
| Order total is wrong | trigger not applied | re-run `0005_triggers.sql` — it is idempotent |
| `auth.users` has your user but no `profiles` row | trigger missing | re-run `0005_triggers.sql`, then insert the profile manually |

---

## 8. Security model

**Keys**

* Only `sb_publishable_…` ships to the browser. It is designed to be public.
* No `service_role` / `sb_secret_` key exists anywhere in this repository, in `.env`, or in
  the Cloudflare build. `npm run verify:supabase` refuses to run if one is detected.
* `.env` is git-ignored. `.env.example` contains placeholders only.

**Database**

* RLS is enabled on **all 19 tables** — verified: `rls_disabled = 0`.
* Customers read their own `orders`, `order_items`, and `payments` only.
* `payment_proofs` rows and storage objects are scoped to the uploading user.
* Prices are never trusted from the browser: `place_order()` recomputes every line total and
  the order total server-side from `products.price`.
* Stock is decremented inside the same transaction that creates the order.
* Coupons are validated by `validate_coupon()` — the client cannot invent a discount.
* Admin actions go through `security definer` RPCs that call `is_admin()` first, so hiding a
  button in the UI is never the only protection.

**Payments**

Manual verification only — bKash, Nagad and bank transfer. There is no gateway integration
and none is faked. A customer submits a transaction ID and a screenshot; the order stays
`pending_payment` until an admin verifies it at `/admin/orders`, which calls
`admin_verify_payment()` and flips the order to `processing` plus the payment to `verified`.
Every transition is recorded with the acting admin's user id.

---

*Generated for the NEXORA build. Verify claims with `npm run verify:supabase` and
`npm run db:test` rather than trusting this document.*
