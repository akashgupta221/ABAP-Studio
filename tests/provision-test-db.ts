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
  await db.functionGroup.deleteMany()
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

  // One DDIC table so the SE16 data-browser endpoint has something to serve.
  await db.dbTable.create({
    data: {
      name: 'SFLIGHT',
      description: 'Flight booking demo table',
      fields: JSON.stringify([
        { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline code' },
        { name: 'CONNID', type: 'CHAR', length: 4, key: true, text: 'Flight number' },
        { name: 'FLDATE', type: 'DATS', length: 8, key: true, text: 'Flight date' },
        { name: 'PRICE', type: 'CURR', length: 15, decimals: 2, text: 'Airfare' },
      ]),
      rows: {
        create: [
          { seq: 1, data: JSON.stringify({ CARRID: 'AA', CONNID: '0017', FLDATE: '20261027', PRICE: '422.50' }) },
          { seq: 2, data: JSON.stringify({ CARRID: 'LH', CONNID: '0400', FLDATE: '20261028', PRICE: '610.00' }) },
          { seq: 3, data: JSON.stringify({ CARRID: 'LH', CONNID: '0401', FLDATE: '20261029', PRICE: '585.20' }) },
        ],
      },
    },
  })
  console.log('✓ API test database prepared (owner TESTOWNER, SFLIGHT fixture)')
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
