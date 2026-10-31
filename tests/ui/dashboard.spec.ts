import { expect, test } from '@playwright/test'
import { createTestUser, expectNoSeriousA11y, loginAs } from './helpers'

test.describe('dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'TESTOWNER')
  })

  test('dashboard shows greeting, real stats and quick actions', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /TESTOWNER/ })).toBeVisible()
    await expect(page.getByTestId('stat-my-programs')).toBeVisible()
    await expect(page.getByRole('button', { name: 'New Program', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Workbench', exact: true })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Dashboard' })).toBeVisible()
    await expectNoSeriousA11y(page)
  })

  test('landing page redirects the owner to the dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: /TESTOWNER/ })).toBeVisible()
  })

  test('owner-only dashboard bounces ordinary users to the workbench', async ({ page }) => {
    const username = `UI${Date.now().toString().slice(-8)}`
    await createTestUser(page, username)
    await loginAs(page, username)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/workbench$/)
    await expect(page.locator('[data-app="abap-atelier"]')).toBeVisible()
    await expect(page.getByRole('heading', { name: /TESTOWNER/ })).toHaveCount(0)
  })

  test('post-login entry chooser offers Classic and Modern ABAP', async ({ page }) => {
    await page.goto('/workbench?entry=1')
    const dialog = page.getByRole('dialog', { name: 'Choose your workspace' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Classic ABAP/ })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Modern ABAP/ })).toBeVisible()
    await expectNoSeriousA11y(page)

    // entering the Classic workbench clears the chooser
    await dialog.getByRole('button', { name: /Classic ABAP/ }).click()
    await expect(page.getByRole('dialog', { name: 'Choose your workspace' })).toHaveCount(0)
    await expect(page.locator('[data-app="abap-atelier"]')).toBeVisible()
  })

  test('protected dashboard redirects anonymous visitors to sign-in', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/sign-in$/)
  })

  test('create program flows from the dashboard into the workbench', async ({ page }) => {
    const name = `Z_DASH_UI_${Date.now().toString().slice(-6)}`
    await page.goto('/dashboard')

    await page.getByRole('button', { name: 'New Program' }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Object name').fill(name)
    await dialog.getByLabel('Title (optional)').fill('Dashboard created program')
    await dialog.getByRole('button', { name: 'Create program' }).click()

    await expect(page).toHaveURL(new RegExp(`program=${name}$`))
    await expect(page.locator('[data-app="abap-atelier"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Debug', exact: true })).toBeVisible()
  })

  test('program table lists a new program and delete removes it', async ({ page }) => {
    const name = `Z_DASH_DEL_${Date.now().toString().slice(-6)}`
    const created = await page.request.post('/api/programs', {
      data: { name, title: 'Dashboard delete test', type: 'REPORT' },
    })
    expect(created.status(), await created.text()).toBe(201)

    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click()
    const row = page.getByRole('row').filter({ hasText: name })
    await expect(row).toBeVisible()

    await row.getByRole('button', { name: `Delete ${name}` }).click()
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: 'Delete program' }).click()
    await expect(page.getByRole('row').filter({ hasText: name })).toHaveCount(0)
    await expectNoSeriousA11y(page)
  })

  test('sidebar switches views and collapses', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /Curriculum/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Curriculum' }).click()
    await expect(page.getByRole('heading', { name: 'Curriculum', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'My Programs' }).click()
    await expect(page.getByRole('heading', { name: 'My Programs', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
  })

  test('deep links open workbench transactions', async ({ page }) => {
    await page.goto('/workbench?tcode=SE16')
    await expect(page.locator('[data-app="abap-atelier"]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Data Browser (SE16)' })).toBeVisible()
  })

  test('dashboard fits a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /TESTOWNER/ })).toBeVisible()
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible()
    await page.getByRole('button', { name: 'Close navigation' }).click()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
    await expectNoSeriousA11y(page)
  })
})
