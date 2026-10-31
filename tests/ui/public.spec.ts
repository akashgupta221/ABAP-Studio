import { expect, test } from '@playwright/test'
import { expectNoSeriousA11y } from './helpers'

test.describe('public landing page', () => {
  test('landing renders the hero, navigation and feature sections', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Build Smaller|Build Smarter/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Master ABAP/ })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Log In' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign Up' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Get Started' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /complete ABAP workbench/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /visitor to first program/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /dashboard that keeps your work organized/ })).toBeVisible()
    await expect(page.getByText('Independent training simulator', { exact: false })).toBeVisible()
    await expectNoSeriousA11y(page)
  })

  test('landing header links navigate to auth pages', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Log In' }).first().click()
    await expect(page).toHaveURL(/\/sign-in$/)
    await page.goBack()
    await page.getByRole('link', { name: 'Sign Up' }).first().click()
    await expect(page).toHaveURL(/\/sign-up$/)
  })

  test('landing fits a phone viewport without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Master ABAP/ })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
    await expectNoSeriousA11y(page)
  })

  test('anonymous visitors stay on the landing page', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: /Master ABAP/ })).toBeVisible()
  })
})

test.describe('workbench logon pad (public)', () => {
  test('logon pad renders the Clerk-only sign-in path accessibly', async ({ page }) => {
    await page.goto('/workbench')
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

  test('keyboard navigation reaches secure logon', async ({ page }) => {
    await page.goto('/workbench')
    const link = page.getByRole('link', { name: 'Log On with Email / Google' })
    await link.focus()
    await expect(link).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/sign-in$/)
  })

  test('logon pad fits a phone viewport without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/workbench')
    await expect(page.getByTestId('logon-pad')).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
    await expectNoSeriousA11y(page)
  })
})

test.describe('secure access pages', () => {
  test('sign-in page is accessible with Clerk unconfigured', async ({ page }) => {
    await page.goto('/sign-in')
    await expect(page.getByRole('heading', { name: 'Log in to ABAP Atelier' })).toBeVisible()
    await expect(page.getByText('Clerk is not configured on this deployment.')).toBeVisible()
    await expect(page.getByText('Google sign-in tip')).toBeVisible()
    await expect(page.getByText(/Try another way/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to home' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Create a free account' })).toBeVisible()
    await expectNoSeriousA11y(page)
  })

  test('sign-up page is accessible with Clerk unconfigured', async ({ page }) => {
    await page.goto('/sign-up')
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
    await expect(page.getByText('Clerk is not configured on this deployment.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible()
    await expectNoSeriousA11y(page)
  })

  test('auth pages cross-link and fit a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/sign-in')
    await page.getByRole('link', { name: 'Create a free account' }).click()
    await expect(page).toHaveURL(/\/sign-up$/)
    await page.getByRole('link', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/sign-in$/)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
    await expectNoSeriousA11y(page)
  })
})
