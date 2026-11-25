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
    await dialog.focus()
    await dialog.press(String(target + 1))
    await expect(dialog.getByText('Round 1 / 10 · 1 / 1 correct tiles')).toBeVisible()
  })

  test('a missed tile resets input and offers a retry for the same round', async ({ page }) => {
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
    await expect(tiles.nth(0)).toBeEnabled({ timeout: 5_000 })
    await tiles.nth((target + 1) % 9).click()

    await expect(dialog.getByText('Pattern missed. Press Try again to replay this round.')).toBeVisible()
    await expect(dialog.getByText('Round 1 / 10 · 0 / 1 correct tiles')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Try again' })).toBeEnabled()
  })

  test('Escape closes the game and stops its background music', async ({ page }) => {
    await page.goto('/games')
    await page.getByRole('button', { name: /Play demo/i }).click()
    const dialog = page.getByRole('dialog', { name: 'Neon Memory' })
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('button', { name: 'Stop music' })).toBeVisible()

    await dialog.focus()
    await dialog.press('Escape')

    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Play music' })).toBeVisible()
  })

})
