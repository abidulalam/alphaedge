import { test, expect } from '@playwright/test'

test.describe('Auth guard', () => {
  test('redirects unauthenticated user from /dashboard to home with signin modal', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\?auth=signin/)
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('redirects unauthenticated user from /compare to home with signin modal', async ({ page }) => {
    await page.goto('/compare')
    await expect(page).toHaveURL(/\?auth=signin/)
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('sign-in modal shows email and password fields', async ({ page }) => {
    await page.goto('/?auth=signin')
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    await expect(page.getByPlaceholder(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('sign-in form shows error for invalid credentials', async ({ page }) => {
    await page.goto('/?auth=signin')
    await page.getByPlaceholder(/email/i).fill('invalid@test.com')
    await page.getByPlaceholder(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()
    // Error message should appear
    await expect(page.locator('[style*="color: var(--red)"], [class*="error"]')).toBeVisible({ timeout: 5_000 })
  })

  test('public pages are accessible without auth', async ({ page }) => {
    await page.goto('/markets')
    await expect(page).not.toHaveURL(/auth=signin/)
    await page.goto('/calendar')
    await expect(page).not.toHaveURL(/auth=signin/)
  })
})
