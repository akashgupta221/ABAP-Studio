// ── Shared frontend types mirroring the backend API contract ──────────

export type MessageType = 'S' | 'E' | 'W' | 'I' | 'A' | 'X'

export interface ListSegment {
  text: string
  x: number // 1-based column
  len: number
  color?: string
  intensified?: boolean
  inverse?: boolean
  hotspot?: boolean
  input?: boolean
  kind?: 'text' | 'number' | 'date' | 'time'
}

export interface ListLine {
  segments: ListSegment[]
  underline?: boolean
}

export interface AlvColumn {
  name: string
  label: string
  type: string
  length: number
  visible: boolean
}

export interface AlvGrid {
  title: string
  columns: AlvColumn[]
  rows: Record<string, string>[]
  totalRows: number
}

export interface MessageItem {
  msgType: MessageType
  text: string
  displayLike?: string
  line?: number
}

export interface ParamSpec {
  kind: 'param'
  name: string
  label: string
  type: string
  length?: number
  decimals?: number
  defaultValue?: string
  obligatory?: boolean
  lowerCase?: boolean
  asCheckbox?: boolean
  radioGroup?: string
}

export interface SelectOptionSpec {
  kind: 'selopt'
  name: string
  label: string
  ddicTable?: string
  ddicField?: string
  defaultValue?: string
  defaultValueHigh?: string
}

export type SelectionScreenItem = ParamSpec | SelectOptionSpec

export interface RunError {
  kind: 'SYNTAX' | 'RUNTIME'
  message: string
  line?: number
  statement?: string
  abapType?: string
}

export interface RunResult {
  status: 'SUCCESS' | 'ERROR' | 'REQUIRES_INPUT'
  error?: RunError
  list: ListLine[]
  alv?: AlvGrid
  messages: MessageItem[]
  selectionScreen?: SelectionScreenItem[]
  durationMs: number
  stats: { steps: number; linesWritten: number; selects: number; dbReads: number }
}

export interface CheckIssue {
  kind: 'E' | 'W' | 'S'
  line: number
  message: string
  statement?: string
}

// ── Repository objects ────────────────────────────────────────────────

export type ObjectType = 'REPORT' | 'CLASS' | 'INCLUDE' | 'FUNCTION_GROUP' | 'TABLE' | 'FM' | 'TOPIC'
export type ProgramType = 'REPORT' | 'CLASS' | 'INCLUDE' | 'FUNCTION_GROUP'
export type Paradigm = 'POP' | 'OOP' | 'BOTH'
export type ModernKind = 'ABAP' | 'CDS' | 'RAP' | 'AMDP'
export type ModernEnvironment = 'STANDARD' | 'MODERN'

export interface ProgramListItem {
  id: string
  name: string
  title: string
  description: string
  type: ProgramType
  paradigm: Paradigm
  environment: ModernEnvironment
  modernKind: ModernKind
  isExample: boolean
  tags: string
  executions: number
  topicId: number | null
  topicTitle: string | null
  createdAt?: string
  updatedAt: string
  ownerId?: string | null
  ownerUsername?: string | null
}

export interface ProgramFull extends ProgramListItem {
  source: string
  version: number
  topic?: { id: number; title: string } | null
}

export interface TopicExample {
  id: string
  name: string
  title: string
  type: ProgramType
  paradigm: Paradigm
  isExample: boolean
}

export interface Topic {
  id: number
  srNo: number
  code: string
  title: string
  summary: string
  details: string
  paradigm: string
  category: string
  examples: TopicExample[]
  exampleCount: number
}

export interface DdicTable {
  name: string
  description: string
  isSap: boolean
  fieldCount: number
  rowCount: number
  topicId: number | null
}

export interface DdicField {
  name: string
  type: string
  length: number
  decimals: number
  key: boolean
  text: string
}

export interface TableDetail {
  table: { name: string; description: string }
  fields: DdicField[]
  rows: Record<string, string>[]
  total: number
  page: number
  pageSize: number
}

export interface FmParam {
  name: string
  type?: string
  kind?: string
  optional?: boolean
  [k: string]: unknown
}

export interface FunctionModule {
  id: string
  name: string
  groupName: string
  title: string
  isExample: boolean
  active: boolean
  ownerId: string | null
  ownerUsername: string | null
  createdBy: string
  changedBy: string
  changedOn: string
  importParams: FmParam[]
  exportParams: FmParam[]
  changingParams: FmParam[]
  tablesParams: FmParam[]
  exceptions: string[]
  source: string
}

export interface FunctionGroup {
  id?: string
  name: string
  shortText: string
  isExample: boolean
  ownerId?: string | null
  ownerUsername?: string | null
  createdBy?: string
  changedOn?: string
  moduleCount: number
}

export interface FmTestResponse {
  result: RunResult
  lines: string[]
  outputs: Record<string, string>
  subrc: number | null
  notes: string[]
  params: {
    import: FmParam[]
    export: FmParam[]
    changing: FmParam[]
    tables: FmParam[]
    exceptions: string[]
  }
  active: boolean
}

export interface Favorite {
  id: string
  objectType: string
  objectName: string
  label: string
}

export interface RecentExecution {
  id: string
  programName: string
  status: string
  durationMs: number
  message: string
  createdAt: string
}

export interface SearchHit {
  objectType: string
  name: string
  title: string
  detail: string
  score: number
  extra?: Record<string, unknown> & { id?: string; topicId?: number; srNo?: number }
}

export interface SearchGroup {
  type: string
  count: number
  hits: SearchHit[]
}

// ── UI models ─────────────────────────────────────────────────────────

// SE38 subobjects (ABAP Editor initial screen)
export type Se38Subobject = 'source' | 'variants' | 'attributes' | 'text' | 'doc'

export const SE38_SUBOBJECT_LABELS: Record<Se38Subobject, string> = {
  source: 'Source code',
  variants: 'Variants',
  attributes: 'Attributes',
  text: 'Text elements',
  doc: 'Documentation',
}

// syllabus topic categories → menu sub-nodes (which topic sits under which sub-topic)
export const TOPIC_CATEGORIES: { id: string; label: string; hint: string }[] = [
  { id: 'CORE', label: 'Core ABAP', hint: 'Fundamentals: types, control flow, modularization, internal tables, OOP' },
  { id: 'REPORTING', label: 'Reporting', hint: 'Classic and ALV list output' },
  { id: 'MODERN', label: 'Modern ABAP', hint: 'SAP HANA, ABAP 7.40+ syntax, virtual data model' },
]

export function groupTopicsByCategory<T extends { category: string }>(topics: T[]) {
  return TOPIC_CATEGORIES
    .map((cat) => ({ ...cat, topics: topics.filter((t) => (t.category ?? '').toUpperCase() === cat.id) }))
    .filter((g) => g.topics.length > 0)
}

export type ViewKind =
  | 'home'
  | 'tab' // program editor / output tabs
  | 'se38' // ABAP Editor initial screen + subobject screens
  | 'search'
  | 'syllabus'
  | 'dictionary'
  | 'browser'
  | 'classes'
  | 'functions'
  | 'modern'
  | 'debugger' // ABAP Debugger (/h or Debug button)
  | 'dumps' // ABAP Dump Analysis (ST22)

// ── ABAP Debugger (mirrors /api/debug; stateless step-by-re-execution) ──
export interface DebugVariable {
  name: string
  kind: string // ABAP type letter, STRUCTURE, TABLE, OBJECT, REF
  value: string
  level: number // 0 = innermost frame
  detail?: unknown // structured preview for structures / first table rows
}

export interface DebugStopState {
  stopIndex: number
  line: number
  depth: number
  kind: string
  statement: string
  variables: DebugVariable[]
}

export interface DebugSessionState {
  programName: string
  source: string
  parameters?: Record<string, string | string[]>
  stop: DebugStopState
  breakpoints: number[]
  list: ListLine[]
  busy: boolean
}

export interface DumpEntry {
  id: number
  programName: string
  status: string
  durationMs: number
  message: string
  errorType: string | null
  errorLine: number | null
  listLines: number
  createdAt: string
}

export interface SystemMessage {
  id: number
  msgType: MessageType
  text: string
  createdAt: number
}

export interface ProgramTabData {
  id: string
  name: string
  title: string
  type: ProgramType
  paradigm: Paradigm
  environment: ModernEnvironment
  modernKind: ModernKind
  isExample: boolean
  version: number
  /** false = saved but not activated yet (classic SE38 Active/Inactive state) */
  active?: boolean
  executions: number
  tags: string
  topicId: number | null
  topicTitle: string | null
  source: string
  dirty: boolean
  running: boolean
}

export interface TabItem {
  key: string // 'prog:NAME' | 'out:NAME'
  kind: 'program' | 'output'
  programName: string
}
