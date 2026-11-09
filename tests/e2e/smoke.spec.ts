import { test, expect } from '@playwright/test'

/**
 * Homepage smoke test.
 *
 * Runs in any of the three data-source modes (demo / setup / live):
 *   • demo  — no Supabase keys
 *   • setup — keys present, migrations not applied yet (Supabase answers 404)
 *   • live  — migrations applied
 *
 * Network failures against the Supabase host are EXPECTED in setup mode, so they
 * are filtered per-URL rather than by message text. Real JavaScript exceptions are
 * never tolerated.
 */
test('smoke: homepage hydrates and catalogue loads', async ({ page }) => {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  const supabaseFailures: number[] = []

  page.on('pageerror', (e) => pageErrors.push(e.message))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    // Chromium logs a generic "Failed to load resource" for every non-2xx
    // response. Those are judged by the response listener below (by URL), so
    // they are ignored here to avoid double-counting.
    if (m.text().startsWith('Failed to load resource')) return
    consoleErrors.push(m.text())
  })
  page.on('response', (r) => {
    const isSupabase = /\.supabase\.co\//.test(r.url())
    if (isSupabase && r.status() >= 400) supabaseFailures.push(r.status())
  })

  await page.goto('/')

  // React actually mounted
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Premium Entertainment')
  await expect(page.locator('img[src="/brand/nexora-banner.png"]').first()).toBeVisible()

  // products came from the data layer, not static markup
  await expect(page.locator('article.nx-card').first()).toBeVisible({ timeout: 15_000 })
  expect(await page.locator('article.nx-card').count()).toBeGreaterThan(8)

  // and the deferred ProductCardSkeleton state resolved
  expect(await page.locator('.nx-skeleton').count()).toBe(0)

  // No real JavaScript errors, in any mode.
  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])

  // 4xx from Supabase is only acceptable when the schema is still missing; a 5xx
  // or 401 is a genuine misconfiguration and must fail the run.
  const unexpected = supabaseFailures.filter((s) => s !== 404)
  expect(unexpected, 'unexpected Supabase statuses (only 404 = pending migrations is allowed)').toEqual([])
})

test('smoke: deep link + cart round-trip', async ({ page }) => {
  await page.goto('/product/netflix-premium-4k')

  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Netflix/i)

  await page.getByRole('button', { name: /add to cart/i }).first().click()

  // cart badge in the header updates
  const cartLink = page.getByRole('link', { name: /cart/i }).first()
  await expect(cartLink).toContainText('1')

  await page.goto('/cart')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/cart/i)
  await expect(page.getByText(/Netflix/i).first()).toBeVisible()
})
