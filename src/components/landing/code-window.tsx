'use client'

// Hero visual — a faithful miniature of the SE38 editor experience with
// hand-coloured ABAP tokens (no runtime highlighter needed on the landing
// page) plus floating workbench capability chips.

import { Bug, CheckCircle2, Printer } from 'lucide-react'

type Tok = readonly [text: string, cls: string]

const K = 'text-[#0a4d8c] font-semibold' // ABAP keywords
const T = 'text-[#7a3fa8]' // types
const S = 'text-[#1c7a1c]' // strings / symbols
const N = 'text-[#b0600b]' // numbers
const C = 'text-[#5b6d80] italic' // comments
const P = 'text-[#16283b]' // plain

const LINES: readonly (readonly Tok[])[] = [
  [['REPORT', K], [' zflight_overview', P]],
  [['PARAMETERS:', K], [' p_carr ', P], ['TYPE', K], [' sflight-carrid', T], [' DEFAULT', K], [" 'AA'", S], ['.', P]],
  [],
  [['START-OF-SELECTION', K], ['.', P]],
  [['  SELECT', K], [' carrid, connid, fldate, price', P]],
  [['    FROM', K], [' sflight', T]],
  [['    INTO TABLE', K], [' @', P], ['DATA', K], ['(flights)', P]],
  [['    WHERE', K], [' carrid ', P], ['=', K], [' @p_carr', P], ['.', P]],
  [],
  [['  LOOP AT', K], [' flights ', P], ['INTO', K], [' @', P], ['DATA', K], ['(flight)', P], ['.', P]],
  [['    WRITE: /', K], [' flight-carrid, flight-connid,', P]],
  [['             flight-fldate, flight-price', P]],
  [['  ENDLOOP', K], ['.', P]],
]

export function CodeWindow() {
  return (
    <div className="relative" aria-hidden>
      {/* floating capability chips (desktop only) */}
      <div className="lp-float absolute -right-3 -top-5 z-10 hidden items-center gap-2 rounded-lg border border-[#d5e4f2] bg-white px-3 py-2 shadow-lg shadow-[#0b2b52]/25 sm:flex">
        <CheckCircle2 className="h-4 w-4 text-[#1c7a1c]" />
        <span className="text-[12px] font-medium text-[#16283b]">Syntax check passed</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#5b6d80]">Ctrl+F2</span>
      </div>
      <div className="lp-float-slow absolute -left-4 top-1/3 z-10 hidden items-center gap-2 rounded-lg border border-[#d5e4f2] bg-white px-3 py-2 shadow-lg shadow-[#0b2b52]/25 sm:flex">
        <Bug className="h-4 w-4 text-[#0a6ed1]" />
        <span className="text-[12px] font-medium text-[#16283b]">Debugger</span>
        <span className="rounded bg-[#e8f1fa] px-1.5 py-0.5 font-mono text-[10px] text-[#0a4d8c]">/h</span>
      </div>
      <div
        className="lp-float absolute -bottom-5 right-8 z-10 hidden items-center gap-2 rounded-lg border border-[#d5e4f2] bg-white px-3 py-2 shadow-lg shadow-[#0b2b52]/25 sm:flex"
        style={{ animationDelay: '1.2s' }}
      >
        <Printer className="h-4 w-4 text-[#0a6ed1]" />
        <span className="text-[12px] font-medium text-[#16283b]">Pretty Printer</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#5b6d80]">Shift+F1</span>
      </div>

      {/* editor window */}
      <div className="overflow-hidden rounded-2xl border border-[#c9d4e0] bg-white shadow-2xl shadow-[#041627]/50">
        {/* window title with file tab */}
        <div className="flex items-center gap-3 border-b border-[#e1e9f1] bg-[#f4f7fa] px-4 py-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0a6ed1] font-mono text-[11px] font-bold text-white">
            38
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[11px] font-semibold tracking-wide text-[#16283b]">
              ZFLIGHT_OVERVIEW · Source
            </p>
            <p className="truncate font-mono text-[9px] uppercase tracking-[0.14em] text-[#5b6d80]">
              ABAP Editor · SE38
            </p>
          </div>
          <span className="rounded-full border border-[#bfe3c2] bg-[#eaf5ea] px-2.5 py-1 text-[10px] font-semibold text-[#1c7a1c]">
            Active
          </span>
        </div>

        {/* code area */}
        <div className="flex text-left font-mono">
          <div className="select-none border-r border-[#eef3f8] bg-[#fafcff] px-3 py-4 text-right text-[12px] leading-[1.7] text-[#5b6d80]">
            {LINES.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <div className="flex-1 overflow-x-auto px-4 py-4 text-[12px] leading-[1.7]">
            {LINES.map((line, i) => (
              <div key={i} className="whitespace-pre">
                {line.map(([text, cls], j) => (
                  <span key={j} className={cls}>
                    {text}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* editor status line */}
        <div className="flex items-center justify-between border-t border-[#e1e9f1] bg-[#f4f7fa] px-4 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#5b6d80]">
          <span>Row 10 · Col 41 · INS</span>
          <span>MER (1) · Client 105</span>
        </div>
      </div>
    </div>
  )
}
