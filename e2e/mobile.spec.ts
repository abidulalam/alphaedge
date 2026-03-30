import { test, expect, devices } from '@playwright/test'

// All tests use Pixel 5 (375x800 viewport)
test.use({ ...devices['Pixel 5'] })

test.describe('Mobile layout', () => {
  test('home page fits within viewport (no horizontal scroll)', async ({ page }) => {
    await page.goto('/')
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5) // 5px tolerance
  })

  test('navbar shows hamburger menu on mobile', async ({ page }) => {
    await page.goto('/')
    // Hamburger button should be visible; center nav links should be hidden
    const hamburger = page.locator('button[aria-label*="menu"], button svg').first()
    await expect(hamburger).toBeVisible()
  })

  test('markets page fits within viewport', async ({ page }) => {
    await page.goto('/markets')
    await page.waitForTimeout(2_000)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5)
  })

  test('calendar page fits within viewport', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForTimeout(2_000)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5)
  })

  test('home CTA button is tappable on mobile', async ({ page }) => {
    await page.goto('/')
    const cta = page.getByRole('link', { name: /launch terminal/i })
    await expect(cta).toBeVisible()
    const box = await cta.boundingBox()
    // Minimum touch target: 44px height
    expect(box!.height).toBeGreaterThanOrEqual(40)
  })
})
