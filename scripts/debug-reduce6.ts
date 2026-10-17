// Debug REDUCE inner evalExpr with results
import { Interpreter } from '../src/lib/abap/interpreter'
import { runAbap, DbSnapshot } from '../src/lib/abap/index'

const db = new DbSnapshot()

const orig = (Interpreter.prototype as any).evalExpr
let depth = 0
;(Interpreter.prototype as any).evalExpr = function (e: any, scope: any, rowCtx?: any, sqlCtx?: any) {
  const watch = e?.t === 'var' && (e.name === 'S' || e.name === 'N')
  let r: any
  try {
    r = orig.call(this, e, scope, rowCtx, sqlCtx)
    return r
  } finally {
    if (watch && depth < 50) {
      depth++
      console.log(`  [eval var ${e.name}] →`, JSON.stringify(r))
    }
  }
}

const origBin = (Interpreter.prototype as any).evalBinop
;(Interpreter.prototype as any).evalBinop = function (e: any, scope: any, rowCtx?: any, sqlCtx?: any) {
  const r = origBin.call(this, e, scope, rowCtx, sqlCtx)
  if (e?.op === '+' && depth < 50) {
    depth++
    console.log(`  [binop ${e.op}] →`, JSON.stringify(r))
  }
  return r
}

const src = `
REPORT B1.
TYPES ty_i TYPE STANDARD TABLE OF i WITH EMPTY KEY.
DATA(lt) = VALUE ty_i( ( 1 ) ( 2 ) ( 3 ) ).
DATA(lv) = REDUCE #( INIT s = 100 FOR n IN lt NEXT s = s + 1 ).
WRITE: / |lv = { lv }|.
`
const result = runAbap({ source: src, repid: 'B1', db })
console.log(result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n'))
