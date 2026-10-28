import { expect, test } from '@playwright/test'
import { expectNoSeriousA11y } from './helpers'

test.describe('public surfaces', () => {
  test('logon pad renders the Clerk-only sign-in path accessibly', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('logon-pad')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'SAP — Secure Logon' })).toBeVisible()
    await expect(page.getByLabel('Client')).toHaveValue('105')
    await expect(page.getByLabel('Language')).toHaveValue('EN')
    await expect(page.getByRole('link', { name: 'Log On with Email / Google' })).toBeVisible()
    await expect(page.getByText(/Google passkey tip/)).toBeVisible()
    await expect(page.getByText('Legacy SAP user master')).toHaveCount(0)
    await expect(page.getByText('Legacy Log On')).toHaveCount(0)
    await expectNoSeriousA11y(page)
  })

  test('secure sign-in page is accessible with Clerk unconfigured', async ({ page }) => {
    await page.goto('/sign-in')
    await expect(page.getByRole('heading', { name: 'SAP — Secure Logon' })).toBeVisible()
    await expect(page.getByText('Clerk is not configured on this deployment.')).toBeVisible()
    await expect(page.getByText('Google sign-in tip')).toBeVisible()
    await expect(page.getByText(/Try another way/)).toBeVisible()
    await expect(page.getByRole('link', { name: /Back to workbench/ })).toBeVisible()
    await expectNoSeriousA11y(page)
  })

  test('secure registration page is accessible with Clerk unconfigured', async ({ page }) => {
    await page.goto('/sign-up')
    await expect(page.getByRole('heading', { name: 'SAP — Create User' })).toBeVisible()
    await expect(page.getByText('Clerk is not configured on this deployment.')).toBeVisible()
    await expectNoSeriousA11y(page)
  })

  test('keyboard navigation reaches secure logon', async ({ page }) => {
    await page.goto('/')
    const link = page.getByRole('link', { name: 'Log On with Email / Google' })
    await link.focus()
    await expect(link).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/sign-in$/)
  })

  test('logon pad fits a phone viewport without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.getByTestId('logon-pad')).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
    await expectNoSeriousA11y(page)
  })
})
