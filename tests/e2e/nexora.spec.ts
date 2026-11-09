import { test, expect, type Page } from '@playwright/test'

/* ---------------------------------------------------------------------------
   NEXORA — end-to-end suite
   Drives the real application in demo-backend mode (no Supabase credentials),
   which exercises exactly the same UI + business rules as production.
   Run:  npx playwright test
--------------------------------------------------------------------------- */

const ADMIN = { email: 'admin@nexora.store', password: 'Nexora@2026' }

async function clearStorage(page: Page) {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}

async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill(ADMIN.email)
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
}

test.describe('Storefront', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page)
    await page.reload()
  })

  test('homepage renders hero, categories and product rails', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Premium Entertainment', {
      timeout: 15_000,
    })
    // official promotional banner is used in the hero
    await expect(page.locator('img[src="/brand/nexora-banner.png"]').first()).toBeVisible()
    // featured categories
    await expect(page.getByRole('heading', { name: 'Shop by category' })).toBeVisible()
    await expect(page.getByText('OTT Subscriptions').first()).toBeVisible()
    // product rails loaded from the catalogue
    await expect(page.getByRole('heading', { name: 'What everyone is buying' })).toBeVisible()
    // wait for the catalogue to render before counting — a bare count() reads
    // the DOM mid-fetch and races the data layer
    const cards = page.locator('article.nx-card')
    await expect(cards.first()).toBeVisible({ timeout: 15_000 })
    expect(await cards.count()).toBeGreaterThan(4)
    // honest demo-mode notice
    await expect(page.getByText('Demo', { exact: true })).toBeVisible()
  })

  test('catalogue search, sort and category filter work', async ({ page }) => {
    await page.goto('/products')
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible()
    await expect(page.getByText(/products?$/i).first()).toBeVisible()

    // search
    await page.getByPlaceholder('Search subscriptions…').fill('netflix')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/q=netflix/)
    // the matching product appears (possibly in more than one rail/section)
    await expect(page.getByRole('link', { name: 'Netflix Premium 4K', exact: true }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'ChatGPT Plus', exact: true })).toHaveCount(0)

    // clear + sort by price ascending
    await page.getByLabel('Clear search').click()
    await page.getByLabel('Sort products').selectOption('price_asc')
    await expect(page).toHaveURL(/sort=price_asc/)

    // category navigation
    await page.getByRole('link', { name: 'AI Premium Tools', exact: true }).first().click()
    await expect(page).toHaveURL(/category\/ai-premium-tools/)
    await expect(page.getByRole('heading', { name: 'AI Premium Tools' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'ChatGPT Plus', exact: true }).first()).toBeVisible()
  })

  test('product detail shows pricing, discount and availability', async ({ page }) => {
    await page.goto('/product/netflix-premium-4k')
    await expect(page.getByRole('heading', { name: 'Netflix Premium 4K', exact: true })).toBeVisible()
    await expect(page.getByText('৳390').first()).toBeVisible()
    await expect(page.getByText('৳650').first()).toBeVisible()
    await expect(page.getByText('40% OFF').first()).toBeVisible()
    await expect(page.getByText('In Stock').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Buy Now' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeVisible()
    await expect(page.getByText('You may also like')).toBeVisible()
  })

  test('cart persists across reloads and supports quantity changes', async ({ page }) => {
    await page.goto('/product/chatgpt-plus')
    await page.getByRole('button', { name: 'Add to Cart' }).click()
    await expect(page.getByText('Added to cart').first()).toBeVisible()

    await page.goto('/cart')
    await expect(page.getByRole('heading', { name: 'Shopping Cart' })).toBeVisible()
    await expect(page.getByText('ChatGPT Plus').first()).toBeVisible()
    await expect(page.getByText('1 item in your cart')).toBeVisible()

    // quantity up → total doubles
    await page.getByLabel('Increase quantity').click()
    await expect(page.getByText('2 items in your cart')).toBeVisible()
    await expect(page.getByText('৳2,580').first()).toBeVisible()

    await page.reload()
    await expect(page.getByText('2 items in your cart')).toBeVisible()
  })

  test('empty cart has an attractive empty state', async ({ page }) => {
    await page.goto('/cart')
    await expect(page.getByText('Your cart is empty')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Browse subscriptions' })).toBeVisible()
  })

  test('static content pages render', async ({ page }) => {
    for (const [path, heading] of [
      ['/about', 'A subscription store built for Bangladesh'],
      ['/contact', 'We answer fast, and like humans'],
      ['/faq', 'Frequently asked questions'],
      ['/offers', 'Exclusive deals, verified pricing'],
      ['/privacy', 'Privacy Policy'],
      ['/terms', 'Terms & Conditions'],
      ['/refund', 'Refund Policy'],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
    }
    await page.goto('/this-page-does-not-exist')
    await expect(page.getByText('This page took a wrong turn')).toBeVisible()
  })
})

test.describe('Guest checkout → manual payment → admin verification', () => {
  test('full order lifecycle', async ({ page }) => {
    await clearStorage(page)

    // 1 · add to cart and check out
    // Quantity 2 is required: the NEXORA10 coupon has a ৳500 minimum and one
    // month of Netflix is ৳390, so a single unit can never qualify.
    await page.goto('/product/netflix-premium-4k')
    await page.getByRole('button', { name: 'Increase quantity' }).click()
    await page.getByRole('button', { name: 'Buy Now' }).click()
    await expect(page).toHaveURL(/checkout/)

    await page.getByLabel('Full name').fill('Tanvir Ahmed')
    await page.getByLabel('Email address').fill('tanvir@example.com')
    await page.getByLabel('Mobile number').fill('01712345678')

    // payment method selection shows the merchant number
    await expect(page.getByText('01575864415').first()).toBeVisible()
    await page.getByRole('button', { name: /Nagad/ }).click()

    // coupon · NEXORA10 = 10% off with a ৳500 minimum order.
    // A single ৳390 plan cannot qualify, so raise the quantity to 2 first.
    await page.getByLabel('Coupon code').fill('NEXORA10')
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page.getByText(/NEXORA10 applied/)).toBeVisible()
    // 2 × ৳390 = ৳780 → 10% = ৳78
    await expect(page.getByText('− ৳78')).toBeVisible()

    // place the order (no payment taken)
    await page.getByRole('button', { name: /Place Order/ }).click()
    await expect(page).toHaveURL(/\/order\/NX-/, { timeout: 20_000 })

    // Read the number from the URL: the page also renders environment-variable
    // names inside a demo notice, so `.font-mono` is not a unique selector.
    const orderNo = page.url().split('/order/')[1] ?? ''
    expect(orderNo).toMatch(/^NX-\d{6}-\d{5}$/)

    // 2 · order page: pending payment + instructions
    await expect(page.getByText('Pending Payment').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Complete your payment' })).toBeVisible()

    // validation: bad trx id is rejected client-side
    await page.getByLabel('Transaction ID (TrxID)').fill('a')
    await page.getByRole('button', { name: /Submit payment/ }).click()
    await expect(page.getByText(/Enter the transaction ID/)).toBeVisible()

    // 3 · submit payment
    await page.getByLabel('Transaction ID (TrxID)').fill('9F2X7K1QAB')
    await page.getByRole('button', { name: /Submit payment/ }).click()
    await expect(
      page.getByRole('status').filter({ hasText: /payment submitted/i }).first(),
    ).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Under review')).toBeVisible()

    // 4 · order tracking timeline is visible
    await expect(page.getByRole('heading', { name: 'Order tracking' })).toBeVisible()
    await expect(page.getByText('Payment Submitted').first()).toBeVisible()

    // 5 · admin verifies the payment, then completes the order
    await loginAsAdmin(page)
    await page.goto('/admin/orders?status=payment_submitted')
    await expect(page.getByText(orderNo)).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Manage' }).first().click()

    await expect(page.getByText('9F2X7K1QAB').first()).toBeVisible()
    await page.getByRole('button', { name: 'Verify payment' }).click()
    await expect(page.getByRole('status').filter({ hasText: /payment verified/i }).first()).toBeVisible({
      timeout: 15_000,
    })

    // order is verified — never auto-completed.
    //
    // The toast names the new status in its description, so match the LABEL, not
    // just "Status updated": the previous toast is still on screen and would
    // otherwise satisfy this assertion while the request is still in flight.
    await page.getByLabel('New order status').selectOption('processing')
    await page.getByRole('button', { name: 'Apply status' }).click()
    await expect(
      page.getByRole('status').filter({ hasText: /status updated[\s\S]*processing/i }).first(),
    ).toBeVisible({ timeout: 15_000 })

    // The drawer's status select is controlled by the loaded order and the
    // post-apply refresh resets it. Reopening the drawer guarantees a settled
    // render before the next transition, instead of racing the refresh.
    // The order has left the "Payment Submitted" filter, so reopen it by search
    // rather than from the filtered table.
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await page.goto(`/admin/orders?search=${encodeURIComponent(orderNo)}`)
    await page.getByRole('button', { name: 'Manage' }).first().click()
    await expect(page.getByLabel('New order status')).toHaveValue('processing')
    await page.getByLabel('New order status').selectOption('completed')
    await page.getByRole('button', { name: 'Apply status' }).click()
    await expect(
      page.getByRole('status').filter({ hasText: /status updated[\s\S]*completed/i }).first(),
    ).toBeVisible({ timeout: 15_000 })

    // 6 · dashboard reflects the completed order
    //
    // The order was placed as a GUEST and the admin session has since replaced
    // the customer session, so /dashboard/orders (which lists orders belonging
    // to the signed-in user) is empty by design. The authoritative record is
    // the admin order table — assert the final state there.
    await page.goto(`/admin/orders?search=${encodeURIComponent(orderNo)}`)
    const row = page.getByRole('row').filter({ hasText: orderNo }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })
    // scoped to the row: a bare getByText('Completed') also matches the hidden
    // <option value="completed"> in the status filter.
    await expect(row).toContainText(/completed/i)
  })

  test('admin dashboard shows live stats after an order', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
    await expect(page.getByText('Total sales')).toBeVisible()
    await expect(page.getByText('Total orders')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sales overview' })).toBeVisible()
    // 14-day chart rendered: one bar per day in the series
    await expect(page.getByText('Verified revenue over the last 14 days')).toBeVisible()
    // A bar with ৳0 revenue has zero height, so it is present but not
    // "visible" — assert the count rather than visibility.
    const bars = page.locator('.rounded-t')
    await expect.poll(async () => bars.count(), { timeout: 15_000 }).toBe(14)
  })
})

test.describe('Authentication & authorisation', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page)
  })

  test('protected routes redirect anonymous visitors to login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/)
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin/)
  })

  test('registration creates an account and lands on the dashboard', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Full name').fill('Nusrat Jahan')
    await page.getByLabel('Email address').fill('nusrat@example.com')
    await page.getByLabel('Mobile number (optional)').fill('01812345678')
    await page.getByLabel('Password', { exact: true }).fill('StrongPass123')
    await page.getByLabel('Confirm password').fill('StrongPass123')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
    await expect(page.getByText('Customer dashboard')).toBeVisible()
  })

  test('password mismatch is blocked', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Full name').fill('Test User')
    await page.getByLabel('Email address').fill('test@example.com')
    await page.getByLabel('Password', { exact: true }).fill('StrongPass123')
    await page.getByLabel('Confirm password').fill('Different123')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('Passwords do not match.')).toBeVisible()
  })

  test('invalid credentials are rejected', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email address').fill('nobody@example.com')
    await page.getByLabel('Password', { exact: true }).fill('WrongPassword1')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText(/Invalid email or password/)).toBeVisible()
  })

  test('a customer account cannot open the admin panel', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email address').fill('customer@nexora.store')
    await page.getByLabel('Password', { exact: true }).fill('Customer@2026')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    await page.goto('/admin')
    await expect(page.getByText('Administrator access required')).toBeVisible()
    // and the vulnerable admin UI is never mounted
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toHaveCount(0)
  })
})

test.describe('Admin panel', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page)
  })

  test('product create → edit → visible in storefront', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/products')
    await page.getByRole('button', { name: 'Add product' }).click()

    await page.getByLabel('Product name').fill('Test Spotify Duo')
    await page.getByLabel('Brand').fill('Spotify')
    await page.getByLabel('Original price (৳)').fill('1200')
    await page.getByLabel('Discounted price (৳)').fill('599')
    await page.getByLabel('Short description').fill('Two premium Spotify accounts in one bundle.')
    await page.getByRole('button', { name: 'Create product' }).click()
    await expect(
      page.getByRole('status').filter({ hasText: /product created/i }).first(),
    ).toBeVisible({ timeout: 15_000 })
    // the new product shows in the table (and may also appear in a toast)
    await expect(page.getByText('Test Spotify Duo').first()).toBeVisible()

    // appears in the storefront catalogue
    await page.goto('/products?q=Spotify+Duo')
    await expect(page.getByRole('link', { name: 'Test Spotify Duo' }).first()).toBeVisible()
  })

  test('invalid pricing is rejected by the form', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/products')
    await page.getByRole('button', { name: 'Add product' }).click()
    await page.getByLabel('Product name').fill('Bad Price Product')
    await page.getByLabel('Original price (৳)').fill('100')
    await page.getByLabel('Discounted price (৳)').fill('500')
    await page.getByRole('button', { name: 'Create product' }).click()
    await expect(page.getByText(/Discounted price cannot be higher/)).toBeVisible()
  })

  test('settings changes reach the live storefront', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/settings')
    await page.getByRole('tab', { name: 'Notices' }).click()
    const field = page.getByLabel('Announcement bar text')
    await field.fill('E2E announcement: instant delivery all week')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(
      page.getByRole('status').filter({ hasText: /settings saved/i }).first(),
    ).toBeVisible({ timeout: 15_000 })

    await page.goto('/')
    await expect(page.getByText('E2E announcement: instant delivery all week')).toBeVisible()
  })

  test('admin sections all load without errors', async ({ page }) => {
    await loginAsAdmin(page)
    for (const [path, heading] of [
      ['/admin/products', 'Products'],
      ['/admin/categories', 'Categories'],
      ['/admin/orders', 'Orders'],
      ['/admin/coupons', 'Coupons'],
      ['/admin/customers', 'Customers'],
      ['/admin/promotions', 'Promotions & offers'],
      ['/admin/content', 'Content & FAQ'],
      ['/admin/reviews', 'Reviews'],
      ['/admin/support', 'Support inbox'],
      ['/admin/settings', 'Website settings'],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
    }
  })
})

test.describe('Responsive layout', () => {
  const viewports = [
    { name: 'Android phone', width: 390, height: 844 },
    { name: 'iPhone', width: 430, height: 932 },
    { name: 'Tablet', width: 820, height: 1180 },
    { name: 'Laptop', width: 1280, height: 800 },
    { name: 'Desktop', width: 1920, height: 1080 },
  ]

  for (const vp of viewports) {
    test(`homepage has no horizontal overflow on ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement
        return { scroll: doc.scrollWidth, client: doc.clientWidth }
      })
      expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 2)

      // mobile nav is reachable on small screens
      if (vp.width < 1024) {
        await page.getByLabel('Open menu').click()
        await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeVisible()
      }
    })
  }

  test('product grid reflows to two columns on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/products')
    const firstCard = page.locator('article.nx-card').first()
    const secondCard = page.locator('article.nx-card').nth(1)
    const a = await firstCard.boundingBox()
    const b = await secondCard.boundingBox()
    expect(a && b).toBeTruthy()
    // side by side on the same row
    expect(Math.abs((a!.y ?? 0) - (b!.y ?? 0))).toBeLessThan(10)
  })
})

test.describe('Order tracking for guests', () => {
  test('guest can reopen their order from recent list', async ({ page }) => {
    await clearStorage(page)
    await page.goto('/product/youtube-premium')
    await page.getByRole('button', { name: 'Buy Now' }).click()
    await page.getByLabel('Full name').fill('Guest Buyer')
    await page.getByLabel('Email address').fill('guest@example.com')
    await page.getByLabel('Mobile number').fill('01912345678')
    await page.getByRole('button', { name: /Place Order/ }).click()
    await expect(page).toHaveURL(/\/order\/NX-/)

    await page.goto('/track')
    await expect(page.getByRole('heading', { name: 'Track your order' })).toBeVisible()
    await page.getByRole('button').filter({ hasText: /^NX-/ }).first().click()
    await expect(page).toHaveURL(/\/order\/NX-/)
    await expect(page.getByText('Pending Payment').first()).toBeVisible()
  })

  test('unknown order number surfaces a friendly error', async ({ page }) => {
    await page.goto('/track')
    await page.getByLabel('Order number').fill('NX-000000-00000')
    await page.getByLabel('Email address').fill('nobody@example.com')
    await page.getByRole('button', { name: 'Track order' }).click()
    // the page reports the miss either as a matched-form error or a lookup error
    await expect(
      page.getByText(/could not match that order|could not find that order|No orders on this device/i),
    ).toBeVisible({ timeout: 15_000 })
  })
})
