// ── DDIC maintenance (SE11) tests ──────────────────────────────────────
// Pure validators run in-process; the end-to-end "create table → use in ABAP"
// check runs as a subprocess against a disposable copy of the dev database
// (scripts/verify-ddic.ts refuses to run on anything but a ddic-test file).
import { describe, expect, test, beforeAll, afterAll } from 'bun:test'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateFields, validateRowData, validateTableName } from '../src/lib/ddic'

describe('DDIC table name validation', () => {
  test('customer namespace Z*/Y* with 3-30 name characters', () => {
    expect(validateTableName('ztrain').ok).toBe(true)
    expect(validateTableName(' YREPORT_2 ').ok).toBe(true)
    expect(validateTableName('XTRAIN').ok).toBe(false) // not customer namespace
    expect(validateTableName('AB').ok).toBe(false) // too short
    expect(validateTableName('ZTRAIN EXTRA').ok).toBe(false) // space
    expect(validateTableName('ZTABLE_NAME_THAT_IS_WAY_TOO_LONG_12345').ok).toBe(false)
    expect(validateTableName('').ok).toBe(false)
    expect(validateTableName(undefined).ok).toBe(false)
  })
})

describe('DDIC field catalog validation', () => {
  const key = { name: 'ID', type: 'CHAR', length: 3, key: true }

  test('accepts a valid catalog', () => {
    const r = validateFields([key, { name: 'CITY', type: 'CHAR', length: 20 }])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value[0].name).toBe('ID')
      expect(r.value[1].text).toBe('CITY') // text defaults to the field name
    }
  })

  test('requires at least one key field', () => {
    const r = validateFields([{ name: 'CITY', type: 'CHAR', length: 20 }])
    expect(r.ok).toBe(false)
  })

  test('rejects duplicates, bad names and unknown types', () => {
    expect(validateFields([key, { ...key }]).ok).toBe(false)
    expect(validateFields([{ ...key, name: '1BAD' }]).ok).toBe(false)
    expect(validateFields([{ ...key, type: 'WAT' }]).ok).toBe(false)
    expect(validateFields([]).ok).toBe(false)
  })

  test('fixed-length types are pinned (INT4=4, DATS=8, TIMS=6), STR is variable', () => {
    const r = validateFields([
      key,
      { name: 'N', type: 'INT4', length: 99 },
      { name: 'D', type: 'DATS' },
      { name: 'T', type: 'TIMS' },
      { name: 'S', type: 'STR' },
    ])
    expect(r.ok).toBe(true)
    if (r.ok) {
      const byName = Object.fromEntries(r.value.map((f) => [f.name, f]))
      expect(byName.N.length).toBe(4)
      expect(byName.D.length).toBe(8)
      expect(byName.T.length).toBe(6)
      expect(byName.S.length).toBe(null)
    }
  })

  test('DEC requires decimals < length', () => {
    expect(validateFields([key, { name: 'P', type: 'DEC', length: 10, decimals: 2 }]).ok).toBe(true)
    expect(validateFields([key, { name: 'P', type: 'DEC', length: 2, decimals: 2 }]).ok).toBe(false)
  })
})

describe('DDIC row validation', () => {
  const fields = [
    { name: 'ID', key: true },
    { name: 'CITY', key: false },
  ]

  test('normalizes and keeps unknown fields out', () => {
    const r = validateRowData(fields, { id: 'A1', city: 'BERLIN', hack: 'x' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ ID: 'A1', CITY: 'BERLIN' })
  })

  test('rejects empty key values', () => {
    expect(validateRowData(fields, { ID: '', CITY: 'BERLIN' }).ok).toBe(false)
  })
})

describe('SE11 end-to-end: create table → use it in ABAP', () => {
  let dir: string
  let dbFile: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'ddic-test-'))
    dbFile = join(dir, 'ddic-test-1.db')
    copyFileSync('prisma/db/app.db', dbFile)
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  test('created table is immediately usable from ABAP (SELECT/INSERT)', async () => {
    const proc = Bun.spawn([process.execPath, 'scripts/verify-ddic.ts'], {
      cwd: join(import.meta.dir, '..'),
      env: { ...process.env, DATABASE_URL: `file:${dbFile}`, SKIP_AUTO_MIGRATE: '1', NODE_ENV: 'production' },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
    const code = await proc.exited
    if (code !== 0) throw new Error(`verify-ddic failed (${code}): ${err || out}`)
    const report = JSON.parse(out)
    expect(report.ok).toBe(true)
    expect(report.created).toBe('ZTRAIN')
    expect(report.entries).toBe(2)
    expect(report.abapOutput).toContain('BERLIN')
    expect(report.abapOutput).toContain('PARIS')
    expect(report.abapOutput).toContain('rows after insert:')
    expect(report.sapGuard).toBe(true)
  }, 60_000)
})
