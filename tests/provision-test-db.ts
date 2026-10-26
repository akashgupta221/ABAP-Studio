// Prepare a disposable API-test database. Never point this at production.
import { db, ensureSchema } from '../src/lib/db'

const url = process.env.DATABASE_URL ?? ''
if (!url.includes('api-test')) {
  console.error('Refusing to reset a database whose URL does not contain "api-test"')
  process.exit(1)
}

async function main() {
  await ensureSchema()
  // Fresh test database: remove all application rows in FK-safe order.
  await db.adminAuditLog.deleteMany()
  await db.userFavorite.deleteMany()
  await db.executionLog.deleteMany()
  await db.program.deleteMany()
  await db.functionModule.deleteMany()
  await db.dbRow.deleteMany()
  await db.dbTable.deleteMany()
  await db.topic.deleteMany()
  await db.user.deleteMany()

  await db.user.create({
    data: {
      username: 'TESTOWNER',
      // Retained for schema compatibility; test sessions use the test broker.
      passwordHash: '',
      displayName: 'Test Owner',
      role: 'OWNER',
    },
  })
  console.log('✓ API test database prepared (owner TESTOWNER)')
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
