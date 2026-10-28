'use client'

// ── ABAP Debugger (adapted from App 2's debugger screen) ──────────────
// Two-pane New Debugger: source with breakpoints + current line on the left,
// variable/structure table on the right, list output produced so far below.
// The engine is stateless — F5/F6/F8 re-run the program server-side and stop
// at the requested statement, exactly like a debug session.
import { Ban, Play, Redo2, XCircle } from 'lucide-react'
import { ListOutput } from './list-output'
import { useWorkbench } from './use-workbench'
import type { DebugVariable } from './types'

function kindBadge(kind: string): { label: string; className: string } {
  if (kind === 'STRUCTURE') return { label: 'STRUCT', className: 'text-[#6b4ea0]' }
  if (kind === 'TABLE') return { label: 'TABLE', className: 'text-[#8a6d1a]' }
  if (kind === 'OBJECT') return { label: 'OBJECT', className: 'text-[#0a6ed1]' }
  if (kind === 'REF') return { label: 'REF', className: 'text-[#55677a]' }
  return { label: kind, className: 'text-[#33475c]' }
}

function VariableRow({ v }: { v: DebugVariable }) {
  const badge = kindBadge(v.kind)
  const detailText = v.detail === undefined ? undefined : JSON.stringify(v.detail)
  return (
    <tr className="border-b border-[#eef3f8] hover:bg-[#f2f7fd]">
      <td className="px-2 py-[3px] font-mono text-[12px] text-[#17324a]" style={{ paddingLeft: `${8 + v.level * 14}px` }}>
        {v.name}
      </td>
      <td className={`px-2 py-[3px] font-mono text-[11px] font-semibold ${badge.className}`}>{badge.label}</td>
      <td className="max-w-[420px] truncate px-2 py-[3px] font-mono text-[12px] text-[#22364b]" title={v.value}>
        {v.value === '' ? <span className="text-[#93a9c2]">initial</span> : v.value}
      </td>
      <td
        className="max-w-[260px] truncate px-2 py-[3px] font-mono text-[11px] text-[#55677a]"
        title={detailText}
      >
        {detailText ?? ''}
      </td>
    </tr>
  )
}

export function DebuggerView() {
  const session = useWorkbench((s) => s.debugSession)
  const debugStep = useWorkbench((s) => s.debugStep)
  const debugAbort = useWorkbench((s) => s.debugAbort)
  const toggleBreakpoint = useWorkbench((s) => s.toggleBreakpoint)
  const activateTab = useWorkbench((s) => s.activateTab)

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[#44586c]">
        No debug session — start one with /h plus F8, or the Debug button in the editor.
      </div>
    )
  }

  const { stop } = session
  const sourceLines = session.source.split('\n')
  const bpSet = new Set(session.breakpoints)

  const backToEditor = () => {
    const tabKey = `prog:${session.programName}`
    if (useWorkbench.getState().tabs.some((t) => t.key === tabKey)) activateTab(tabKey)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* debugger header: position + statement (SAP "New Debugger" info bar) */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#b9cbdd] bg-[#edf3fa] px-2 py-[3px]">
        <span className="text-[12.5px] font-bold text-[#17324a]">ABAP Debugger — {session.programName}</span>
        <span className="font-mono text-[11.5px] text-[#33475c]">
          Line {stop.line} · stop #{stop.stopIndex} · {stop.depth === 0 ? 'main program' : `call depth ${stop.depth}`}
        </span>
        {session.busy && <span className="text-[11.5px] text-[#8a6d1a]">running…</span>}
        <span className="ml-auto font-mono text-[11px] text-[#55677a]" title={stop.statement}>
          {stop.statement}
        </span>
      </div>

      {/* application toolbar */}
      <div className="sap-apptoolbar flex h-[26px] shrink-0 items-center gap-0.5 overflow-x-auto px-1.5">
        <button
          type="button"
          className="sap-tool-textbtn"
          title="Single step (F5) — enter calls"
          disabled={session.busy}
          onClick={() => void debugStep('stepInto')}
        >
          <Redo2 className="h-3.5 w-3.5 -scale-x-100 text-[#2e5b8a]" />
          <span>Step (F5)</span>
        </button>
        <button
          type="button"
          className="sap-tool-textbtn"
          title="Step over (F6) — execute the whole called unit"
          disabled={session.busy}
          onClick={() => void debugStep('stepOver')}
        >
          <Play className="h-3.5 w-3.5 text-[#2e5b8a]" />
          <span>Step Over (F6)</span>
        </button>
        <button
          type="button"
          className="sap-tool-textbtn"
          title="Continue (F8) — run to the next breakpoint or the end"
          disabled={session.busy}
          onClick={() => void debugStep('continue')}
        >
          <Play className="h-3.5 w-3.5 text-[#1c7a1c]" />
          <span>Continue (F8)</span>
        </button>
        <span className="sap-toolbar-sep" aria-hidden />
        <button type="button" className="sap-tool-textbtn" title="End the debug session" onClick={debugAbort}>
          <XCircle className="h-3.5 w-3.5 text-[#a02121]" />
          <span>Stop</span>
        </button>
        <span className="sap-toolbar-sep" aria-hidden />
        <span className="flex items-center gap-1 px-1 text-[11.5px] text-[#55677a]" title="Click a line number in the source to set or clear a breakpoint">
          <Ban className="h-3 w-3 text-[#8a6d1a]" />
          {session.breakpoints.length} breakpoint{session.breakpoints.length === 1 ? '' : 's'}
        </span>
        <button type="button" className="sap-tool-textbtn ml-auto" onClick={backToEditor} title="Back to the ABAP editor">
          <span>Back to Editor</span>
        </button>
      </div>

      {/* source + variables */}
      <div className="flex min-h-0 flex-1">
        {/* source pane with breakpoint gutter */}
        <div
          className="wb-scroll min-h-0 w-[58%] overflow-auto border-r-2 border-[#a3b8d0] bg-white"
          tabIndex={0}
          aria-label="Program source with breakpoints"
        >
          <table className="w-full border-collapse font-mono text-[12px] leading-[1.45]">
            <tbody>
              {sourceLines.map((text, i) => {
                const line = i + 1
                const isCurrent = line === stop.line
                const hasBp = bpSet.has(line)
                return (
                  <tr
                    key={line}
                    className={isCurrent ? 'bg-[#ffe8a3]' : 'hover:bg-[#f2f7fd]'}
                    onClick={() => toggleBreakpoint(line)}
                  >
                    <td
                      className={`w-12 select-none border-r border-[#dce6f0] px-1 text-right text-[11px] ${
                        hasBp ? 'font-bold text-[#8a6d1a]' : 'text-[#93a9c2]'
                      }`}
                      title={hasBp ? 'Clear breakpoint' : 'Set breakpoint'}
                    >
                      {hasBp ? '●' : ''} {line}
                    </td>
                    <td className="whitespace-pre px-2 text-[#22364b]">{text || ' '}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* variables pane */}
        <div className="flex min-h-0 w-[42%] flex-col">
          <div className="flex items-center gap-2 border-b border-[#dce6f0] bg-[#f7fafd] px-2 py-[3px] text-[11px] font-semibold uppercase tracking-wide text-[#44586c]">
            Variables
            <span className="ml-auto font-normal normal-case text-[#55677a]">
              innermost scope first · refreshed each step
            </span>
          </div>
          <div className="wb-scroll min-h-0 flex-1 overflow-auto" tabIndex={0} aria-label="Debugger variables">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-[#edf3fa]">
                <tr className="text-left text-[11px] text-[#44586c]">
                  <th className="px-2 py-1 font-semibold">Name</th>
                  <th className="px-2 py-1 font-semibold">Kind</th>
                  <th className="px-2 py-1 font-semibold">Value</th>
                  <th className="px-2 py-1 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody>
                {stop.variables.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-[12.5px] text-[#55677a]">
                      No variables declared yet.
                    </td>
                  </tr>
                )}
                {stop.variables.map((v) => (
                  <VariableRow key={`${v.level}-${v.name}`} v={v} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* list output produced so far */}
      <div className="flex h-[170px] shrink-0 flex-col border-t-2 border-[#a3b8d0] bg-[#fbfcfe]">
        <div className="flex items-center gap-2 border-b border-[#dce6f0] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#44586c]">
          List Output So Far
          <span className="ml-auto font-normal normal-case text-[#55677a]">{session.list.length} line(s)</span>
        </div>
        <div className="wb-scroll min-h-0 flex-1 overflow-auto" tabIndex={0} aria-label="List output produced so far">
          {session.list.length === 0 ? (
            <div className="px-3 py-2 text-[12.5px] text-[#55677a]">Nothing written yet.</div>
          ) : (
            <div className="h-full px-1 pb-1">
              <ListOutput list={session.list} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
