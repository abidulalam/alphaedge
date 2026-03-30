import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('renders hero headline and CTA', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible()
    const cta = page.getByRole('link', { name: /launch terminal/i })
    await expect(cta).toBeVisible()
  })

  test('CTA links to dashboard', async ({ page }) => {
    const cta = page.getByRole('link', { name: /launch terminal/i })
    const href = await cta.getAttribute('href')
    expect(href).toContain('/dashboard')
  })

  test('shows sign-in modal when visiting /?auth=signin', async ({ page }) => {
    await page.goto('/?auth=signin')
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    await expect(page.getByPlaceholder(/password/i)).toBeVisible()
  })

  test('ticker tape renders and contains stock tickers', async ({ page }) => {
    const tape = page.locator('[class*="ticker"], [data-testid="ticker-tape"]').first()
    // Ticker tape should eventually show prices
    await expect(page.locator('body')).toContainText(/AAPL|NVDA|MSFT|TSLA/, { timeout: 10_000 })
  })

  test('navigation links are visible on desktop', async ({ page }) => {
    await expect(page.getByRole('link', { name: /markets/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /calendar/i }).first()).toBeVisible()
  })
})
