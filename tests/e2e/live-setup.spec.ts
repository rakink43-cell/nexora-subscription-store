import { test, expect } from '@playwright/test'

/* Verifies the app's behaviour when Supabase credentials exist but the
   database schema has NOT been applied. It must be honest, never fake. */

test('setup mode: banner tells the truth and writes are blocked', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Setup required')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/database schema has not been applied/i)).toBeVisible()

  // catalogue still explorable (bundled demo data) so the storefront isn't blank
  await expect(page.locator('article.nx-card').first()).toBeVisible({ timeout: 20_000 })

  // checkout must refuse rather than write a fake local order
  await page.goto('/product/netflix-premium-4k')
  await page.getByRole('button', { name: 'Buy Now' }).click()
  await page.getByLabel('Full name').fill('Live Test')
  await page.getByLabel('Email address').fill('live@example.com')
  await page.getByLabel('Mobile number').fill('01712345678')
  await page.getByRole('button', { name: /Place Order/ }).click()

  await expect(page.getByText(/database is not initialised/i).first()).toBeVisible({ timeout: 20_000 })
  await expect(page).toHaveURL(/checkout/) // never navigates to a fake confirmation
})
