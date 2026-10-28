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

    const easyAccess = page.getByTestId('easy-access')
    await expect(easyAccess.getByRole('button', { name: 'Favorites' })).toHaveAttribute('aria-expanded', 'true')
    await expect(easyAccess.getByRole('button', { name: 'SAP Menu' })).toHaveAttribute('aria-expanded', 'true')
    await expect(easyAccess.getByText('Recently Used', { exact: true })).toHaveCount(0)
    await expect(easyAccess.locator('button[aria-expanded="true"]')).toHaveCount(2)

    // ABAP Training lives inside SAP Menu, after the standard folders.
    const training = easyAccess.getByRole('button', { name: 'ABAP Training' })
    await expect(training).toBeVisible()
    expect(await training.evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingLeft))).toBeGreaterThan(10)
    const order = await easyAccess.evaluate((element) => {
      const labels = Array.from(element.querySelectorAll('button')).map((button) => button.textContent?.trim() ?? '')
      const find = (text: string) => labels.findIndex((label) => label.includes(text))
      return { webClient: find('WebClient UI Framework'), training: find('ABAP Training') }
    })
    expect(order.webClient).toBeGreaterThan(-1)
    expect(order.training).toBeGreaterThan(order.webClient)

    // No extra top-level Administration action and no recent-command dropdown.
    await expect(page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: 'Administration', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Command field history' })).toHaveCount(0)
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
    await expect(page.getByRole('textbox', { name: 'Program:' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Possible entries (F4)' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Check', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Where-Used List', exact: true })).toBeVisible()
  })

  test('SE38 create walks Program Attributes and Object Directory Entry into a clean include', async ({ page }) => {
    const name = `Z_UI_INC_${Date.now().toString().slice(-6)}`
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Command field' }).fill('SE38')
    await page.getByRole('textbox', { name: 'Command field' }).press('Enter')
    await expect(page.getByRole('heading', { name: 'ABAP Editor: Initial Screen' })).toBeVisible()

    await page.locator('#se38-program').fill(name)
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    const attributes = page.getByRole('dialog', { name: `Program attributes ${name}` })
    await expect(attributes).toBeVisible()
    await expect(attributes).toContainText(`ABAP: Program Attributes ${name} Change`)
    await attributes.getByLabel('Program title').fill('UI created include')
    await attributes.getByLabel('Program type').selectOption('INCLUDE')
    await attributes.getByRole('button', { name: 'Save', exact: true }).click()

    const directory = page.getByRole('dialog', { name: /Create Object Directory Entry/ })
    await expect(directory).toBeVisible()
    await expect(directory.getByText(name, { exact: true }).first()).toBeVisible()
    await directory.getByRole('button', { name: 'Local Object', exact: true }).click()

    const editor = page.getByRole('textbox', { name: 'ABAP source editor' })
    await expect(editor).toBeVisible()
    const source = await editor.inputValue()
    expect(source).toContain(`*& Include ${name}`)
    expect(source.startsWith('*&---------------------------------------------------------------------*')).toBe(true)
    expect(source).not.toContain('WRITE')
    await expect(page).toHaveTitle(new RegExp(`ABAP Editor: Change Include ${name}$`))
    await expectNoSeriousA11y(page)
  })

  test('SE38 action row keeps critical actions visible without horizontal scrolling', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Command field' }).fill('SE38')
    await page.getByRole('textbox', { name: 'Command field' }).press('Enter')
    await expect(page.getByRole('heading', { name: 'ABAP Editor: Initial Screen' })).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    const nav = page.getByRole('navigation', { name: 'Main menu' })
    for (const label of ['Check', 'Activate', 'Execute', 'Where-Used List', 'More']) {
      await expect(nav.getByRole('button', { name: label, exact: true })).toBeVisible()
    }
    const overflow = await nav.evaluate((element) => {
      const row = element.firstElementChild as HTMLElement | null
      return row ? row.scrollWidth - row.clientWidth : -1
    })
    expect(overflow).toBeLessThanOrEqual(1)

    await nav.getByRole('button', { name: 'More', exact: true }).click()
    await expect(page.getByRole('menuitem', { name: 'Environment Analysis' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Delete...' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Variants' })).toBeVisible()
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
    await expect(page.getByText('SAP Easy Access').filter({ visible: true }).first()).toBeVisible()
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

test.describe('Function Builder (SE37)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'TESTOWNER')
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Command field' }).fill('SE37')
    await page.getByRole('textbox', { name: 'Command field' }).press('Enter')
    await expect(page.getByRole('heading', { name: 'Function Builder: Initial Screen' })).toBeVisible()
  })

  test('shared example function modules stay read-only and execute in the test console', async ({ page }) => {
    await expect(page.getByRole('banner').getByText('MER (105)')).toBeVisible()
    await expect(page.getByRole('button', { name: 'System menu' })).toBeVisible()

    await page.getByTestId('function-builder').getByText('Z_CALC_DISCOUNT', { exact: true }).dblclick()
    await expect(page.getByText('shared example · read-only')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'ABAP source editor' })).not.toBeEditable()

    await page.getByRole('button', { name: 'Test', exact: true }).click()
    await page.locator('#fm-input-PRICE').fill('100')
    await page.locator('#fm-input-CUST_TYPE').fill('A')
    await page.getByRole('button', { name: 'Execute', exact: true }).click()
    await expect(page.getByText('Result values')).toBeVisible()
    await expect(page.locator('tbody tr').filter({ hasText: 'DISCOUNT_PRICE' })).toContainText('90')
    await expect(page.getByText('Function module Z_CALC_DISCOUNT executed successfully.')).toBeVisible()
    await expectNoSeriousA11y(page)
  })

  test('owner can create a group and function module, activate it, test it and delete it', async ({ page }) => {
    const suffix = Date.now().toString().slice(-6)
    const group = `ZFG_UI_${suffix}`
    const initialName = `ZFM_UI_${suffix}`
    const fm = `ZFM_MAN_${suffix}`

    await page.getByRole('button', { name: 'Create group' }).click()
    const groupDialog = page.getByRole('dialog')
    await expect(groupDialog.getByRole('heading', { name: 'Create function group' })).toBeVisible()
    await groupDialog.getByLabel('Name').fill(group)
    await groupDialog.getByLabel('Short text').fill('UI function group')
    await groupDialog.getByRole('button', { name: 'Create group' }).click()
    await expect(page.getByRole('button', { name: new RegExp(`${group} \\(0\\)`) })).toBeVisible()

    await page.locator('#se37-fm-name').fill(initialName)
    await page.getByTestId('function-builder').getByRole('button', { name: 'Create', exact: true }).click()
    const fmDialog = page.getByRole('dialog')
    await expect(fmDialog.getByRole('heading', { name: 'Create function module' })).toBeVisible()
    // The name is seeded from the selection field and remains fully editable.
    await expect(fmDialog.locator('#new-fm-name')).toHaveValue(initialName)
    await fmDialog.getByLabel('Name').fill(fm)
    await expect(fmDialog.locator('#new-fm-name')).toHaveValue(fm)
    await fmDialog.getByLabel('Short text').fill('UI function module')
    await fmDialog.getByRole('button', { name: 'Create function module' }).click()
    await expect(page.getByText(fm, { exact: true }).first()).toBeVisible()
    await expect(page.getByTestId('function-builder').getByText('Inactive', { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await page.getByRole('button', { name: 'Add parameter' }).click()
    await page.getByLabel('Parameter name 1').fill('NUM1')
    await page.getByLabel('Type specification 1').fill('I')
    await page.getByRole('button', { name: 'Add parameter' }).click()
    await page.getByLabel('Parameter name 2').fill('NUM2')
    await page.getByLabel('Type specification 2').fill('I')
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    await page.getByRole('button', { name: 'Add parameter' }).click()
    await page.getByLabel('Parameter name 1').fill('TOTAL')
    await page.getByLabel('Type specification 1').fill('I')
    await page.getByRole('button', { name: 'Source Code', exact: true }).click()
    const generated = await page.getByRole('textbox', { name: 'ABAP source editor' }).inputValue()
    expect(generated).toContain('*"*"Local Interface:')
    expect(generated).toContain('*"     REFERENCE(NUM1) TYPE  I')
    expect(generated).toContain('*"     REFERENCE(TOTAL) TYPE  I')

    await page.getByRole('textbox', { name: 'ABAP source editor' }).fill(
      `FUNCTION ${fm.toLowerCase()}.\n  WRITE: / 'ui function module'.\nENDFUNCTION.`,
    )
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText(/saved — inactive until activated/)).toBeVisible()
    const savedResponse = await page.request.get(`/api/functions/${fm}`)
    const savedFunction = (await savedResponse.json()).function as { source: string }
    expect(savedFunction.source).toContain('*"     REFERENCE(NUM1) TYPE  I')
    expect(savedFunction.source).toContain('*"     REFERENCE(TOTAL) TYPE  I')
    expect(savedFunction.source).toContain("WRITE: / 'ui function module'.")
    await page.getByRole('button', { name: 'Activate', exact: true }).click()
    await expect(page.getByText(/saved and activated/)).toBeVisible()
    await expect(page.getByTestId('function-builder').getByText('Active', { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Test', exact: true }).click()
    await page.getByRole('button', { name: 'Execute', exact: true }).click()
    await expect(page.getByText('Function module ' + fm + ' executed successfully.')).toBeVisible()
    await expect(page.getByText('ui function module', { exact: true })).toBeVisible()
    await expectNoSeriousA11y(page)

    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByText(fm, { exact: true })).toHaveCount(0)

    page.once('dialog', (dialog) => { void dialog.accept(group) })
    await page.getByRole('button', { name: 'Delete group' }).click()
    await expect(page.getByRole('button', { name: new RegExp(`${group} \\(0\\)`) })).toHaveCount(0)
  })
})
