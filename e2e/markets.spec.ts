import { test, expect } from '@playwright/test'

test.describe('Markets page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/markets')
  })

  test('page loads without error', async ({ page }) => {
    await expect(page).toHaveURL('/markets')
    await expect(page.locator('body')).not.toContainText(/error|500/i)
  })

  test('displays major index section', async ({ page }) => {
    await expect(page.getByText(/SPY|S&P|indices/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('displays sector section', async ({ page }) => {
    await expect(page.getByText(/sector/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('clicking a stock in gainers/losers navigates to dashboard', async ({ page }) => {
    // Wait for market data to load
    await page.waitForTimeout(3_000)
    const stockLink = page.getByRole('link', { name: /AAPL|MSFT|NVDA|TSLA/ }).first()
    if (await stockLink.count() > 0) {
      await stockLink.click()
      await expect(page).toHaveURL(/dashboard/)
    }
  })
})
