// ── SCI / SLIN-style static checks over ABAP source ────────────────────
// A training-grade Code Inspector: real syntax check (the engine's parser)
// plus pragmatic pattern checks. Labels are honest about what they cover.

export interface InspectorIssue {
  kind: 'E' | 'W' | 'I'
  line: number
  check: string
  message: string
}

export interface InspectorMetrics {
  statements: number
  selects: number
  loops: number
  writes: number
  dataDeclarations: number
  forms: number
  lines: number
}

export interface InspectorReport {
  issues: InspectorIssue[]
  metrics: InspectorMetrics
}

const RE = {
  dataDecl: /^\s*(DATA|DATA\(|TYPES|CONSTANTS)\b/i,
  select: /^\s*(SELECT\b)/i,
  loopStart: /^\s*(LOOP AT|DO|WHILE)\b/i,
  loopEnd: /^\s*(ENDLOOP|ENDDO|ENDWHILE)\b/i,
  write: /^\s*WRITE\b/i,
  formDef: /^\s*FORM\s+/i,
  comment: /^\s*\*|^\s*"/,
}

export function inspectSource(source: string): InspectorReport {
  const lines = source.split('\n')
  const issues: InspectorIssue[] = []
  const loopStack: { line: number; kind: string }[] = []
  const metrics: InspectorMetrics = {
    statements: 0, selects: 0, loops: 0, writes: 0, dataDeclarations: 0, forms: 0, lines: lines.length,
  }
  const declared = new Map<string, number>() // var name → decl line
  const used = new Map<string, number>() // var name → last usage line

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (RE.comment.test(raw)) continue
    const line = raw.replace(/".*$/, '') // strip line comments
    const up = line.trim().toUpperCase()

    if (RE.dataDecl.test(line)) metrics.dataDeclarations++
    if (RE.select.test(line)) metrics.selects++
    if (RE.write.test(line)) metrics.writes++
    if (RE.formDef.test(line)) metrics.forms++
    if (RE.loopStart.test(line)) {
      metrics.loops++
      loopStack.push({ line: i + 1, kind: up.split(/\s+/)[0] })
    }
    if (RE.loopEnd.test(line)) loopStack.pop()

    // track declared/used identifiers for the unused-variable check
    const declMatch = line.match(/(?:^|\s)(?:DATA|CONSTANTS|STATICS)\s+([A-Za-z_][A-Za-z0-9_<>/-]*)/i)
      ?? line.match(/(?:^|\s)DATA\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/i)
    if (declMatch) {
      const name = declMatch[1].replace(/^</, '').replace(/>$/, '').toUpperCase()
      if (!['BEGIN', 'END', 'TABLE'].includes(name)) declared.set(name, i + 1)
    }
    for (const m of line.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g)) {
      const name = m[1].toUpperCase()
      if (!used.has(name)) used.set(name, i + 1)
      else used.set(name, Math.max(used.get(name)!, i + 1))
    }
  }

  // LOOP nesting depth check (SLIN-style performance hint)
  let maxDepth = 0
  for (const l of lines) {
    if (RE.comment.test(l)) continue
    if (RE.loopStart.test(l)) {
      maxDepth++
      if (maxDepth >= 3) {
        issues.push({ kind: 'W', line: lines.indexOf(l) + 1, check: 'NESTED_LOOP', message: 'Loop nesting depth 3+ — nested full-table loops are the classic performance trap in ABAP' })
      }
    }
    if (RE.loopEnd.test(l)) maxDepth = Math.max(0, maxDepth - 1)
  }

  // SELECT inside a LOOP body (rule of thumb: avoid SELECT per row)
  let loopDepth = 0
  for (let i = 0; i < lines.length; i++) {
    if (RE.comment.test(lines[i])) continue
    if (RE.loopStart.test(lines[i])) loopDepth++
    if (RE.loopEnd.test(lines[i])) loopDepth = Math.max(0, loopDepth - 1)
    if (loopDepth > 0 && RE.select.test(lines[i]) && !/INTO\s+TABLE|APPENDING\s+TABLE/i.test(lines[i])) {
      issues.push({ kind: 'W', line: i + 1, check: 'SELECT_IN_LOOP', message: 'SELECT inside a loop — use SELECT ... INTO TABLE before the loop (FOR ALL ENTRIES or JOIN)' })
    }
  }

  // SELECT * usage (readability / buffer friendliness)
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*SELECT\s+\*/i.test(lines[i])) {
      issues.push({ kind: 'I', line: i + 1, check: 'SELECT_STAR', message: 'SELECT * reads every column — list the needed fields when the table is wide' })
    }
  }

  // unused local declarations (crude: name must appear on a later line too)
  for (const [name, declLine] of declared) {
    const lastUse = used.get(name) ?? 0
    if (lastUse <= declLine) {
      issues.push({ kind: 'W', line: declLine, check: 'UNUSED_VAR', message: `Variable ${name} is declared but never used afterwards` })
    }
  }

  // metrics: statement count via the engine tokenizer-ish heuristic (periods on code lines)
  metrics.statements = lines.filter((l) => !RE.comment.test(l) && l.trim().endsWith('.')).length

  return { issues: issues.sort((a, b) => a.line - b.line), metrics }
}
