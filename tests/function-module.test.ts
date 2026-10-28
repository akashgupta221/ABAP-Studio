import { describe, expect, test } from 'bun:test'
import {
  defaultFmSource,
  fmInterfaceBlock,
  sanitizeFmParams,
  syncFmInterface,
} from '../src/lib/function-module'

const addNumbers = sanitizeFmParams({
  import: [
    { name: 'num1', type: 'i' },
    { name: 'num2', type: 'i' },
  ],
  export: [{ name: 'total', type: 'i' }],
})

describe('Function Builder Local Interface', () => {
  test('matches the SAP generated block for the owner example', () => {
    expect(fmInterfaceBlock(addNumbers)).toBe(
      [
        '*"----------------------------------------------------------------------',
        '*"*"Local Interface:',
        '*"  IMPORTING',
        '*"     REFERENCE(NUM1) TYPE  I',
        '*"     REFERENCE(NUM2) TYPE  I',
        '*"  EXPORTING',
        '*"     REFERENCE(TOTAL) TYPE  I',
        '*"----------------------------------------------------------------------',
      ].join('\n'),
    )
  })

  test('covers changing, tables, exceptions, optional and default parameters', () => {
    const params = sanitizeFmParams({
      import: [{ name: 'iv_text', type: 'STRING', optional: true }],
      changing: [{ name: 'cv_count', type: 'I', default: '0' }],
      tables: [{ name: 'et_rows', type: 'ZROW' }],
      exceptions: ['not_found', 'invalid_input', ''],
    })
    const block = fmInterfaceBlock(params)
    expect(block).toContain('*"  CHANGING\n*"     REFERENCE(CV_COUNT) TYPE  I DEFAULT 0')
    expect(block).toContain('*"  TABLES\n*"     REFERENCE(ET_ROWS) TYPE  ZROW')
    expect(block).toContain('*"  EXCEPTIONS\n*"     NOT_FOUND\n*"     INVALID_INPUT')
    expect(block).toContain('*"     REFERENCE(IV_TEXT) TYPE  STRING OPTIONAL')
  })

  test('default source carries the generated block and no placeholder text', () => {
    const source = defaultFmSource('Z_AK_ADD_NUMBERS', addNumbers)
    expect(source.startsWith('FUNCTION Z_AK_ADD_NUMBERS.\n')).toBe(true)
    expect(source).toContain(fmInterfaceBlock(addNumbers))
    expect(source).toContain('\n\nENDFUNCTION.\n')
    expect(source.toLowerCase()).not.toContain('todo')
    expect(source).not.toContain('maintain parameters')
  })

  test('sync replaces a stale block and preserves the implementation', () => {
    const stale = [
      'FUNCTION Z_AK_ADD_NUMBERS.',
      '*"----------------------------------------------------------------------',
      '*"*" Local Interface:',
      '*"  (maintain parameters on the Import tab)',
      '*"----------------------------------------------------------------------',
      '',
      '  total = num1 + num2.',
      '',
      'ENDFUNCTION.',
    ].join('\n')
    const synced = syncFmInterface(stale, addNumbers)
    expect(synced).toContain('*"*"Local Interface:')
    expect(synced).not.toContain('maintain parameters')
    expect(synced).toContain('  total = num1 + num2.')
    expect(synced.endsWith('ENDFUNCTION.')).toBe(true)
    expect(syncFmInterface(synced, addNumbers)).toBe(synced)
  })

  test('sync inserts a block when a source has none', () => {
    const source = 'FUNCTION Z_NO_INTERFACE.\n\n  WRITE / 1.\n\nENDFUNCTION.\n'
    const synced = syncFmInterface(source, addNumbers)
    expect(synced.startsWith(`FUNCTION Z_NO_INTERFACE.\n${fmInterfaceBlock(addNumbers)}`)).toBe(true)
    expect(synced).toContain('\n\n  WRITE / 1.\n')
  })

  test('non function-module source is left unchanged', () => {
    const source = "REPORT z_demo.\n\nWRITE / 'hello'.\n"
    expect(syncFmInterface(source, addNumbers)).toBe(source)
  })
})
