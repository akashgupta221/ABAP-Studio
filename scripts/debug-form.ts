// Debug FORM param binding
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

run('C1_ADD', `
REPORT C1.
DATA: gv_a TYPE i VALUE 10,
      gv_b TYPE i VALUE 3,
      gv_r TYPE i.
PERFORM addit USING gv_a gv_b CHANGING gv_r.
WRITE: / |Sum: { gv_r }|.
FORM addit USING p_a TYPE i p_b TYPE i CHANGING p_c TYPE i.
  p_c = p_a + p_b.
ENDFORM.
`)

run('C2_MUL', `
REPORT C2.
DATA: gv_a TYPE i VALUE 10,
      gv_b TYPE i VALUE 3,
      gv_r TYPE i.
PERFORM mult USING gv_a gv_b CHANGING gv_r.
WRITE: / |Product: { gv_r }|.
FORM mult USING p_a TYPE i p_b TYPE i CHANGING p_c TYPE i.
  p_c = p_a * p_b.
ENDFORM.
`)

run('C3_SHOW', `
REPORT C3.
DATA: gv_a TYPE i VALUE 10,
      gv_b TYPE i VALUE 3.
PERFORM show USING gv_a gv_b.
FORM show USING p_a TYPE i p_b TYPE i.
  WRITE: / |p_a={ p_a } p_b={ p_b }|.
ENDFORM.
`)
