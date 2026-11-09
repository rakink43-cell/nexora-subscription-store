# NEXORA — Testing Checklist

Every command below has been run. Results are stated as they actually are, including
what cannot be tested yet.

---

## 1. Commands

| Command | What it proves | Status |
|---|---|---|
| `npm run typecheck` | TypeScript strict build, 0 errors | ✅ 0 errors |
| `npm run build` | production bundle | ✅ built in ~1.1 s |
| `npm run db:test` | 72 SQL assertions on a real PostgreSQL 17 instance | ✅ all pass |
| `npx playwright test tests/e2e/smoke.spec.ts tests/e2e/live-setup.spec.ts` | app boots in whatever mode `.env` configures | ✅ 3 passed |
| `npm run dev:demo` + `npx playwright test --project=demo` | full UI flows on the demo backend | ✅ 25 passed |
| `npm run verify:supabase` | live project readiness + RLS probing | ⚠️ 27 problems — migrations not applied |

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

## 3. Bugs this pass actually fixed

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

## 5. Not yet testable

Registration, login against real Supabase Auth, and the full live order path **cannot**
be exercised until the migrations are applied. Two independent blockers, both on the
Supabase side:

1. **No schema.** The `public` schema is empty; every table returns `PGRST205` and every
   RPC `PGRST202`. The publishable key cannot run DDL, so this must be applied from the
   dashboard SQL editor (see `docs/SETUP.md` step 2).
2. **E-mail confirmation is on and the mailer is rate-limited.** `mailer_autoconfirm`
   is `false`, so a new user cannot sign in until they confirm. Supabase's built-in SMTP
   is capped per hour and the limit was already tripped during probing
   (`429 over_email_send_rate_limit`). Supabase also rejects reserved domains
   (`@example.com`, `.test`) with `email_address_invalid`.

Once the schema is applied, `npm run verify:supabase` flips to `✓ PROJECT READY`, and the
live path can be tested end to end with a real mailbox.
