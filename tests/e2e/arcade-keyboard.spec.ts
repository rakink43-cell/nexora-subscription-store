import { expect, test } from '@playwright/test'

test.describe('NEXORA Arcade keyboard controls', () => {
  test('Neon Memory accepts the displayed tile from keys 1–9', async ({ page }) => {
    await page.goto('/games')
    await page.getByRole('button', { name: /Play demo/i }).click()
    const dialog = page.getByRole('dialog', { name: 'Neon Memory' })
    await dialog.getByRole('button', { name: 'Start round' }).click()

    const tiles = dialog.getByRole('button', { name: /^Tile [1-9]$/ })
    await expect.poll(async () => {
      for (let i = 0; i < 9; i += 1) {
        if (await tiles.nth(i).getAttribute('data-memory-flash') === 'true') return i
      }
      return -1
    }, { timeout: 5_000 }).toBeGreaterThanOrEqual(0)

    let target = -1
    for (let i = 0; i < 9; i += 1) {
      if (await tiles.nth(i).getAttribute('data-memory-flash') === 'true') {
        target = i
        break
      }
    }
    expect(target).toBeGreaterThanOrEqual(0)
    await expect(tiles.nth(0)).toBeEnabled({ timeout: 5_000 })
    await tiles.nth(0).focus()
    await tiles.nth(0).press(String(target + 1))
    await expect(dialog.getByText('Round 1 / 10 · 1 / 1 correct tiles')).toBeVisible()
  })
})
