import { expect, test } from '@playwright/test'
import { expectNoSeriousA11y, loginAs } from './helpers'

test.describe('ABAP Debugger (App 2 integration)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'TESTOWNER')
  })

  test('debug button steps through a program and continues to the output', async ({ page }) => {
    const name = `Z_DBG_UI_${Date.now().toString().slice(-6)}`
    const created = await page.request.post('/api/programs', {
      data: {
        name,
        title: 'Debugger UI test',
        type: 'REPORT',
        source: `REPORT ${name}.\nDATA lv_sum TYPE i.\nlv_sum = 21 * 2.\nWRITE: / 'SUM', lv_sum.\n`,
      },
    })
    expect(created.status(), await created.text()).toBe(201)

    await page.goto('/')
    await page.getByRole('textbox', { name: 'Command field' }).fill(name)
    await page.getByRole('textbox', { name: 'Command field' }).press('Enter')
    await expect(page.getByRole('button', { name: 'Debug', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Debug', exact: true }).click()
    await expect(page.getByText(`ABAP Debugger — ${name}`)).toBeVisible()
    // first stop: lv_sum = 21 * 2. on line 3 (declarations are never stops)
    await expect(page.getByText(/Line 3 · stop #1/)).toBeVisible()
    await expect(page.getByText('innermost scope first', { exact: false })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'LV_SUM', exact: true })).toBeVisible()
    await expectNoSeriousA11y(page)

    await page.getByRole('button', { name: 'Step (F5)' }).click()
    await expect(page.getByText(/Line 4 · stop #2/)).toBeVisible()

    await page.getByRole('button', { name: 'Continue (F8)' }).click()
    await expect(page.getByText('SUM 42')).toBeVisible()
  })

  test('/h arms the debugger for the next execution', async ({ page }) => {
    const name = `Z_DBG_H_${Date.now().toString().slice(-6)}`
    const created = await page.request.post('/api/programs', {
      data: {
        name,
        title: 'Debugger /h test',
        type: 'REPORT',
        source: `REPORT ${name}.\nWRITE 'via slash-h'.\n`,
      },
    })
    expect(created.status(), await created.text()).toBe(201)

    await page.goto('/')
    await page.getByRole('textbox', { name: 'Command field' }).fill(name)
    await page.getByRole('textbox', { name: 'Command field' }).press('Enter')
    await expect(page.getByRole('button', { name: 'Debug', exact: true })).toBeVisible()

    await page.getByRole('textbox', { name: 'Command field' }).fill('/h')
    await page.getByRole('textbox', { name: 'Command field' }).press('Enter')
    await expect(page.getByText('Debugging switched on', { exact: false })).toBeVisible()

    await page.keyboard.press('F8')
    await expect(page.getByText(`ABAP Debugger — ${name}`)).toBeVisible()
  })

  test('ST22 lists the user runtime errors', async ({ page }) => {
    const name = `Z_DUMP_UI_${Date.now().toString().slice(-6)}`
    const dumped = await page.request.post('/api/execute', {
      data: {
        name,
        source: `REPORT ${name}.\nDATA lv_z TYPE i VALUE 0.\nDATA lv_r TYPE i.\nlv_r = 1 / lv_z.\n`,
      },
    })
    expect(dumped.status()).toBe(200)

    await page.goto('/')
    await page.getByRole('textbox', { name: 'Command field' }).fill('ST22')
    await page.getByRole('textbox', { name: 'Command field' }).press('Enter')
    await expect(page.getByRole('heading', { name: 'ABAP Dump Analysis (ST22)' })).toBeVisible()
    await expect(page.getByText(name)).toBeVisible()
    await expect(page.getByText('CX_SY_ZERODIVIDE').first()).toBeVisible()
  })

  test('SE16 selection criteria narrow the data browser results', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Command field' }).fill('SE16')
    await page.getByRole('textbox', { name: 'Command field' }).press('Enter')
    await expect(page.getByRole('heading', { name: 'Data Browser (SE16)' })).toBeVisible()

    await page.getByLabel('Table name').fill('SFLIGHT')
    await page.getByRole('button', { name: 'Display' }).click()
    const footer = page.getByText(/entries · page 1\/1/)
    await expect(footer).toBeVisible()
    const before = parseInt((await footer.textContent()) ?? '0', 10)
    expect(before).toBeGreaterThan(0)

    await page.getByRole('button', { name: 'Add Criterion' }).click()
    await page.getByLabel('Criterion 1: field').selectOption('CARRID')
    await page.getByLabel('Criterion 1: low value').fill('LH')
    await page.getByRole('button', { name: 'Execute (F8)' }).click()

    await expect(page.getByText(/entries · page 1\/1/)).toBeVisible()
    const afterText = await page.getByText(/entries · page 1\/1/).textContent()
    const after = parseInt(afterText ?? '0', 10)
    expect(after).toBeGreaterThan(0)
    expect(after).toBeLessThan(before)
    // only LH rows remain
    await expect(page.getByText('AA', { exact: true })).toHaveCount(0)
    await expect(page.getByText('LH', { exact: true }).first()).toBeVisible()
  })
})
