// ── SAP GUI window caption per screen (title bar text) ─────────────────
import type { TabItem, ViewKind } from './types'

export interface TitleInput {
  view: ViewKind
  tabs: TabItem[]
  activeTabKey: string | null
  lastTcode: string
  browserTable: string | null
  selectedFunction: string | null
  selectionProgram?: string | null
}

export function getContextTitle(input: TitleInput): string {
  const { view, tabs, activeTabKey, lastTcode, browserTable, selectedFunction, selectionProgram } = input
  const active = tabs.find((t) => t.key === activeTabKey) ?? null

  // the selection-screen caption only applies while its own tab is active
  if (selectionProgram && active?.kind === 'program' && active.programName === selectionProgram) {
    return `ABAP Editor: ${selectionProgram} — Selection Screen`
  }

  if (view === 'tab') {
    if (active?.kind === 'program') return `ABAP Editor: ${active.programName}`
    if (active?.kind === 'output') return `ABAP List: ${active.programName}`
    return 'SAP Easy Access'
  }

  switch (view) {
    case 'home':
      return lastTcode === 'SE80' ? 'Object Navigator (SE80)' : 'SAP Easy Access'
    case 'dictionary':
      return 'ABAP Dictionary: Initial Screen'
    case 'browser':
      return browserTable ? `Data Browser: ${browserTable}` : 'Data Browser: Initial Screen'
    case 'classes':
      return 'Class Builder: Initial Screen'
    case 'functions':
      return selectedFunction ? `Function Builder: ${selectedFunction}` : 'Function Builder: Initial Screen'
    case 'search':
      return 'Repository Information System: Search'
    case 'syllabus':
      return 'ABAP Training: Syllabus'
    default:
      return 'SAP Easy Access'
  }
}
