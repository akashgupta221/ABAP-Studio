'use client'

// ── ABAP Editor view (SE38) for one open program ──────────────────────
import { useState } from 'react'
import { Search, Star, X } from 'lucide-react'
import { useWorkbench } from './use-workbench'
import { AbapEditor } from './abap-editor'
import type { CheckIssue, SearchHit } from './types'

export function EditorView({ programName }: { programName: string }) {
  const prog = useWorkbench((s) => s.programs[programName])
  const updateSource = useWorkbench((s) => s.updateSource)
  const toggleFavorite = useWorkbench((s) => s.toggleFavorite)
  const isFavorite = useWorkbench((s) =>
    s.favorites.some((f) => f.objectType === 'REPORT' && f.objectName === programName),
  )
  const issues = useWorkbench((s) => s.checkResults[programName])

  const editorFontSize = useWorkbench((s) => s.editorFontSize)
  const findOpen = useWorkbench((s) => s.findOpen)
  const setFindOpen = useWorkbench((s) => s.setFindOpen)
  const findQuery = useWorkbench((s) => s.findQuery)
  const setFindQuery = useWorkbench((s) => s.setFindQuery)
  const findNonce = useWorkbench((s) => s.findNonce)
  const runFindNext = useWorkbench((s) => s.runFindNext)
  const undoNonce = useWorkbench((s) => s.undoNonce)
  const redoNonce = useWorkbench((s) => s.redoNonce)
  const insertRequest = useWorkbench((s) => s.insertRequest)

  const whereUsed = useWorkbench((s) => s.whereUsed)
  const closeWhereUsed = useWorkbench((s) => s.closeWhereUsed)

  const [panelOpen, setPanelOpen] = useState(false)
  const [cursor, setCursor] = useState({ line: 1, col: 1 })

  // auto-open the check panel when new issues arrive — adjust-state-during-render
  // pattern (see react.dev "You Might Not Need an Effect"); avoids cascading effects
  const [seenIssues, setSeenIssues] = useState<CheckIssue[] | undefined>(undefined)
  if (issues !== seenIssues) {
    setSeenIssues(issues)
    if (issues) setPanelOpen(true)
  }

  if (!prog) {
    return (
      <div className="sap-screen flex h-full items-center justify-center text-[13px] text-[#44586c]">
        Program {programName} is not open.
      </div>
    )
  }

  const errors = issues?.filter((i) => i.kind === 'E') ?? []
  const warnings = issues?.filter((i) => i.kind === 'W') ?? []
  const showWhereUsed = whereUsed.open && whereUsed.program === programName

  const openHit = (hit: SearchHit) => {
    const s = useWorkbench.getState()
    if (hit.objectType === 'PROGRAM' || hit.objectType === 'REPORT') void s.openProgramByName(hit.name)
    else if (hit.objectType === 'TABLE') s.openBrowserFor(hit.name)
    else s.addMessage('I', `${hit.objectType} ${hit.name}: ${hit.detail}`)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* SE38 editor info line: Report <program> Active/Inactive */}
      <div className="flex items-center gap-3 border-b border-[#c5d2e2] bg-[#f7fafd] px-3 py-[3px] text-[12.5px]">
        <span className="shrink-0 text-[#33475c]">Report</span>
        <span
          className="flex h-[20px] max-w-[300px] items-center border border-[#c6d3e2] bg-[#f4f8fc] px-2 font-mono text-[12.5px] text-[#12283c] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.05)]"
          title={prog.title || prog.name}
        >
          <span className="truncate">{prog.name}</span>
        </span>
        <span className="shrink-0 text-[#1c2b3a]">
          {prog.dirty || prog.active === false ? 'Inactive' : 'Active'}
        </span>
        {prog.isExample && (
          <span
            className="shrink-0 whitespace-nowrap text-[11.5px] text-[#8a6d1a]"
            title="Example program — read-only. Use Program ▸ Save As to create your own copy."
          >
            Example (read-only)
          </span>
        )}
        <span className="ml-auto flex items-center gap-3">
          <button
            type="button"
            className="shrink-0"
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            onClick={() => void toggleFavorite(prog.type, prog.name, prog.title)}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star
              className={`h-3.5 w-3.5 ${isFavorite ? 'fill-[#f0b429] text-[#f0b429]' : 'text-[#93a9c2] hover:text-[#f0b429]'}`}
            />
          </button>
        </span>
      </div>

      {/* find bar (Ctrl+F) */}
      {findOpen && (
        <div className="flex items-center gap-2 border-b border-[#d8e1ec] bg-[#eef2f7] px-3 py-[3px] text-[12px]">
          <Search className="h-3.5 w-3.5 text-[#33475c]" />
          <span className="text-[#33475c]">Find</span>
          <input
            autoFocus
            className="sap-field w-[240px]"
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                runFindNext()
              } else if (e.key === 'Escape') {
                setFindOpen(false)
              }
            }}
            aria-label="Find in source code"
          />
          <button type="button" className="sap-btn" onClick={runFindNext}>
            Find Next
          </button>
          <span className="text-[11px] text-[#7b8a9c]">Ctrl+G · Esc closes</span>
          <button
            type="button"
            className="ml-auto rounded-sm p-0.5 text-[#5b6d80] hover:bg-[#dbe8f8]"
            onClick={() => setFindOpen(false)}
            aria-label="Close find bar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* editor + check / where-used panels */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <AbapEditor
            value={prog.source}
            onChange={(v) => updateSource(programName, v)}
            onCursor={(line, col) => setCursor({ line, col })}
            fontSize={editorFontSize}
            findRequest={{ query: findOpen ? findQuery : '', nonce: findNonce }}
            undoNonce={undoNonce}
            redoNonce={redoNonce}
            insertRequest={insertRequest}
          />
        </div>

        {showWhereUsed && (
          <div className="flex max-h-64 min-h-[110px] shrink-0 flex-col border-t-2 border-[#a3b8d0] bg-[#fbfcfe]">
            <div className="flex items-center gap-2 border-b border-[#d8e1ec] px-3 py-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#3f5468]">
                Where-Used List — {whereUsed.program}
              </span>
              <span className="text-[11px] text-[#7b8a9c]">
                {whereUsed.loading ? 'searching…' : `${whereUsed.hits.length} hit(s)`}
              </span>
              <button
                type="button"
                className="ml-auto rounded-sm p-0.5 text-[#5b6d80] hover:bg-[#dbe8f8]"
                onClick={closeWhereUsed}
                aria-label="Close where-used list"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="wb-scroll min-h-0 flex-1 overflow-auto">
              {whereUsed.loading ? (
                <div className="px-3 py-2 text-[12.5px] text-[#5b6d80]">Searching repository…</div>
              ) : whereUsed.hits.length === 0 ? (
                <div className="px-3 py-2 text-[12.5px] text-[#5b6d80]">
                  No references to {whereUsed.program} found in the repository.
                </div>
              ) : (
                <table className="w-full text-[12px]">
                  <tbody>
                    {whereUsed.hits.map((hit, i) => (
                      <tr
                        key={`${hit.objectType}-${hit.name}-${i}`}
                        className="cursor-pointer border-b border-[#eef2f7] hover:bg-[#e7f0fb]"
                        onClick={() => openHit(hit)}
                      >
                        <td className="w-24 py-1 pl-3 text-[#5b6d80]">{hit.objectType}</td>
                        <td className="w-48 py-1 font-mono text-[#0b4fa8]">{hit.name}</td>
                        <td className="py-1 pr-3 text-[#44586c]">
                          <span className="line-clamp-1">{hit.detail || hit.title}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {panelOpen && issues && (
          <div className="flex max-h-56 min-h-[100px] shrink-0 flex-col border-t-2 border-[#a3b8d0] bg-[#fbfcfe]">
            <div className="flex items-center gap-2 border-b border-[#d8e1ec] px-3 py-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#3f5468]">
                Syntax Check — {programName}
              </span>
              <span className="text-[11px] text-[#7b8a9c]">
                {errors.length > 0 ? `${errors.length} error(s)` : 'no errors'}
                {warnings.length > 0 ? `, ${warnings.length} warning(s)` : ''}
              </span>
              <button
                type="button"
                className="ml-auto rounded-sm p-0.5 text-[#5b6d80] hover:bg-[#dbe8f8]"
                onClick={() => setPanelOpen(false)}
                aria-label="Close check panel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="wb-scroll min-h-0 flex-1 overflow-auto">
              {issues.length === 0 ? (
                <div className="px-3 py-2 text-[12.5px] text-[#1c7a1c]">
                  No syntax errors found — program is syntactically correct.
                </div>
              ) : (
                <table className="w-full text-[12px]">
                  <tbody>
                    {issues.map((iss, i) => (
                      <tr
                        key={i}
                        className="border-b border-[#eef2f7] hover:bg-[#e7f0fb]"
                        onClick={() => setCursor((c) => ({ ...c, line: iss.line }))}
                      >
                        <td
                          className={`w-20 py-1 pl-3 font-mono ${
                            iss.kind === 'E'
                              ? 'text-[#a01f1f]'
                              : iss.kind === 'W'
                                ? 'text-[#8a6d1a]'
                                : 'text-[#5b6d80]'
                          }`}
                        >
                          {iss.kind === 'E' ? 'Error' : iss.kind === 'W' ? 'Warning' : 'Info'}
                        </td>
                        <td className="w-16 py-1 font-mono text-[#5b6d80]">line {iss.line}</td>
                        <td className="py-1 pr-3 text-[#22364b]">{iss.message}</td>
                        {iss.statement && (
                          <td
                            className="max-w-[380px] truncate py-1 pr-3 font-mono text-[11.5px] text-[#7b8a9c]"
                            title={iss.statement}
                          >
                            {iss.statement}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* editor status line ("ABAP · Ln/Col" like the real ABAP editor) */}
      <div className="flex items-center gap-4 border-t border-[#d8e1ec] bg-[#eef2f7] px-3 py-[1px] font-mono text-[11px] text-[#5b6d80]">
        <span className="text-[#33475c]">ABAP</span>
        <span className="text-[10.5px] text-[#93a9c2]">v{prog.version}</span>
        <span className="ml-auto">
          Ln {cursor.line} Col {cursor.col}
        </span>
      </div>
    </div>
  )
}
