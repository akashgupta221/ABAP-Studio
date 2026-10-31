// Standalone end-to-end check: create a dictionary table in SE11 (service layer),
// then use it from ABAP — runs ONLY against a disposable database copy.
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const url = String(process.env.DATABASE_URL ?? '')
if (!url.includes('ddic-test-')) {
  console.error(`refusing to run: DATABASE_URL must point at a disposable ddic-test database (got "${url}")`)
  process.exit(2)
}

const { validateFields, validateTableName, createTable, addRow, listRows, updateTable, deleteTable } = await import('../src/lib/ddic')
const { loadDbSnapshot } = await import('../src/lib/engine-context')
const { runAbap } = await import('../src/lib/abap')

const out: Record<string, unknown> = {}
function fail(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exit(1)
}

// 1. create a customer table (SE11 create)
const nameCheck = validateTableName('ZTRAIN')
if (!nameCheck.ok) fail(`name validation failed: ${nameCheck.error}`)
const fieldsCheck = validateFields([
  { name: 'ID', type: 'CHAR', length: 3, key: true, text: 'Train id' },
  { name: 'CITY', type: 'CHAR', length: 20, text: 'Destination' },
  { name: 'PRICE', type: 'DEC', length: 10, decimals: 2, text: 'Ticket price' },
])
if (!fieldsCheck.ok) fail(`field validation failed: ${fieldsCheck.error}`)
await createTable(nameCheck.value, 'SE11 end-to-end check table', fieldsCheck.value)
out.created = nameCheck.value

// 2. maintain entries (SE11 entry maintenance)
const row1 = await addRow('ZTRAIN', { ID: '1', CITY: 'BERLIN', PRICE: '10.00' })
const row2 = await addRow('ZTRAIN', { ID: '2', CITY: 'PARIS', PRICE: '20.00' })
if (row1 === null || row2 === null || row1 === 'SAP_EXAMPLE' || row2 === 'SAP_EXAMPLE') fail('could not add entries')
const rows = await listRows('ZTRAIN')
out.entries = rows?.length ?? 0

// 3. the engine snapshot must now contain the new table
const snap = await loadDbSnapshot()
const def = snap.get('ZTRAIN')
if (!def) fail('ZTRAIN missing from the engine DB snapshot')
out.fields = def.fields.map((f) => `${f.name}:${f.type}${f.length ? `(${f.length}${f.decimals ? `,${f.decimals}` : ''})` : ''}${f.key ? ' KEY' : ''}`)

// 4. use it from ABAP: SELECT the entries, INSERT a new one, SELECT again
const program = `REPORT ZDDIC_E2E.
DATA wa TYPE ztrain.
DATA n TYPE ztrain.

SELECT * FROM ztrain INTO TABLE DATA(it).
WRITE: / 'rows before insert:', lines( it ).
LOOP AT it INTO wa.
  WRITE: / wa-id, wa-city, wa-price.
ENDLOOP.

n-id = '3'. n-city = 'ROME'. n-price = '42.50'.
INSERT ztrain FROM n.
COMMIT WORK.

SELECT * FROM ztrain INTO TABLE it.
WRITE: / 'rows after insert:', lines( it ).
`
const result = runAbap({ source: program, repid: 'ZDDIC_E2E', db: snap })
if (result.error) fail(`ABAP failed: ${result.error.kind} ${result.error.message}`)
const text = result.list.map((l: any) => (l.segments ?? []).map((s: any) => s.text).join('')).join('\n')
out.abapOutput = text
if (!/rows before insert:\s*2/.test(text)) fail(`expected 2 rows before insert, output was:\n${text}`)
if (!text.includes('BERLIN') || !text.includes('PARIS')) fail('ABAP SELECT did not see the maintained entries')
if (!/rows after insert:\s*3/.test(text)) fail(`expected 3 rows after insert, output was:\n${text}`)

// 5. ABAP-side writes stay in the per-run snapshot (training isolation), so the
// maintained entries are the persisted ones
const after = await listRows('ZTRAIN')
if ((after?.length ?? 0) !== 2 || !after?.some((r) => r.data.CITY === 'BERLIN')) fail('maintained entries were not persisted')
out.persisted = (after ?? []).map((r) => r.data.CITY)

// 6. SAP example tables stay protected
const guardUpdate = await updateTable('SCARR', 'hack', fieldsCheck.value)
const guardDelete = await deleteTable('SCARR')
out.sapGuard = guardUpdate === 'SAP_EXAMPLE' && guardDelete === 'SAP_EXAMPLE'
if (!out.sapGuard) fail('SAP example table was not protected')

// 7. clean up the disposable table
await deleteTable('ZTRAIN')

console.log(JSON.stringify({ ok: true, ...out }, null, 2))
