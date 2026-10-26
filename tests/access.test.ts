import { describe, expect, test } from 'bun:test'
import {
  canEditFunction,
  canEditFunctionGroup,
  canEditProgram,
  canViewFunction,
  canViewFunctionGroup,
  canViewProgram,
  functionGroupListWhere,
  functionListWhere,
  isLegacyProgram,
  programListWhere,
} from '../src/lib/access'
import { SANDBOX_LABEL, sandboxName } from '../src/lib/sandbox'

const alice = { id: 'alice-id', username: 'ALICE' }
const bob = { id: 'bob-id', username: 'BOB' }

describe('program access rules', () => {
  test('shared examples are visible to everyone but never editable', () => {
    const example = { ownerId: null, isExample: true }
    expect(canViewProgram(alice, example, false)).toBe(true)
    expect(canViewProgram(bob, example, false)).toBe(true)
    expect(canEditProgram(alice, example, false)).toBe(false)
    expect(canEditProgram(bob, example, true)).toBe(false)
  })

  test('private programs are visible and editable only by their owner', () => {
    const program = { ownerId: alice.id, isExample: false }
    expect(canViewProgram(alice, program, false)).toBe(true)
    expect(canEditProgram(alice, program, false)).toBe(true)
    expect(canViewProgram(bob, program, false)).toBe(false)
    expect(canEditProgram(bob, program, false)).toBe(false)
  })

  test('the designated owner may see and edit every non-example program', () => {
    const program = { ownerId: alice.id, isExample: false }
    expect(canViewProgram(bob, program, true)).toBe(true)
    expect(canEditProgram(bob, program, true)).toBe(true)
  })

  test('unclaimed legacy rows are owner-only', () => {
    const legacy = { ownerId: null, isExample: false }
    expect(isLegacyProgram(legacy)).toBe(true)
    expect(canViewProgram(alice, legacy, false)).toBe(false)
    expect(canViewProgram(alice, legacy, true)).toBe(true)
    expect(canEditProgram(alice, legacy, false)).toBe(false)
  })

  test('ordinary list scope contains examples plus own programs only', () => {
    expect(programListWhere(alice, false)).toEqual({
      OR: [{ isExample: true }, { ownerId: alice.id }],
    })
    expect(programListWhere(alice, true)).toEqual({})
  })
})

describe('private practice sandbox', () => {
  test('uses the visible Z_MY_PRACTICE name as a unique per-user physical row', () => {
    expect(SANDBOX_LABEL).toBe('Z_MY_PRACTICE')
    const a = sandboxName('ALICE')
    const b = sandboxName('BOB')
    expect(a).toBe('Z_MY_PRACTICE_ALICE')
    expect(b).toBe('Z_MY_PRACTICE_BOB')
    expect(a).not.toBe(b)
    expect(a.length).toBeLessThanOrEqual(40)
  })
})


describe('function module access rules', () => {
  test('shared example function modules are visible to everyone but never editable', () => {
    const example = { ownerId: null, isExample: true }
    expect(canViewFunction(alice, example, false)).toBe(true)
    expect(canViewFunction(bob, example, false)).toBe(true)
    expect(canEditFunction(alice, example, false)).toBe(false)
    expect(canEditFunction(bob, example, true)).toBe(false)
  })

  test('private function modules are visible and editable only by their creator', () => {
    const fm = { ownerId: alice.id, isExample: false }
    expect(canViewFunction(alice, fm, false)).toBe(true)
    expect(canEditFunction(alice, fm, false)).toBe(true)
    expect(canViewFunction(bob, fm, false)).toBe(false)
    expect(canEditFunction(bob, fm, false)).toBe(false)
  })

  test('the designated owner may inspect and administer private function modules', () => {
    const fm = { ownerId: alice.id, isExample: false }
    expect(canViewFunction(bob, fm, true)).toBe(true)
    expect(canEditFunction(bob, fm, true)).toBe(true)
  })

  test('function group ownership mirrors function module ownership', () => {
    const group = { ownerId: alice.id, isExample: false }
    const example = { ownerId: null, isExample: true }
    expect(canViewFunctionGroup(alice, group, false)).toBe(true)
    expect(canEditFunctionGroup(bob, group, false)).toBe(false)
    expect(canViewFunctionGroup(bob, group, true)).toBe(true)
    expect(canEditFunctionGroup(bob, example, true)).toBe(false)
  })

  test('ordinary list scope contains examples plus own function modules', () => {
    expect(functionListWhere(alice, false)).toEqual({
      OR: [{ isExample: true }, { ownerId: alice.id }],
    })
    expect(functionGroupListWhere(alice, false)).toEqual({
      OR: [{ isExample: true }, { ownerId: alice.id }],
    })
    expect(functionListWhere(alice, true)).toEqual({})
    expect(functionGroupListWhere(alice, true)).toEqual({})
  })
})
