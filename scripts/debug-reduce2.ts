// Debug REDUCE runtime behavior step by step
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

// A1: int table via VALUE, REDUCE with t+1
run('A1', `
REPORT A1.
TYPES ty_i TYPE STANDARD TABLE OF i WITH EMPTY KEY.
DATA(lt) = VALUE ty_i( ( 1 ) ( 2 ) ( 3 ) ).
WRITE: / |rows: { lines( lt ) }|.
DATA(lv) = REDUCE #( INIT s = 0 FOR n IN lt NEXT s = s + 1 ).
WRITE: / |count: { lv }|.
`)

// A2: REDUCE with row struct via VALUE
run('A2', `
REPORT A2.
TYPES: BEGIN OF ty_p,
         price TYPE p DECIMALS 2,
       END OF ty_p.
TYPES ty_p_t TYPE STANDARD TABLE OF ty_p WITH EMPTY KEY.
DATA(lt) = VALUE ty_p_t( ( price = '100.00' ) ( price = '200.00' ) ).
DATA(lv) = REDUCE #( INIT t = 0 FOR ls IN lt NEXT t = t + 1 ).
WRITE: / |count: { lv }|.
`)

// A3: REDUCE referencing ls-price
run('A3', `
REPORT A3.
TYPES: BEGIN OF ty_p,
         price TYPE p DECIMALS 2,
       END OF ty_p.
TYPES ty_p_t TYPE STANDARD TABLE OF ty_p WITH EMPTY KEY.
DATA(lt) = VALUE ty_p_t( ( price = '100.00' ) ( price = '200.00' ) ).
DATA(lv) = REDUCE #( INIT t = 0 FOR ls IN lt NEXT t = t + ls-price ).
WRITE: / |total: { lv }|.
`)

// A4: REDUCE forOf over SELECT result
run('A4', `
REPORT A4.
DATA lt TYPE STANDARD TABLE OF sflight.
lt = VALUE #( FOR ls IN lt ).
`)

// A5: WHERE in REDUCE forOf with row context field
run('A5', `
REPORT A5.
TYPES: BEGIN OF ty_p,
         price TYPE p DECIMALS 2,
       END OF ty_p.
TYPES ty_p_t TYPE STANDARD TABLE OF ty_p WITH EMPTY KEY.
DATA(lt) = VALUE ty_p_t( ( price = '100.00' ) ( price = '200.00' ) ( price = '50.00' ) ).
DATA(lv) = REDUCE #( INIT t = 0 FOR ls IN lt WHERE ls-price > 60 NEXT t = t + ls-price ).
WRITE: / |total>60: { lv }|.
`)
