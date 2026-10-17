// Debug REDUCE inner evalExpr
import { Interpreter } from '../src/lib/abap/interpreter'
import { runAbap, DbSnapshot } from '../src/lib/abap/index'

const db = new DbSnapshot()

const orig = (Interpreter.prototype as any).evalExpr
let inReduce = false
;(Interpreter.prototype as any).evalExpr = function (e: any, scope: any, rowCtx?: any, sqlCtx?: any) {
  const isReduce = e?.t === 'reduce'
  if (isReduce) inReduce = true
  if (inReduce && e?.t === 'var' && e.name === 'S') {
    const entry = scope.lookup ? scope.lookup('S') : undefined
    console.log(`  [var S] entry=`, JSON.stringify(entry), 'scopeKind=', scope?.kind)
  }
  if (inReduce && e?.t === 'binop') console.log('  [binop]', e.op)
  try {
    return orig.call(this, e, scope, rowCtx, sqlCtx)
  } finally {
    if (isReduce) inReduce = false
  }
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
