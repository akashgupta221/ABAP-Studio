'use client'

// ── ABAP Editor view (SE38 style) for one open program ────────────────
import { useRef, useState } from 'react'
import {
  Ban, CheckCircle2, ChevronDown, CircleCheck, Copy, FileCode2, FilePlus2, Keyboard, Lock,
  Play, Save, Star, Trash2, X,
} from 'lucide-react'
import { useWorkbench } from './use-workbench'
import { AbapEditor } from './abap-editor'
import type { CheckIssue } from './types'

export function EditorView({ programName }: { programName: string }) {
  const prog = useWorkbench((s) => s.programs[programName])
  const updateSource = useWorkbench((s) => s.updateSource)
  const runProgram = useWorkbench((s) => s.runProgram)
  const checkProgram = useWorkbench((s) => s.checkProgram)
  const saveProgram = useWorkbench((s) => s.saveProgram)
  const openNewDialog = useWorkbench((s) => s.openNewDialog)
  const deleteProgram = useWorkbench((s) => s.deleteProgram)
  const toggleFavorite = useWorkbench((s) => s.toggleFavorite)
  const isFavorite = useWorkbench((s) =>
    s.favorites.some((f) => f.objectType === 'REPORT' && f.objectName === programName),
  )
  const issues = useWorkbench((s) => s.checkResults[programName])

  const [panelOpen, setPanelOpen] = useState(false)
  const [cursorLine, setCursorLine] = useState(1)
  const panelRef = useRef<HTMLDivElement>(null)

  // auto-open the check panel when new issues arrive — adjust-state-during-render
  // pattern (see react.dev "You Might Not Need an Effect"); avoids cascading effects
  const [seenIssues, setSeenIssues] = useState<CheckIssue[] | undefined>(undefined)
  if (issues !== seenIssues) {
    setSeenIssues(issues)
    if (issues) setPanelOpen(true)
  }

  if (!prog) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#7b8a9c]">
        Program {programName} is not open.
      </div>
    )
  }

  const errors = issues?.filter((i) => i.kind === 'E') ?? []
  const warnings = issues?.filter((i) => i.kind === 'W') ?? []

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* header strip */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#c5d2e2] bg-gradient-to-b from-[#f4f7fb] to-[#e7edf5] px-3 py-1.5">
        <FileCode2 className="h-4 w-4 shrink-0 text-[#0a6ed1]" />
        <span className="font-mono text-[14px] font-bold text-[#12283c]">{prog.name}</span>
        {prog.title && (
          <span className="max-w-[280px] truncate text-[12.5px] text-[#44586c]">{prog.title}</span>
        )}
        <span className="rounded-sm border border-[#b6c6d9] bg-white px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-[#1c3a5f]">
          {prog.type}
        </span>
        <span className="rounded-sm border border-[#d8c8ec] bg-[#f3ecfb] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#5d3a8e]">
          {prog.paradigm}
        </span>
        {prog.topicTitle && (
          <span className="hidden rounded-sm border border-[#b8d8e0] bg-[#e9f5f7] px-1.5 py-0.5 text-[10.5px] font-medium text-[#1f5f6e] md:inline">
            {prog.topicTitle}
          </span>
        )}
        <span className="hidden font-mono text-[11px] text-[#7b8a9c] sm:inline">v{prog.version}</span>
        {prog.isExample && (
          <span
            className="inline-flex items-center gap-1 rounded-sm border border-[#e8d48a] bg-[#fdf6e0] px-1.5 py-0.5 text-[10.5px] font-medium text-[#8a6d1a]"
            title="Example program — read-only. Use Save As to create your own copy."
          >
            <Lock className="h-3 w-3" />
            Example
          </span>
        )}
        {prog.dirty && (
          <span className="rounded-sm bg-[#f8e8b0] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#8a6d1a]">
            unsaved
          </span>
        )}
        <button
          type="button"
          className="ml-auto shrink-0"
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={() => void toggleFavorite(prog.type, prog.name, prog.title)}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star
            className={`h-4 w-4 ${isFavorite ? 'fill-[#f0b429] text-[#f0b429]' : 'text-[#93a9c2] hover:text-[#f0b429]'}`}
          />
        </button>
      </div>

      {/* editor action bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[#d8e1ec] bg-[#eef2f8] px-3 py-1.5">
        <button
          type="button"
          className="sap-btn"
          onClick={() => void checkProgram(programName)}
          title="Check syntax (Ctrl+F2)"
        >
          <CircleCheck className="h-3.5 w-3.5 text-green-700" />
          Check
          <kbd className="ml-1 hidden rounded-sm border border-[#c5d2e2] bg-white px-1 font-mono text-[9.5px] text-[#5b6d80] lg:inline">
            Ctrl+F2
          </kbd>
        </button>
        <button
          type="button"
          className="sap-btn sap-btn-primary"
          onClick={() => void runProgram(programName)}
          disabled={prog.running}
          title="Execute (F8)"
        >
          {prog.running ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          Execute
          <kbd className="ml-1 hidden rounded-sm border border-[#0857a8]/40 bg-white/20 px-1 font-mono text-[9.5px] text-white lg:inline">
            F8
          </kbd>
        </button>
        <button
          type="button"
          className="sap-btn"
          onClick={() => void saveProgram(programName)}
          title={prog.isExample ? 'Examples are read-only — Save As creates a copy' : 'Save (Ctrl+S)'}
        >
          <Save className="h-3.5 w-3.5" />
          {prog.isExample ? 'Save (read-only)' : 'Save'}
          <kbd className="ml-1 hidden rounded-sm border border-[#c5d2e2] bg-white px-1 font-mono text-[9.5px] text-[#5b6d80] lg:inline">
            Ctrl+S
          </kbd>
        </button>
        {prog.isExample && (
          <button
            type="button"
            className="sap-btn"
            onClick={() =>
              openNewDialog({
                prefillName: `${programName}_COPY`,
                prefillSource: prog.source,
                prefillTitle: prog.title,
                prefillType: prog.type,
                saveAsFrom: programName,
              })
            }
            title="Save this example under a new name"
          >
            <Copy className="h-3.5 w-3.5" />
            Save As…
          </button>
        )}
        <button
          type="button"
          className="sap-btn"
          onClick={() => openNewDialog({ prefillType: prog.type })}
          title="Create a new repository object"
        >
          <FilePlus2 className="h-3.5 w-3.5" />
          New
        </button>
        {!prog.isExample && (
          <button
            type="button"
            className="sap-btn sap-btn-danger"
            onClick={() => {
              if (window.confirm(`Delete object ${prog.name}? This cannot be undone.`)) {
                void deleteProgram(programName)
              }
            }}
            title="Delete this object from the repository"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        )}

        {/* check status */}
        <div className="ml-auto flex items-center gap-2">
          {issues && (
            <button
              type="button"
              onClick={() => setPanelOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold"
              title="Toggle check results panel"
            >
              {errors.length > 0 ? (
                <span className="flex items-center gap-1 border-red-300 bg-red-50 text-red-700">
                  <Ban className="h-3 w-3" /> {errors.length} error{errors.length > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="flex items-center gap-1 border-green-300 bg-green-50 text-green-700">
                  <CheckCircle2 className="h-3 w-3" /> OK
                </span>
              )}
              {warnings.length > 0 && (
                <span className="flex items-center gap-1 rounded-sm border border-yellow-300 bg-yellow-50 px-1.5 py-0.5 text-yellow-700">
                  {warnings.length} warning{warnings.length > 1 ? 's' : ''}
                </span>
              )}
              <ChevronDown className={`h-3 w-3 text-[#5b6d80] transition-transform ${panelOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
          <span className="font-mono text-[11px] text-[#5b6d80]">
            {cursorLine}:{prog.source.split('\n').length}
          </span>
        </div>
      </div>

      {/* editor + check panel */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <AbapEditor value={prog.source} onChange={(v) => updateSource(programName, v)} onCursorLine={setCursorLine} />
        </div>

        {panelOpen && issues && (
          <div ref={panelRef} className="flex max-h-56 min-h-[100px] shrink-0 flex-col border-t-2 border-[#a3b8d0] bg-[#f7fafd]">
            <div className="flex items-center gap-2 border-b border-[#d8e1ec] px-3 py-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#3f5468]">
                Syntax check — {programName}
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
                <div className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-green-700">
                  <CircleCheck className="h-4 w-4" />
                  No syntax errors found — program is syntactically correct.
                </div>
              ) : (
                <table className="w-full text-[12px]">
                  <tbody>
                    {issues.map((iss, i) => (
                      <tr
                        key={i}
                        className={`cursor-pointer border-b border-[#eef2f7] hover:bg-[#e7f0fb] ${
                          iss.kind === 'E' ? 'text-red-800' : iss.kind === 'W' ? 'text-yellow-800' : 'text-[#44586c]'
                        }`}
                      >
                        <td className="w-16 py-1 pl-3 font-mono">{iss.kind === 'E' ? 'Error' : iss.kind === 'W' ? 'Warning' : 'Info'}</td>
                        <td className="w-20 py-1 font-mono">line {iss.line}</td>
                        <td className="py-1 pr-3">{iss.message}</td>
                        {iss.statement && (
                          <td className="max-w-[380px] truncate py-1 pr-3 font-mono text-[11.5px] opacity-70" title={iss.statement}>
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

      {/* footer hint bar */}
      <div className="flex items-center gap-4 border-t border-[#d8e1ec] bg-[#eef2f8] px-3 py-1 text-[11px] text-[#5b6d80]">
        <span className="inline-flex items-center gap-1">
          <Keyboard className="h-3 w-3" /> Ctrl+S Save · Ctrl+F2 Check · F8 Execute
        </span>
        <span className="ml-auto font-mono">{prog.executions} executions</span>
      </div>
    </div>
  )
}
