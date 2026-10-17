// Debug REDUCE by monkey-patching
import { Interpreter } from '../src/lib/abap/interpreter'
import { runAbap, DbSnapshot } from '../src/lib/abap/index'

const db = new DbSnapshot()

const orig = (Interpreter.prototype as any).evalReduce
;(Interpreter.prototype as any).evalReduce = function (e: any, scope: any) {
  console.log('--- evalReduce called ---')
  console.log('  forOf:', JSON.stringify(e.forOf))
  console.log('  init:', JSON.stringify(e.init))
  console.log('  next:', JSON.stringify(e.next))
  console.log('  while:', JSON.stringify(e.while))
  console.log('  forNum:', JSON.stringify(e.forNum))
  const r = orig.call(this, e, scope)
  console.log('  → returned:', JSON.stringify(r))
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
