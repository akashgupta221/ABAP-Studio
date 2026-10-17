// Debug REDUCE iteration count
import { runAbap, DbSnapshot } from '../src/lib/abap/index'

const db = new DbSnapshot()

function run(name: string, source: string) {
  try {
    const result = runAbap({ source, repid: name, db })
    const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
    if (result.status === 'ERROR') console.log(`✗ ${name} — ${result.error?.kind} ${result.error?.message}`)
    else console.log(`✓ ${name} :: ${JSON.stringify(text.slice(0, 200))}`)
  } catch (e: any) {
    console.log(`✗ ${name} — THREW ${e.message}`)
  }
}

run('B1', `
REPORT B1.
TYPES ty_i TYPE STANDARD TABLE OF i WITH EMPTY KEY.
DATA(lt) = VALUE ty_i( ( 1 ) ( 2 ) ( 3 ) ).
DATA(lv) = REDUCE #( INIT s = 100 FOR n IN lt NEXT s = s + 1 ).
WRITE: / |lv = { lv }|.
`)

run('B2', `
REPORT B2.
TYPES ty_i TYPE STANDARD TABLE OF i WITH EMPTY KEY.
DATA(lt) = VALUE ty_i( ( 1 ) ( 2 ) ( 3 ) ).
DATA lv TYPE i.
lv = REDUCE #( INIT s = 0 FOR n IN lt NEXT s = s + n ).
WRITE: / |lv = { lv }|.
`)

run('B3', `
REPORT B3.
TYPES: BEGIN OF ty_p,
         price TYPE p DECIMALS 2,
       END OF ty_p.
TYPES ty_p_t TYPE STANDARD TABLE OF ty_p WITH EMPTY KEY.
DATA(lt) = VALUE ty_p_t( ( price = '100.00' ) ( price = '200.00' ) ).
DATA lv TYPE i.
lv = REDUCE #( INIT t = 0 FOR ls IN lt NEXT t = t + 1 ).
WRITE: / |lv = { lv }|.
`)

run('B4', `
REPORT B4.
TYPES: BEGIN OF ty_p,
         price TYPE p DECIMALS 2,
       END OF ty_p.
TYPES ty_p_t TYPE STANDARD TABLE OF ty_p WITH EMPTY KEY.
DATA(lt) = VALUE ty_p_t( ( price = '100.00' ) ( price = '200.00' ) ).
DATA lv TYPE i.
DATA ls2 TYPE ty_p.
LOOP AT lt INTO ls2.
  lv = lv + 1.
ENDLOOP.
WRITE: / |manual loop count: { lv }|.
`)
