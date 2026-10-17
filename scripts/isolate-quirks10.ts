// Isolate part 10: debug REDUCE forOf crash + FORM local DATA
import { runAbap, DbSnapshot } from '../src/lib/abap/index'
import { parseAbap } from '../src/lib/abap/parser'

const db = new DbSnapshot()

function run(name: string, source: string, opts?: any) {
  try {
    const result = runAbap({ source, repid: name, db, ...opts })
    const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
    if (result.status === 'ERROR') console.log(`✗ ${name} — ${result.error?.kind} ${result.error?.message}`)
    else console.log(`✓ ${name} [${result.status}] :: ${JSON.stringify(text.slice(0, 250))}`)
  } catch (e: any) {
    console.log(`✗ ${name} — THREW ${e.message}\n${e.stack?.split('\n').slice(0, 6).join('\n')}`)
  }
}

// Z1: REDUCE forOf with ints only
run('Z1_RED_INT', `
REPORT Z1.
TYPES ty_i TYPE STANDARD TABLE OF i WITH EMPTY KEY.
DATA lt TYPE ty_i.
APPEND 1 TO lt. APPEND 2 TO lt. APPEND 3 TO lt.
DATA(lv_sum) = REDUCE #( INIT s = 0 FOR n IN lt NEXT s = s + n ).
WRITE: / |Sum: { lv_sum }|.
`)

// Z2: FORM without local DATA
run('Z2_FORM_PLAIN', `
REPORT Z2.
DATA: gv_a TYPE i VALUE 10,
      gv_b TYPE i VALUE 3,
      gv_r TYPE i.
PERFORM compute USING gv_a gv_b CHANGING gv_r.
WRITE: / |Result: { gv_r }|.
FORM compute USING p_a TYPE i p_b TYPE i CHANGING p_c TYPE i.
  p_c = p_a * p_b + 5.
ENDFORM.
`)

// Z3: FORM with local DATA
run('Z3_FORM_LOCAL', `
REPORT Z3.
DATA: gv_a TYPE i VALUE 10,
      gv_b TYPE i VALUE 3,
      gv_r TYPE i.
PERFORM compute USING gv_a gv_b CHANGING gv_r.
WRITE: / |Result: { gv_r }|.
FORM compute USING p_a TYPE i p_b TYPE i CHANGING p_c TYPE i.
  DATA lv_tmp TYPE i.
  lv_tmp = p_a * p_b.
  p_c = lv_tmp + 5.
ENDFORM.
`)

// Z4: FORM local DATA declared BEFORE params usage — order
run('Z4_FORM_LOCAL2', `
REPORT Z4.
DATA gv_r TYPE i.
PERFORM compute CHANGING gv_r.
WRITE: / |Result: { gv_r }|.
FORM compute CHANGING p_c TYPE i.
  DATA lv_tmp TYPE i VALUE 99.
  p_c = lv_tmp.
ENDFORM.
`)

// Z5: check parse of Z3 form
try {
  const p = parseAbap(`REPORT X.
FORM compute USING p_a TYPE i p_b TYPE i CHANGING p_c TYPE i.
  DATA lv_tmp TYPE i.
  lv_tmp = p_a * p_b.
  p_c = lv_tmp + 5.
ENDFORM.`)
  const f = p.forms.get('COMPUTE')
  console.log('Z5 form params:', JSON.stringify(f?.params), 'body:', JSON.stringify(f?.body.map((s: any) => s.t)))
} catch (e: any) { console.log('Z5 parse fail', e.message) }
