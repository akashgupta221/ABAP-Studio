import { describe, expect, test } from 'bun:test'
import { se38CreateSource } from '../src/lib/program-defaults'

describe('SE38 create templates', () => {
  test('include gets the classic *& header and no demo output', () => {
    const source = se38CreateSource('Z_AK_INCLUDE', 'INCLUDE')
    expect(source).toBe(
      [
        '*&---------------------------------------------------------------------*',
        '*& Include Z_AK_INCLUDE',
        '*&---------------------------------------------------------------------*',
        '',
      ].join('\n'),
    )
    expect(source).not.toContain('gv_value')
  })

  test('report is a clean REPORT statement', () => {
    const source = se38CreateSource('Z_AK_REPORT', 'REPORT')
    expect(source).toBe('REPORT z_ak_report.\n')
    expect(source).not.toContain('Hello')
  })

  test('class contains empty definition and implementation sections', () => {
    const source = se38CreateSource('Z_AK_CLASS', 'CLASS')
    expect(source).toBe(
      'CLASS z_ak_class DEFINITION.\nENDCLASS.\n\nCLASS z_ak_class IMPLEMENTATION.\nENDCLASS.\n',
    )
    expect(source).not.toContain('Hello')
    expect(source).not.toContain('METHOD')
  })

  test('function group is a plain pool statement', () => {
    expect(se38CreateSource('Z_AK_GROUP', 'FUNCTION_GROUP')).toBe('FUNCTION-POOL z_ak_group.\n')
  })
})
