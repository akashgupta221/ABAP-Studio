import { expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const TEST_SECRET = process.env.E2E_TEST_SECRET ?? 'ui-test-only-secret-0123456789abcdef'

export async function loginAs(page: Page, username: string): Promise<void> {
  const response = await page.request.post('/api/test/session', {
    headers: { 'x-e2e-secret': TEST_SECRET },
    data: { username },
  })
  expect(response.status(), await response.text()).toBe(200)
}

export async function createTestUser(page: Page, username: string): Promise<void> {
  const response = await page.request.post('/api/test/users', {
    headers: { 'x-e2e-secret': TEST_SECRET },
    data: { username },
  })
  expect(response.status(), await response.text()).toBe(201)
}

export async function expectNoSeriousA11y(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  const serious = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  )
  const details = serious
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n${violation.nodes
          .map((node) => `  ${node.target.join(' ')} — ${node.failureSummary ?? ''}`)
          .join('\n')}`,
    )
    .join('\n\n')
  expect(serious, details).toEqual([])
}
