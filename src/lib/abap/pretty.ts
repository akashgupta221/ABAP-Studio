// ── ABAP Pretty Printer (Shift+F1) ─────────────────────────────────────
// Adapted from App 2's pretty printer: upper-cases statement keywords
// outside string literals and re-indents block structures with two spaces
// per nesting level. Pure text transformation — safe on any source.

const OPENERS = new Set([
  'IF', 'DO', 'WHILE', 'FORM', 'CASE', 'LOOP', 'FUNCTION', 'MODULE', 'AT', 'TRY',
  'METHOD', 'CLASS', 'INTERFACE',
])
const CLOSERS = new Set([
  'ENDIF', 'ENDDO', 'ENDWHILE', 'ENDFORM', 'ENDCASE', 'ENDLOOP', 'ENDFUNCTION',
  'ENDMODULE', 'ENDTRY', 'ENDAT', 'ENDMETHOD', 'ENDCLASS', 'ENDINTERFACE',
])
const MIDLINERS = new Set(['ELSE', 'ELSEIF', 'WHEN', 'CATCH', 'CLEANUP'])

const KEYWORDS_UPPER = new Set([
  'REPORT', 'PROGRAM', 'INCLUDE', 'DATA', 'TYPES', 'CONSTANTS', 'PARAMETERS',
  'TABLES', 'WRITE', 'ULINE', 'SKIP', 'NEW-LINE', 'POSITION', 'MOVE', 'CLEAR',
  'FREE', 'ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE', 'COMPUTE', 'IF', 'ELSEIF',
  'ELSE', 'ENDIF', 'CASE', 'WHEN', 'ENDCASE', 'DO', 'ENDDO', 'WHILE', 'ENDWHILE',
  'LOOP', 'ENDLOOP', 'EXIT', 'CONTINUE', 'CHECK', 'RETURN', 'FORM', 'ENDFORM',
  'PERFORM', 'USING', 'CHANGING', 'CONCATENATE', 'INTO', 'SEPARATED', 'BY',
  'TYPE', 'LIKE', 'VALUE', 'DEFAULT', 'TIMES', 'TO', 'FROM', 'MESSAGE',
  'START-OF-SELECTION', 'END-OF-SELECTION', 'FUNCTION', 'ENDFUNCTION', 'RAISE',
  'CALL', 'EXPORTING', 'IMPORTING', 'CHANGING', 'EXCEPTIONS', 'RECEIVING',
  'METHOD', 'ENDMETHOD', 'CLASS', 'ENDCLASS', 'INTERFACE', 'ENDINTERFACE',
  'PUBLIC', 'PROTECTED', 'PRIVATE', 'SECTION', 'METHODS', 'CLASS-METHODS',
  'SELECT', 'ENDSELECT', 'FROM', 'WHERE', 'ORDER', 'APPEND', 'SORT', 'READ',
  'TABLE', 'DELETE', 'MODIFY', 'UPDATE', 'INSERT', 'FIELD-SYMBOLS', 'ASSIGN',
  'UNASSIGN', 'TRY', 'CATCH', 'CLEANUP', 'ENDTRY', 'CREATE', 'OBJECT', 'WHEN',
  'OTHERS', 'COND', 'SWITCH', 'REDUCE', 'INITIALIZATION', 'AT', 'SELECTION-SCREEN',
])

function isCommentOrBlank(line: string): boolean {
  const t = line.trim()
  return t === '' || t.startsWith('*') || t.startsWith('"')
}

function stripQuotes(line: string): string {
  // remove quoted literals so keyword detection is safe
  return line.replace(/'[^']*'/g, "''")
}

function uppercaseKeywords(line: string): string {
  // split preserving string literals
  const parts = line.split(/('[^']*')/g)
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part // inside a literal
      return part.replace(/\b[a-zA-Z][a-zA-Z0-9_-]*\b/g, (w) => {
        const up = w.toUpperCase()
        return KEYWORDS_UPPER.has(up) ? up : w
      })
    })
    .join('')
}

export function prettyPrintAbap(source: string): string {
  const lines = source.split('\n')
  const out: string[] = []
  let indent = 0

  for (const raw of lines) {
    if (isCommentOrBlank(raw)) {
      out.push(raw.trimEnd())
      continue
    }

    const bare = stripQuotes(raw)
    const firstWord = (bare.trim().match(/^[A-Za-z][A-Za-z0-9_-]*/)?.[0] ?? '').toUpperCase()

    let line = raw.trimEnd()

    // closing blocks first
    if (CLOSERS.has(firstWord)) indent = Math.max(0, indent - 1)
    // midliners (ELSE, WHEN, CATCH) sit one level less than the block body
    // without ending it, so the following lines return to the block indent
    const emitIndent = MIDLINERS.has(firstWord) ? Math.max(0, indent - 1) : indent

    // uppercase known keywords (outside string literals)
    line = uppercaseKeywords(line)

    out.push('  '.repeat(emitIndent) + line.trimStart())

    // opening blocks after
    if (OPENERS.has(firstWord)) indent++
  }

  return out.join('\n')
}
