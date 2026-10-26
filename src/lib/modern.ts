// ── Modern ABAP workspace: capability matrix + definition validators ──
// This module is pure and shared by the server API and the client workspace.
// It deliberately separates what is executable from what is only validated or
// simulated. No function here pretends to be a real SAP HANA/ABAP Cloud runtime.

export type ModernKind = 'ABAP' | 'CDS' | 'RAP' | 'AMDP'
export type ModernLevel = 'EXECUTABLE' | 'VALIDATED' | 'SIMULATED' | 'UNSUPPORTED'
export type ModernStatus = 'EXECUTABLE' | 'VALID' | 'INVALID'

export interface ModernCapability {
  id: string
  label: string
  level: ModernLevel
  detail: string
}

export interface ModernIssue {
  severity: 'E' | 'W' | 'I'
  line: number
  message: string
}

export interface ModernValidation {
  kind: ModernKind
  status: ModernStatus
  summary: string
  issues: ModernIssue[]
}

export const MODERN_KINDS: ModernKind[] = ['ABAP', 'CDS', 'RAP', 'AMDP']

export const MODERN_LEVEL_LABEL: Record<ModernLevel, string> = {
  EXECUTABLE: 'Executable',
  VALIDATED: 'Validated',
  SIMULATED: 'Simulated',
  UNSUPPORTED: 'Unsupported',
}

export const MODERN_LEVEL_TONE: Record<ModernLevel, string> = {
  EXECUTABLE: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  VALIDATED: 'border-sky-300 bg-sky-50 text-sky-800',
  SIMULATED: 'border-amber-300 bg-amber-50 text-amber-900',
  UNSUPPORTED: 'border-slate-300 bg-slate-100 text-slate-700',
}

export const MODERN_DISCLAIMER =
  'Modern ABAP is a learning workspace. Executable examples run in the local ABAP engine. CDS, RAP and AMDP definitions are structurally validated only; no SAP HANA database, RAP runtime, OData service or live SAP system is connected.'

// Starter sources are deliberately small and use only constructs the simulator
// supports. The ABAP template is executable; the others are validator targets.
export const MODERN_TEMPLATES: Record<ModernKind, string> = {
  ABAP: `REPORT Z_MD_SCRATCH LINE-SIZE 110.

TYPES tt_numbers TYPE STANDARD TABLE OF i WITH EMPTY KEY.
DATA(lv_name) = 'Modern ABAP'.
DATA(lt_numbers) = VALUE tt_numbers( ( 1 ) ( 2 ) ( 3 ) ).
DATA(lv_total) = REDUCE i(
  INIT sum = 0
  FOR n IN lt_numbers
  NEXT sum = sum + n
).

WRITE: / |Hello { lv_name }|.
WRITE: / |Total: { lv_total }|.
`,
  CDS: `@EndUserText.label: 'My first CDS view'
define view entity ZI_MY_VIEW
  as select from sflight
{
  key carrid,
  key connid,
  key fldate,
      price,
      currency
}
`,
  RAP: `managed implementation in class zbp_my_entity unique;
strict ( 2 );

define behavior for ZI_My_Entity alias MyEntity
persistent table sflight
lock master
authorization master ( instance )
{
  create;
  update;
  delete;
}
`,
  AMDP: `CLASS zcl_my_amdp DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_amdp_marker_hdb.
    CLASS-METHODS get_flights
      IMPORTING VALUE(iv_carrid) TYPE sflight-carrid
      EXPORTING VALUE(et_flights) TYPE STANDARD TABLE OF sflight.
ENDCLASS.

CLASS zcl_my_amdp IMPLEMENTATION.
  METHOD get_flights BY DATABASE PROCEDURE FOR HDB LANGUAGE SQLSCRIPT.
    et_flights = SELECT * FROM sflight WHERE carrid = :iv_carrid;
  ENDMETHOD.
ENDCLASS.
`,
}

export const MODERN_CAPABILITIES: ModernCapability[] = [
  {
    id: 'abap-740',
    label: 'ABAP 7.40 constructor expressions',
    level: 'EXECUTABLE',
    detail:
      'Inline DATA(...), string templates |...|, VALUE, FOR, REDUCE, COND, SWITCH, CONV, NEW and table expressions run in the local ABAP engine.',
  },
  {
    id: 'open-sql',
    label: 'Open SQL on the simulated database',
    level: 'EXECUTABLE',
    detail:
      'SELECT / INSERT / UPDATE / DELETE operate on the seeded SFLIGHT, SCARR, SPFLI and other training tables. Results are real engine output, not SAP production data.',
  },
  {
    id: 'cds',
    label: 'CDS view entities (core DDL)',
    level: 'VALIDATED',
    detail:
      'The definition is checked for a valid entity name, source table, element list and balanced delimiters against the simulated DDIC. The SQL is never executed and no CDS runtime is started.',
  },
  {
    id: 'rap',
    label: 'RAP behavior definitions',
    level: 'VALIDATED',
    detail:
      'Managed/unmanaged headers, persistent table, alias, operations and structural blocks are validated. No RAP runtime, draft persistence, behavior implementation or OData service runs.',
  },
  {
    id: 'amdp',
    label: 'AMDP signatures and SQLScript bodies',
    level: 'SIMULATED',
    detail:
      'The class, marker interface, method signature and BY DATABASE PROCEDURE block are captured and structurally checked. SQLScript is never sent to HANA or executed.',
  },
  {
    id: 'rap-service',
    label: 'RAP service / OData metadata',
    level: 'SIMULATED',
    detail:
      'Service exposure is described in the capability model only. There is no live OData endpoint, metadata document or business-service preview.',
  },
  {
    id: 'hana-pushdown',
    label: 'Real SAP HANA pushdown and CDS runtime',
    level: 'UNSUPPORTED',
    detail: 'Requires a licensed SAP HANA system and ABAP CDS runtime. This training workspace has neither.',
  },
  {
    id: 'rap-runtime',
    label: 'RAP runtime, drafts and business services',
    level: 'UNSUPPORTED',
    detail: 'Requires an ABAP Cloud / S/4HANA system with RAP, draft handling, authorization and OData services.',
  },
  {
    id: 'amdp-execution',
    label: 'AMDP / ADBC execution',
    level: 'UNSUPPORTED',
    detail: 'SQLScript and ADBC calls are never executed; only the ABAP source shape is validated.',
  },
  {
    id: 'dynpro',
    label: 'Dynpro, screen painter and GUI status',
    level: 'UNSUPPORTED',
    detail: 'The project reproduces the classic SAP GUI visually, but does not provide the Dynpro screen painter or SAP GUI generation.',
  },
  {
    id: 'transport',
    label: 'Transport management and live SAP authorizations',
    level: 'UNSUPPORTED',
    detail: 'No CTS, SAP user master, SAP roles or connection to a live SAP system is available.',
  },
]

export function isModernKind(value: unknown): value is ModernKind {
  return typeof value === 'string' && (MODERN_KINDS as string[]).includes(value)
}

export function capabilityFor(kind: ModernKind): {
  level: ModernLevel
  label: string
  detail: string
} {
  const capabilityId: Record<ModernKind, string> = {
    ABAP: 'abap-740',
    CDS: 'cds',
    RAP: 'rap',
    AMDP: 'amdp',
  }
  const capability =
    MODERN_CAPABILITIES.find((item) => item.id === capabilityId[kind]) ?? MODERN_CAPABILITIES[0]
  return {
    level: capability.level,
    label: capability.label,
    detail: capability.detail,
  }
}

// ── shared helpers ─────────────────────────────────────────────────────

export const SIMULATED_TABLES = new Set([
  'SCARR',
  'SPFLI',
  'SFLIGHT',
  'SBOOK',
  'MARA',
  'MAKT',
  'MARD',
  'VBAK',
  'VBAP',
  'KNA1',
  'LFA1',
  'BSEG',
  'T001',
  'T001W',
  'T005',
  'T006',
])

function lineAt(source: string, index: number): number {
  return source.slice(0, Math.max(0, index)).split('\n').length
}

function addIssue(
  issues: ModernIssue[],
  severity: 'E' | 'W' | 'I',
  line: number,
  message: string,
): void {
  issues.push({ severity, line, message })
}

function addAt(
  issues: ModernIssue[],
  source: string,
  index: number,
  severity: 'E' | 'W' | 'I',
  message: string,
): void {
  addIssue(issues, severity, lineAt(source, index), message)
}

function balancePair(
  source: string,
  open: string,
  close: string,
  label: string,
  issues: ModernIssue[],
): void {
  let depth = 0
  let inString = false
  let openIndex = -1
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (char === "'") {
      if (inString && source[i + 1] === "'") {
        i += 1
        continue
      }
      inString = !inString
      continue
    }
    if (inString) continue
    if (source.startsWith('//', i)) {
      const end = source.indexOf('\n', i)
      if (end === -1) break
      i = end
      continue
    }
    if (char === open) {
      if (depth === 0) openIndex = i
      depth += 1
    } else if (char === close) {
      depth -= 1
      if (depth < 0) {
        addAt(issues, source, i, 'E', `Unexpected ${close} in ${label}`)
        depth = 0
      }
    }
  }
  if (depth > 0 && openIndex >= 0) {
    addAt(issues, source, openIndex, 'E', `Unclosed ${open} in ${label}`)
  }
}

function finalize(
  kind: ModernKind,
  source: string,
  issues: ModernIssue[],
  summary: string,
  executable = false,
): ModernValidation {
  if (!source.trim()) {
    issues.push({ severity: 'E', line: 1, message: 'Definition is empty' })
  }
  const hasError = issues.some((issue) => issue.severity === 'E')
  return {
    kind,
    status: executable ? (hasError ? 'INVALID' : 'EXECUTABLE') : hasError ? 'INVALID' : 'VALID',
    summary: hasError ? 'Validation failed — fix the errors below.' : summary,
    issues,
  }
}

// ── CDS DDL ────────────────────────────────────────────────────────────

function validateCds(source: string): ModernValidation {
  const issues: ModernIssue[] = []
  const view = /define\s+view(?:\s+entity)?\s+([A-Za-z][A-Za-z0-9_]*)/i.exec(source)
  if (!view) {
    addIssue(issues, 'E', 1, 'Expected "define view entity <name> as select from <table> { ... }"')
  }
  const from = /as\s+select\s+from\s+([A-Za-z][A-Za-z0-9_.]*)/i.exec(source)
  if (!from) {
    addIssue(issues, 'E', 1, 'Missing "as select from <source>" clause')
  } else {
    const table = from[1].toUpperCase()
    if (!SIMULATED_TABLES.has(table) && !table.startsWith('Z')) {
      addAt(
        issues,
        source,
        from.index,
        'W',
        `Source ${from[1]} is not in the simulated DDIC; validation continues without resolving it`,
      )
    }
  }
  const bodyStart = source.indexOf('{')
  const bodyEnd = source.lastIndexOf('}')
  if (bodyStart === -1 || bodyEnd === -1 || bodyEnd < bodyStart) {
    addIssue(issues, 'E', 1, 'Missing the element-list braces { ... }')
  } else {
    const body = source.slice(bodyStart + 1, bodyEnd)
    const elements = body
      .split(',')
      .map((item) => item.replace(/\/\/.*$/gm, '').trim())
      .filter(Boolean)
    if (elements.length === 0) {
      addIssue(issues, 'E', lineAt(source, bodyStart), 'The element list is empty')
    }
    if (!/\bkey\b/i.test(body)) {
      addIssue(issues, 'W', lineAt(source, bodyStart), 'No key element is declared')
    }
    if (/\bassociation\b/i.test(body)) {
      addIssue(issues, 'I', lineAt(source, bodyStart), 'Associations are recognised but not resolved in this simulator')
    }
  }
  if (/;\s*$/.test(source)) {
    addIssue(
      issues,
      'W',
      lineAt(source, source.lastIndexOf(';')),
      'CDS DDL does not use a trailing semicolon; remove it',
    )
  }
  balancePair(source, '{', '}', 'CDS element list', issues)
  balancePair(source, '(', ')', 'CDS expressions', issues)
  return finalize(
    'CDS',
    source,
    issues,
    'CDS DDL validated against the simulated DDIC. No SQL is executed.',
  )
}

// ── RAP behavior definition ────────────────────────────────────────────

function validateRap(source: string): ModernValidation {
  const issues: ModernIssue[] = []
  const header = /(managed|unmanaged)\s+implementation\s+in\s+class\s+([A-Za-z][A-Za-z0-9_]*)\s+unique/i.exec(
    source,
  )
  if (!header) {
    addIssue(
      issues,
      'E',
      1,
      'Expected "managed|unmanaged implementation in class <class> unique;" at the start',
    )
  }
  const behavior = /define\s+behavior\s+for\s+([A-Za-z][A-Za-z0-9_]*)(?:\s+alias\s+([A-Za-z][A-Za-z0-9_]*))?/i.exec(
    source,
  )
  if (!behavior) {
    addIssue(issues, 'E', 1, 'Missing "define behavior for <entity> alias <alias>"')
  }
  const persistent = /persistent\s+table\s+([A-Za-z][A-Za-z0-9_]*)/i.exec(source)
  if (!persistent) {
    if (header?.[1].toLowerCase() === 'managed') {
      addIssue(issues, 'E', 1, 'A managed behavior definition must declare "persistent table <table>"')
    } else {
      addIssue(issues, 'W', 1, 'No persistent table is declared')
    }
  } else {
    const table = persistent[1].toUpperCase()
    if (!SIMULATED_TABLES.has(table) && !table.startsWith('Z')) {
      addAt(
        issues,
        source,
        persistent.index,
        'W',
        `Persistent table ${persistent[1]} is not in the simulated DDIC; validation continues without resolving it`,
      )
    }
  }
  const bodyStart = source.indexOf('{')
  const bodyEnd = source.lastIndexOf('}')
  if (bodyStart === -1 || bodyEnd === -1 || bodyEnd < bodyStart) {
    addIssue(issues, 'E', 1, 'Missing the behavior body { ... }')
  } else {
    const body = source.slice(bodyStart + 1, bodyEnd)
    if (!/\b(create|update|delete|read|action|determine|validation)\b/i.test(body)) {
      addIssue(issues, 'E', lineAt(source, bodyStart), 'The behavior body declares no operations')
    }
    if (/\bdraft\b/i.test(body)) {
      addIssue(issues, 'W', lineAt(source, bodyStart), 'Draft handling is not simulated')
    }
  }
  balancePair(source, '{', '}', 'RAP behavior body', issues)
  return finalize(
    'RAP',
    source,
    issues,
    'Behavior definition validated. RAP runtime, drafts and OData services are not executed.',
  )
}

// ── AMDP class ─────────────────────────────────────────────────────────

function validateAmdp(source: string): ModernValidation {
  const issues: ModernIssue[] = []
  const definition = /class\s+([A-Za-z][A-Za-z0-9_]*)\s+definition/i.exec(source)
  const implementation = /class\s+([A-Za-z][A-Za-z0-9_]*)\s+implementation/i.exec(source)
  if (!definition) addIssue(issues, 'E', 1, 'Missing "CLASS <name> DEFINITION"')
  if (!implementation) addIssue(issues, 'E', 1, 'Missing "CLASS <name> IMPLEMENTATION"')
  if (definition && implementation && definition[1].toLowerCase() !== implementation[1].toLowerCase()) {
    addIssue(issues, 'E', lineAt(source, implementation.index), 'Definition and implementation class names differ')
  }
  if (!/interfaces\s+if_amdp_marker_hdb/i.test(source)) {
    addIssue(issues, 'E', 1, 'Missing marker interface "INTERFACES if_amdp_marker_hdb"')
  }
  if (!/by\s+database\s+(procedure|function)\s+for\s+hdb\s+language\s+sqlscript/i.test(source)) {
    addIssue(
      issues,
      'E',
      1,
      'Missing "BY DATABASE PROCEDURE|FUNCTION FOR HDB LANGUAGE SQLSCRIPT"',
    )
  }
  if (!/method\s+[A-Za-z][A-Za-z0-9_]*\s+by\s+database/i.test(source)) {
    addIssue(issues, 'E', 1, 'Missing an AMDP method with a BY DATABASE clause')
  }
  const methodOpen = (source.match(/\bmethod\b/gi) ?? []).length
  const methodClose = (source.match(/\bendmethod\b/gi) ?? []).length
  if (methodOpen !== methodClose) {
    addIssue(issues, 'E', 1, 'METHOD and ENDMETHOD counts do not match')
  }
  const classOpen = (source.match(/\bclass\s+[A-Za-z][A-Za-z0-9_]*\s+(definition|implementation)\b/gi) ?? []).length
  const classClose = (source.match(/\bendclass\b/gi) ?? []).length
  if (classOpen !== classClose) {
    addIssue(issues, 'E', 1, 'CLASS and ENDCLASS counts do not match')
  }
  if (!/\bselect\b/i.test(source)) {
    addIssue(issues, 'W', 1, 'No SQL SELECT statement was found in the AMDP body')
  }
  balancePair(source, '(', ')', 'AMDP signature/body', issues)
  addIssue(issues, 'I', 1, 'SQLScript is captured for learning only and is never executed')
  return finalize(
    'AMDP',
    source,
    issues,
    'AMDP signature and SQLScript body captured. SQLScript is not executed.',
  )
}

// ── public entry point ─────────────────────────────────────────────────

export function validateModernSource(kind: ModernKind, source: string): ModernValidation {
  if (kind === 'CDS') return validateCds(source)
  if (kind === 'RAP') return validateRap(source)
  if (kind === 'AMDP') return validateAmdp(source)
  const issues: ModernIssue[] = source.trim()
    ? []
    : [{ severity: 'E', line: 1, message: 'Source is empty' }]
  return {
    kind: 'ABAP',
    status: issues.length ? 'INVALID' : 'EXECUTABLE',
    summary: issues.length
      ? 'Validation failed — the source is empty.'
      : 'Executable by the local ABAP engine. Use Check and Execute in the editor.',
    issues,
  }
}
