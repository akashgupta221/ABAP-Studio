'use client'

// ── Output view for one executed program ──────────────────────────────
import { AlertOctagon, AlertTriangle, CircleCheck, FileCode2, Info, OctagonAlert, Play, RefreshCw } from 'lucide-react'
import type { MessageType, RunResult } from './types'
import { AlvGridPanel } from './alv-grid'
import { ListOutput } from './list-output'
import { useWorkbench } from './use-workbench'

function MsgIcon({ t }: { t: MessageType }) {
  switch (t) {
    case 'S':
      return <CircleCheck className="h-3.5 w-3.5 shrink-0 text-green-600" />
    case 'E':
      return <AlertOctagon className="h-3.5 w-3.5 shrink-0 text-red-600" />
    case 'W':
      return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-600" />
    case 'A':
      return <OctagonAlert className="h-3.5 w-3.5 shrink-0 text-red-700" />
    default:
      return <Info className="h-3.5 w-3.5 shrink-0 text-sky-600" />
  }
}

export function OutputView({ programName }: { programName: string }) {
  const result = useWorkbench((s) => s.outputs[programName])
  const runProgram = useWorkbench((s) => s.runProgram)
  const activateTab = useWorkbench((s) => s.activateTab)
  const programs = useWorkbench((s) => s.programs)
  const prog = programs[programName]

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center bg-white text-[12.5px] text-[#5b6d80]">
        No output yet — press F8 to execute {programName}.
      </div>
    )
  }

  const isError = result.status === 'ERROR'

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* SAP list header: program · status · stats | actions */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#b4c4d6] bg-[#eef2f7] px-2 py-[3px]">
        <span className="text-[12.5px] font-bold text-[#12283c]">List: {programName}</span>
        <span
          className={`inline-flex items-center gap-1 text-[12px] font-semibold ${
            isError ? 'text-[#b3261e]' : 'text-[#17692c]'
          }`}
        >
          {isError ? <AlertOctagon className="h-3.5 w-3.5" /> : <CircleCheck className="h-3.5 w-3.5" />}
          {isError ? 'Terminated' : 'Success'}
        </span>
        <span className="text-[11.5px] text-[#5b6d80]">
          {result.durationMs} ms · {result.stats.steps} steps · {result.stats.linesWritten} list lines ·{' '}
          {result.stats.selects} selects · {result.stats.dbReads} DB reads
        </span>
        {result.alv && <span className="text-[11.5px] text-[#5b6d80]">· ALV grid</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            className="sap-btn sap-btn-primary"
            onClick={() => void runProgram(programName)}
            disabled={!prog || prog.running}
            title={prog ? 'Re-run program (F8)' : 'Program tab is closed — reopen it to re-run'}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${prog?.running ? 'animate-spin' : ''}`} />
            Re-run
          </button>
          <button
            type="button"
            className="sap-btn"
            onClick={() => {
              // if the editor tab is gone (closed), reopen the program
              const open = useWorkbench.getState().tabs.some((t) => t.key === `prog:${programName}`)
              if (open) activateTab(`prog:${programName}`)
              else void useWorkbench.getState().openProgramByName(programName)
            }}
            title="Back to editor"
          >
            <FileCode2 className="h-3.5 w-3.5" />
            Editor
          </button>
        </div>
      </div>

      {/* scrollable content — plain white SAP output page */}
      <div className="wb-scroll min-h-0 flex-1 overflow-auto bg-white p-2 pb-3">
        {/* error dump (SAP syntax/runtime error style) */}
        {isError && result.error && (
          <div className="mb-3 border border-[#c0392b] bg-[#fff8f8]">
            <div className="flex items-center gap-2 border-b border-[#e0b4b0] bg-[#f7e7e5] px-2 py-1">
              <Play className="h-3.5 w-3.5 rotate-90 text-[#a02121]" />
              <h2 className="text-[12.5px] font-bold text-[#7a1f1f]">
                {result.error.kind === 'SYNTAX' ? 'Syntax error' : 'Runtime error'}
                {result.error.abapType ? ` — ${result.error.abapType}` : ''}
              </h2>
              <span className="ml-auto font-mono text-[11px] text-[#8a4b4b]">{programName}</span>
            </div>
            <div className="space-y-2 px-3 py-2 text-[12.5px] text-[#3a1f1f]">
              <p className="font-medium">{result.error.message}</p>
              {typeof result.error.line === 'number' && (
                <p className="font-mono text-[12px]">
                  Error occurred at <span className="font-bold">line {result.error.line}</span>
                </p>
              )}
              {result.error.statement && (
                <pre className="overflow-x-auto border border-[#e0c0c0] bg-white px-2 py-1 font-mono text-[12px] text-[#7a1f1f]">
                  {result.error.statement}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* messages */}
        {result.messages.length > 0 && (
          <div className="mb-3 border border-[#b8b8b8] bg-white">
            <div className="border-b border-[#d0d0d0] bg-[#f0f0f0] px-2 py-1 text-[11.5px] font-semibold text-[#333333]">
              Messages
            </div>
            <ul className="divide-y divide-[#eeeeee]">
              {result.messages.map((m, i) => (
                <li key={i} className="flex items-start gap-2 px-2 py-1 text-[12.5px]">
                  <span className="mt-[2px]">
                    <MsgIcon t={m.msgType} />
                  </span>
                  <span className="text-[#22364b]">{m.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ALV first */}
        {result.alv && (
          <div className="mb-3 h-[420px]">
            <AlvGridPanel alv={result.alv} />
          </div>
        )}

        {/* classical list — raw SAP list page in a thin frame */}
        <div className="mb-1 flex items-baseline justify-between px-0.5 text-[11.5px] text-[#5b6d80]">
          <span className="font-semibold text-[#12283c]">List output</span>
          <span className="font-mono">{result.list.length} lines</span>
        </div>
        <div className="border border-[#b8b8b8] bg-white">
          <div className="h-[340px]">
            <ListOutput list={result.list} />
          </div>
        </div>
      </div>
    </div>
  )
}
