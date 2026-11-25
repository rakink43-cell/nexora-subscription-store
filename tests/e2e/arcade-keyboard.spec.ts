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

  test('keyboard shortcuts ignore modified key presses and input before turn', async ({ page }) => {
    await page.goto('/games')
    await page.getByRole('button', { name: /Play demo/i }).click()
    const dialog = page.getByRole('dialog', { name: 'Neon Memory' })
    const tiles = dialog.getByRole('button', { name: /^Tile [1-9]$/ })

    await dialog.focus()
    await page.keyboard.press('Control+1')
    await expect(dialog.getByText('Round 1 / 10 · 0 / 1 correct tiles')).toBeVisible()

    await dialog.getByRole('button', { name: 'Start round' }).click()
    await expect.poll(async () => {
      for (let i = 0; i < 9; i += 1) {
        if (await tiles.nth(i).getAttribute('data-memory-flash') === 'true') return i
      }
      return -1
    }, { timeout: 5_000 }).toBeGreaterThanOrEqual(0)

    await dialog.focus()
    await page.keyboard.press('Control+1')
    await expect(dialog.getByText('Round 1 / 10 · 0 / 1 correct tiles')).toBeVisible()
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

  test('Reset cancels the current pattern and returns to a clean first round', async ({ page }) => {
    await page.goto('/games')
    await page.getByRole('button', { name: /Play demo/i }).click()
    const dialog = page.getByRole('dialog', { name: 'Neon Memory' })
    await dialog.getByRole('button', { name: 'Start round' }).click()
    await expect(dialog.getByText('Round 1 / 10 · 0 / 1 correct tiles')).toBeVisible()

    await dialog.getByRole('button', { name: 'Reset' }).click()
    await expect(dialog.getByText('Round 1 / 10 · 0 / 1 correct tiles')).toBeVisible()
    await expect(dialog.getByText('Press Start to watch the pattern.')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Start round' })).toBeEnabled()
    await expect(dialog.getByRole('button', { name: /^Tile [1-9]$/ }).first()).toBeDisabled()

    // The previous pattern's delayed timers must be cancelled by Reset.
    await page.waitForTimeout(1_200)
    await expect(dialog.getByText('Press Start to watch the pattern.')).toBeVisible()
    await expect(dialog.getByRole('button', { name: /^Tile [1-9]$/ }).first()).toBeDisabled()
  })

  test('Escape closes the game, restores focus and stops its music', async ({ page }) => {
    await page.goto('/games')
    const launchButton = page.getByRole('button', { name: /Play demo/i })
    await launchButton.click()
    await expect(page.getByRole('combobox', { name: 'Select game music' })).toHaveValue('0')
    await expect(page.locator('[aria-live="polite"]')).toContainText('Music playing', { timeout: 5_000 })
    const dialog = page.getByRole('dialog', { name: 'Neon Memory' })
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('button', { name: 'Stop music' })).toBeVisible()
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
    const closeButton = dialog.getByRole('button', { name: 'Close game' })
    const resetButton = dialog.getByRole('button', { name: 'Reset' })
    await expect(closeButton).toBeFocused()

    // Keyboard focus must stay inside the modal in both directions.
    await resetButton.focus()
    await page.keyboard.press('Tab')
    await expect(closeButton).toBeFocused()
    await closeButton.focus()
    await page.keyboard.press('Shift+Tab')
    await expect(resetButton).toBeFocused()

    await dialog.focus()
    await dialog.press('Escape')

    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Play music' })).toBeVisible()
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
    await expect(launchButton).toBeFocused()
  })


  test('music preview switches themes and stops cleanly', async ({ page }) => {
    await page.goto('/games')

    const selector = page.getByRole('combobox', { name: 'Select game music' })
    await expect(selector.locator('option')).toHaveCount(20)
    await selector.selectOption({ label: 'Shadow Escape' })

    await page.getByRole('button', { name: 'Play music' }).click()
    await expect(page.locator('[aria-live="polite"]')).toContainText('Music playing', { timeout: 5_000 })

    await selector.selectOption({ label: 'Tower Guard' })
    await expect(page.locator('[aria-live="polite"]')).toContainText('Music playing', { timeout: 5_000 })

    await page.getByRole('button', { name: 'Stop music' }).click()
    await expect(page.getByRole('button', { name: 'Play music' })).toBeVisible()
    await expect(page.locator('[aria-live="polite"]')).toBeEmpty()
  })


  test('Close game button restores page and stops game music', async ({ page }) => {
    await page.goto('/games')
    const launchButton = page.getByRole('button', { name: /Play demo/i })
    await launchButton.click()

    const dialog = page.getByRole('dialog', { name: 'Neon Memory' })
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('button', { name: 'Stop music' })).toBeVisible()
    await expect(page.locator('[aria-live="polite"]')).toContainText('Music playing', { timeout: 5_000 })

    await dialog.getByRole('button', { name: 'Close game' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Play music' })).toBeVisible()
    await expect(page.locator('[aria-live="polite"]')).toBeEmpty()
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
    await expect(launchButton).toBeFocused()
  })


  test('changing music theme while a game is open keeps the game modal usable', async ({ page }) => {
    await page.goto('/games')
    await page.getByRole('button', { name: /Play demo/i }).click()

    const dialog = page.getByRole('dialog', { name: 'Neon Memory' })
    const selector = page.getByRole('combobox', { name: 'Select game music' })
    await expect(dialog).toBeVisible()
    await expect(selector).toHaveValue('0')

    await selector.selectOption({ label: 'Deep Sea' })
    await expect(selector).toHaveValue('15')
    await expect(page.locator('[aria-live="polite"]')).toContainText('Music playing', { timeout: 5_000 })
    await expect(dialog.getByRole('button', { name: 'Start round' })).toBeEnabled()

    await dialog.getByRole('button', { name: 'Close game' }).click()
    await expect(dialog).toHaveCount(0)
  })

  test('reopening a closed game starts with music stopped and page unlocked', async ({ page }) => {
    await page.goto('/games')
    const launchButton = page.getByRole('button', { name: /Play demo/i })

    await launchButton.click()
    let dialog = page.getByRole('dialog', { name: 'Neon Memory' })
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('button', { name: 'Stop music' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Close game' }).click()

    await expect(dialog).toHaveCount(0)
    await expect(page.locator('[aria-live="polite"]')).toBeEmpty()
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
    await expect(launchButton).toBeFocused()

    await launchButton.click()
    dialog = page.getByRole('dialog', { name: 'Neon Memory' })
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play music' })).toBeVisible()
    await expect(page.locator('[aria-live="polite"]')).toBeEmpty()
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
    await expect(dialog.getByRole('button', { name: 'Close game' })).toBeFocused()
  })


  test('closing during pattern playback cancels pending game timers', async ({ page }) => {
    await page.goto('/games')
    const launchButton = page.getByRole('button', { name: /Play demo/i })
    await launchButton.click()

    let dialog = page.getByRole('dialog', { name: 'Neon Memory' })
    await dialog.getByRole('button', { name: 'Start round' }).click()
    await expect(dialog.getByText('Watch carefully…')).toBeVisible()

    await dialog.getByRole('button', { name: 'Close game' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')

    await launchButton.click()
    dialog = page.getByRole('dialog', { name: 'Neon Memory' })
    await expect(dialog.getByText('Press Start to watch the pattern.')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Start round' })).toBeEnabled()
    await expect(dialog.getByRole('button', { name: /^Tile [1-9]$/ }).first()).toBeDisabled()

    // Any timers from the unmounted game must not advance the reopened game.
    await page.waitForTimeout(1_200)
    await expect(dialog.getByText('Press Start to watch the pattern.')).toBeVisible()
    await expect(dialog.getByRole('button', { name: /^Tile [1-9]$/ }).first()).toBeDisabled()
  })


})
