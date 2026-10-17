// ── ABAP Engine: Tokenizer ────────────────────────────────────────────
// Tokenizes ABAP source: case-insensitive keywords, 'string' literals,
// |string templates|, "comments", * full-line comments, statement periods.

export type TokType = 'IDENT' | 'NUMBER' | 'STRING' | 'TEMPLATE' | 'PUNCT'

export interface Token {
  type: TokType
  value: string // raw value (identifiers keep original case)
  upper: string // uppercase of value for keyword matching
  line: number // 1-based
  col: number // 1-based
}

export class AbapSyntaxError extends Error {
  line: number
  statement: string
  constructor(message: string, line: number, statement = '') {
    super(message)
    this.name = 'AbapSyntaxError'
    this.line = line
    this.statement = statement
  }
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  let line = 1
  let col = 1
  const n = source.length

  const push = (type: TokType, value: string, l: number, c: number) => {
    tokens.push({ type, value, upper: value.toUpperCase(), line: l, col: c })
  }

  const adv = (count = 1) => {
    for (let k = 0; k < count; k++) {
      if (source[i] === '\n') {
        line++
        col = 1
      } else col++
      i++
    }
  }

  while (i < n) {
    const ch = source[i]
    // whitespace
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      adv()
      continue
    }
    // full-line comment: * at first column of a line
    if (ch === '*' && col === 1) {
      while (i < n && source[i] !== '\n') adv()
      continue
    }
    // inline comment
    if (ch === '"') {
      while (i < n && source[i] !== '\n') adv()
      continue
    }
    // string literal with '' escape (trailing blanks are significant in ABAP)
    if (ch === "'") {
      const l = line
      const c = col
      let s = ''
      adv()
      while (i < n) {
        if (source[i] === "'") {
          if (source[i + 1] === "'") {
            s += "'"
            adv(2)
          } else {
            adv()
            break
          }
        } else {
          s += source[i]
          adv()
        }
      }
      push('STRING', s, l, c)
      continue
    }
    // string template |...| with {expr} embeds captured raw, escapes \n etc.
    if (ch === '|') {
      const l = line
      const c = col
      let s = ''
      adv()
      let depth = 0
      while (i < n) {
        const t = source[i]
        if (depth === 0 && t === '|') {
          adv()
          break
        }
        if (t === '\\') {
          const nx = source[i + 1]
          if (nx === 'n') s += '\n'
          else if (nx === 't') s += '\t'
          else if (nx === '\\') s += '\\'
          else if (nx === '|') s += '|'
          else if (nx === '{') s += '{'
          else if (nx === '}') s += '}'
          else s += nx ?? ''
          adv(2)
          continue
        }
        if (t === '{') depth++
        if (t === '}') depth--
        s += t
        adv()
      }
      push('TEMPLATE', s, l, c)
      continue
    }
    // number: digits with optional .digits (only if digit follows) and exponent
    if (/[0-9]/.test(ch)) {
      const l = line
      const c = col
      let s = ''
      while (i < n && /[0-9]/.test(source[i])) {
        s += source[i]
        adv()
      }
      if (source[i] === '.' && /[0-9]/.test(source[i + 1] ?? '')) {
        s += '.'
        adv()
        while (i < n && /[0-9]/.test(source[i])) {
          s += source[i]
          adv()
        }
      }
      if (source[i] === 'e' || source[i] === 'E') {
        let j = i + 1
        let exp = 'e'
        if (source[j] === '+' || source[j] === '-') {
          exp += source[j]
          j++
        }
        if (/[0-9]/.test(source[j] ?? '')) {
          while (j < n && /[0-9]/.test(source[j])) {
            exp += source[j]
            j++
          }
          s += exp
          adv(j - i)
        }
      }
      push('NUMBER', s, l, c)
      continue
    }
    // identifiers — '/' only starts an identifier for namespaces like /SAP/PROG (next char must be an ident char)
    if (/[A-Za-z_%$#]/.test(ch) || (ch === '/' && i + 1 < n && /[A-Za-z0-9_]/.test(source[i + 1]))) {
      const l = line
      const c = col
      let s = ''
      while (i < n && /[A-Za-z0-9_\/%$#]/.test(source[i])) {
        s += source[i]
        adv()
      }
      push('IDENT', s, l, c)
      continue
    }
    // multi-char operators
    const two = source.substring(i, i + 2)
    if (two === '->' && source[i + 2] === '*') {
      push('PUNCT', '->*', line, col)
      adv(3)
      continue
    }
    if (['->', '=>', '<>', '<=', '>=', '**', '&&', '?='].includes(two)) {
      push('PUNCT', two, line, col)
      adv(2)
      continue
    }
    if (['.', ',', ':', '(', ')', '[', ']', '=', '+', '-', '*', '/', '<', '>', '?', '@', '&', ';', '~'].includes(ch)) {
      push('PUNCT', ch, line, col)
      adv()
      continue
    }
    // unknown char — skip (defensive)
    adv()
  }
  return tokens
}
