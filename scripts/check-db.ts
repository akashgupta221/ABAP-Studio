import { db } from '../src/lib/db'
async function main() {
  const topics = await db.topic.count()
  const programs = await db.program.count()
  const tables = await db.dbTable.count()
  const rows = await db.dbRow.count()
  const fms = await db.functionModule.count()
  console.log(JSON.stringify({ topics, programs, tables, rows, fms }))
  await db.$disconnect()
}
main().catch(e => { console.error('ERR', e.message); process.exit(1) })
