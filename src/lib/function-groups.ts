// Shared server helpers for the Function Builder's function groups.
import { db } from '@/lib/db'
import { changedOnNow } from '@/lib/function-module'

/**
 * Existing seeded function modules predate the FunctionGroup table. Derive the
 * shared example groups from their `groupName` values without touching any
 * user-created group or overwriting ownership.
 */
export async function ensureExampleFunctionGroups(): Promise<void> {
  const examples = await db.functionModule.findMany({
    where: { isExample: true },
    select: { groupName: true, title: true },
    orderBy: { name: 'asc' },
  })
  if (examples.length === 0) return

  const names = [...new Set(examples.map((fm) => fm.groupName.toUpperCase()))]
  const existing = await db.functionGroup.findMany({
    where: { name: { in: names } },
    select: { name: true },
  })
  const have = new Set(existing.map((group) => group.name))
  for (const name of names) {
    if (have.has(name)) continue
    const first = examples.find((fm) => fm.groupName.toUpperCase() === name)
    try {
      await db.functionGroup.create({
        data: {
          name,
          shortText: first?.title ? `${name} — example modules` : name,
          isExample: true,
          createdBy: 'SAP',
          changedOn: changedOnNow(),
        },
      })
    } catch (error) {
      // A concurrent request may have created it. Duplicate key is harmless.
      const message = error instanceof Error ? error.message : String(error)
      if (!/unique|already exists/i.test(message)) throw error
    }
  }
}
