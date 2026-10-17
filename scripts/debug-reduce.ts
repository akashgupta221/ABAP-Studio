// Debug REDUCE AST
import { parseAbap } from '../src/lib/abap/parser'

const src = `REPORT X.
DATA lv TYPE i.
lv = REDUCE #( INIT s = 0 FOR n IN lt NEXT s = s + n ).`
try {
  const p = parseAbap(src)
  console.log(JSON.stringify((p as any).defaultEvent, null, 1).slice(0, 2000))
} catch (e: any) { console.log('parse fail', e.message) }

const src2 = `REPORT X.
DATA lv TYPE i.
lv = REDUCE #( INIT t = 0 FOR ls IN lt_prices NEXT t = t + ls-price ).`
try {
  const p2 = parseAbap(src2)
  console.log('---- struct variant ----')
  console.log(JSON.stringify((p2 as any).defaultEvent, null, 1).slice(0, 2200))
} catch (e: any) { console.log('parse fail', e.message) }
