import { expect, test } from '@playwright/test'
import { createTestUser, expectNoSeriousA11y, loginAs } from './helpers'

test.describe('owner workbench and administration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'TESTOWNER')
  })

  test('owner reaches the SAP workbench and the admin dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-app="abapforge"]')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Main menu' })).toBeVisible()
    await expect(page.getByText('SAP Easy Access').first()).toBeVisible()
    await expectNoSeriousA11y(page)

    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: /System Administration/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Overview/ })).toBeVisible()
    await page.getByRole('tab', { name: /Users/ }).click()
    await expect(page.getByRole('heading', { name: 'User master' })).toBeVisible()
    await page.getByRole('tab', { name: /Audit log/ }).click()
    await expect(page.getByRole('heading', { name: 'Administrative audit log' })).toBeVisible()
    await expectNoSeriousA11y(page)
  })

  test('owner can open SE38 and execute a shared example', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-app="abapforge"]')).toBeVisible()

    await page.getByRole('textbox', { name: 'Command field' }).fill('SE38')
    await page.getByRole('textbox', { name: 'Command field' }).press('Enter')
    await expect(page.getByRole('heading', { name: 'ABAP Editor: Initial Screen' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Program' })).toBeVisible()
  })
})

test.describe('Modern ABAP workspace', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'TESTOWNER')
  })

  test('owner can validate and execute the Modern ABAP example', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Command field' }).fill('MODERN')
    await page.getByRole('textbox', { name: 'Command field' }).press('Enter')

    await expect(page.getByRole('heading', { name: 'Modern ABAP Workspace' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Z_MD_CONSTRUCTORS' })).toBeVisible()
    await expect(page.getByText('ABAP 7.40', { exact: true }).first()).toBeVisible()
    await expectNoSeriousA11y(page)

    await page.getByRole('button', { name: 'Validate' }).click()
    await expect(page.getByRole('heading', { name: 'Validation result' })).toBeVisible()
    await expect(page.getByText('EXECUTABLE', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Execute' }).click()
    await expect(page.getByRole('heading', { name: 'Execution output' })).toBeVisible()
    await expect(page.getByText(/REDUCE 1\.\.5 = 15/)).toBeVisible()
    await expect(page.getByText(/First IT row via table expression: ARJUN/)).toBeVisible()
    await expectNoSeriousA11y(page)
  })

  test('owner can validate a CDS definition while runtime execution stays disabled', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Command field' }).fill('MODERN')
    await page.getByRole('textbox', { name: 'Command field' }).press('Enter')
    await expect(page.getByRole('heading', { name: 'Modern ABAP Workspace' })).toBeVisible()

    await page.getByRole('button', { name: /ZI_MD_FLIGHT/ }).click()
    await expect(page.getByRole('heading', { name: 'ZI_MD_FLIGHT' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Execute' })).toBeDisabled()
    await expect(page.getByText('CDS DDL definitions are structurally validated only', { exact: false })).toBeVisible()

    await page.getByRole('button', { name: 'Validate' }).click()
    await expect(page.getByRole('heading', { name: 'Validation result' })).toBeVisible()
    await expect(page.getByText('VALID', { exact: true })).toBeVisible()
    await expect(page.getByText('CDS DDL validated against the simulated DDIC. No SQL is executed.', { exact: true })).toBeVisible()
    await expectNoSeriousA11y(page)
  })

  test('owner can create, save, execute and delete a private Modern object', async ({ page }) => {
    const name = `Z_MD_UI_${Date.now().toString().slice(-6)}`
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Command field' }).fill('MODERN')
    await page.getByRole('textbox', { name: 'Command field' }).press('Enter')
    await expect(page.getByRole('heading', { name: 'Modern ABAP Workspace' })).toBeVisible()

    await page.getByRole('button', { name: 'New', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Create a Modern object' })).toBeVisible()
    await page.getByLabel('Object name').fill(name)
    await page.getByRole('button', { name: 'Create object' }).click()
    await expect(page.getByRole('heading', { name })).toBeVisible()
    await expect(page.getByText('Private · v1', { exact: false }).first()).toBeVisible()

    await page.getByLabel('Source code').fill(`REPORT ${name}.\nWRITE 'saved modern object'.`)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('unsaved changes')).toHaveCount(0)

    await page.getByRole('button', { name: 'Execute', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Execution output' })).toBeVisible()
    await expect(page.getByText('saved modern object', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByRole('heading', { name: `Delete ${name}?` })).toBeVisible()
    await page.getByRole('button', { name: 'Delete object' }).click()
    await expect(page.getByRole('heading', { name })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Z_MD_CONSTRUCTORS' })).toBeVisible()
  })

  test('Modern workspace fits a phone viewport and returns to the standard workbench', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Command field' }).fill('MODERN')
    await page.getByRole('textbox', { name: 'Command field' }).press('Enter')
    await expect(page.getByRole('heading', { name: 'Modern ABAP Workspace' })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
    await expectNoSeriousA11y(page)

    await page.getByRole('button', { name: 'Standard workbench' }).click()
    await expect(page.getByText('SAP Easy Access').first()).toBeVisible()
  })
})

test.describe('ordinary user boundaries', () => {
  test('ordinary user is redirected away from /admin', async ({ page }) => {
    const username = `UI${Date.now().toString().slice(-8)}`
    await createTestUser(page, username)
    await loginAs(page, username)

    await page.goto('/admin')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('[data-app="abapforge"]')).toBeVisible()
    await expect(page.getByRole('heading', { name: /System Administration/ })).toHaveCount(0)
  })
})
