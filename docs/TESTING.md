# NEXORA — Testing Checklist

This document distinguishes expected test coverage from checks actually performed during
the latest work batch. Do not treat an old test result as proof that the current commit
was re-tested.

---

## 1. Commands and current status

| Command | What it proves | Latest status |
|---|---|---|
| `npm run verify:migrations` | Checks all 44 SQL migration files are present, ordered, and byte-matched in `apply_all.sql` | Passed in Cloudflare build |\n| `npm run typecheck` | TypeScript strict type checking | Not rerun in this batch |
| `npm run build` | Production frontend bundle | Earlier source-code deployment built successfully; latest documentation/test-only commits are still processing |
| `npm run db:test` | SQL/RLS/business-logic assertions on disposable PostgreSQL | Not run in this batch; run locally only |
| `npm run test:e2e` | Playwright UI flows | Not run in this batch |
| `npm run verify:supabase` | Live project readiness and RLS probing | Live DB inspected manually; 1 profile and 0 orders, so full payment lifecycle is not testable yet |

### Two servers, two purposes

```bash
npm run dev                    # port 5173 — the app exactly as `.env` configures it
npm run dev:demo               # port 5174 — demo backend, used by --project=demo
```

`dev:demo` runs Vite in `demo` mode, which loads `.env.demo` (`VITE_DEMO_MODE=true`).
That forces the bundled demo backend even though real credentials exist, so the
e2e suite can exercise sign-up, checkout and the admin panel without a database.

---

## 2. What the tests cover

**Storefront** — hero + brand banner render, categories load, product rails populate
from the data layer (not static markup), skeleton states resolve, search/sort/category
filter drive the URL, product detail shows pricing and availability, cart persists
across reloads with quantity changes, empty-cart state, static content pages, no
horizontal overflow at mobile/tablet/desktop, grid reflows to two columns on mobile.

**Checkout** — a full guest order lifecycle: add to cart → buy now → contact details →
payment method selection → coupon (`NEXORA10`, 10% with a ৳500 minimum, so the test
buys two units to qualify) → order placed → order page with payment instructions →
transaction-ID validation → payment submitted → tracking timeline.

**Admin** — dashboard stats and the 14-day sales chart, payment verification
(`Verify payment` moves the order to *Payment Verified*, never straight to *Completed*),
status transitions (`processing` → `completed`), product create → visible in storefront,
invalid pricing rejected, settings changes reaching the storefront, every admin section
loading without errors.

**Auth & authorisation** — registration creates an account and lands on the dashboard,
password mismatch blocked, invalid credentials rejected, a customer account **cannot**
open `/admin`.

**Order tracking** — a guest can reopen their order, and an unknown order number
produces a friendly error instead of a crash.

**Database** — 72 assertions covering RLS on all 19 tables, admin-only write policies,
customer-scoped order reads, `place_order` recomputing totals server-side, stock
decrement, coupon validation, storage bucket visibility (`product-images` public,
`payment-proofs` private).

---

## 3. Previously fixed bugs

These were real defects found by running the suite — not test-only edits.

1. **Demo mode threw the setup error.** `writeBackend()` checked `schemaState` without
   checking `isLive()` first, so with no credentials at all it raised
   "database not initialised" instead of using the demo backend. The admin panel and
   dashboard rendered blank as a result.
2. **Admin form labels were not associated with their inputs.** `<Field label="…"><Input/></Field>`
   produced a decorative `<label>` with no `for` and no control id. Screen readers
   announced unnamed text boxes. `Field` now stamps `aria-labelledby` on real controls
   (input/select/textarea/components) and generates ids when none is supplied.
3. **The required-marker asterisk polluted every label.** `Password*` broke exact
   accessible-name matching. The asterisk now sits outside the `<label>`, marked
   `aria-hidden`, while the input keeps `required`.
4. **`head: true` is not a schema probe.** PostgREST answers `204` with no error even
   for a missing table, which made the app claim to be "live" against an empty project.
   The probe is now a real `SELECT`.
5. **Storage bucket detection was meaningless.** An anonymous `list()` returns `200 []`
   for a bucket that does not exist. The verifier now attempts an upload, where a missing
   bucket answers `NoSuchBucket` and an existing one rejects the anonymous write.

---

## 3A. Fixes in the latest maintenance batch

1. **SQL test block quoting was malformed.** Two payment regression blocks used `do $`
   / `end $;` instead of valid `do $$` / `end $$;`. Both blocks now use valid dollar quoting.
2. **The full SQL bundle was stale.** `supabase/apply_all.sql` previously stopped at migration 0009
   while the repository had many later security, analytics, customer-block, and payment
   hardening migrations. It now includes all 44 migration files in order, through the
   latest admin password-token index migration.

---

## 4. Test-writing lessons encoded in the suite

* A bare `expect(await locator.count())` reads the DOM mid-fetch. Wait for the element
  (`toBeVisible` / `expect.poll`) before counting.
* Duplicate text (a table row *and* a toast) violates Playwright strict mode — scope to
  the row, or use `.first()`.
* `getByText('Completed')` also matches hidden `<option value="completed">` elements.
  Assert on visible containers, not raw text.
* Assert the *specific* confirmation. Waiting for the generic "Status updated" toast
  succeeds against the **previous** toast while the new request is still in flight.
* Toast titles are `role="status"`; that is the reliable handle.
* The admin order drawer's status select is controlled by the loaded order, so a
  post-apply refresh resets it. Reopen the drawer before the next transition.
* After a status change the order leaves a status-filtered list — re-find it by search.

---

## 5. Live verification limits (2026-11-22)

The production Supabase schema and migrations are now applied. The previous “schema is
empty” note is obsolete.

Verified against the live project in this pass:
- The private `payment-proofs` bucket is still private.
- The bounded order-scoped upload policy and admin-only read policy both exist.
- Anonymous and authenticated callers can invoke `submit_payment`; the RPC itself checks
  order ownership/access token, order state, active payment method, transaction ID and
  proof path.
- Payment proof filename validation accepts the exact NEXORA path format and rejects
  invalid extensions and timestamp lengths.
- The latest Cloudflare Pages build completed successfully after TypeScript fixes.

Still not end-to-end verified:
- The live database currently has one profile and zero orders, so a real customer order
  cannot be used to exercise upload → submit → signed admin preview → verification.
- The full SQL regression suite was updated, but was not run against production. Do not
  run the destructive local test runner against the live database.
- Email confirmation remains enabled. A previous attempt encountered Supabase's built-in
  mail rate limit, so real registration/login verification still requires a working
  confirmation email.

Use a separate test customer and a real test order in a safe test environment before
claiming the complete live payment lifecycle is verified.
