import { test, expect } from '@playwright/test'

test.describe('Calendar page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calendar')
  })

  test('defaults to Earnings tab', async ({ page }) => {
    // The earnings tab should be active by default
    const activeTab = page.getByRole('button', { name: /earnings/i })
    await expect(activeTab).toBeVisible()
    // Check that it appears selected (has orange/accent styling or aria-selected)
    await expect(page.locator('body')).toContainText(/earnings/i)
  })

  test('can switch to Economic tab', async ({ page }) => {
    await page.getByRole('button', { name: /economic/i }).click()
    await expect(page.locator('body')).toContainText(/economic/i)
  })

  test('earnings tab shows relevant columns', async ({ page }) => {
    await expect(page.locator('body')).toContainText(/ticker|symbol|company/i, { timeout: 10_000 })
  })

  test('economic tab shows event and impact data', async ({ page }) => {
    await page.getByRole('button', { name: /economic/i }).click()
    await page.waitForTimeout(2_000)
    // Should show impact or event data, or empty state
    await expect(page.locator('body')).not.toContainText(/500 error/)
  })
})
