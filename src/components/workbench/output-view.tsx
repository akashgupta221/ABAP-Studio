'use client'

// ── Output view for one executed program ──────────────────────────────
import { CircleCheck, Clock3, Database, FileCode2, Info, ListOrdered, OctagonAlert, Play, RefreshCw, AlertTriangle, AlertOctagon, FileText, Sigma } from 'lucide-react'
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
      <div className="flex h-full items-center justify-center text-sm text-[#7b8a9c]">
        No output yet — press F8 to execute {programName}.
      </div>
    )
  }

  const isError = result.status === 'ERROR'

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#eef2f7]">
      {/* status strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#c5d2e2] bg-gradient-to-b from-[#f4f7fb] to-[#e4ebf3] px-3 py-1.5 text-[12px] text-[#2c3f53]">
        <span
          className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-semibold ${
            isError
              ? 'border-red-300 bg-red-100 text-red-700'
              : 'border-green-300 bg-green-100 text-green-700'
          }`}
        >
          {isError ? <AlertOctagon className="h-3.5 w-3.5" /> : <CircleCheck className="h-3.5 w-3.5" />}
          {isError ? 'Terminated' : 'Success'}
        </span>
        <span className="inline-flex items-center gap-1" title="Execution time">
          <Clock3 className="h-3.5 w-3.5 text-[#5b6d80]" />
          {result.durationMs} ms
        </span>
        <span className="inline-flex items-center gap-1" title="Interpreter steps">
          <Sigma className="h-3.5 w-3.5 text-[#5b6d80]" />
          {result.stats.steps} steps
        </span>
        <span className="inline-flex items-center gap-1" title="List lines written">
          <ListOrdered className="h-3.5 w-3.5 text-[#5b6d80]" />
          {result.stats.linesWritten} list lines
        </span>
        <span className="inline-flex items-center gap-1" title="SELECT statements / DB reads">
          <Database className="h-3.5 w-3.5 text-[#5b6d80]" />
          {result.stats.selects} selects · {result.stats.dbReads} reads
        </span>
        {result.alv && (
          <span className="inline-flex items-center gap-1 rounded-sm border border-[#b6c6d9] bg-white px-1.5 py-0.5 text-[11px] font-medium text-[#1c3a5f]" title="ALV grid present">
            <FileText className="h-3 w-3 text-[#0a6ed1]" />
            ALV
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            className="sap-btn"
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

      {/* scrollable content */}
      <div className="wb-scroll min-h-0 flex-1 overflow-auto p-3">
        {/* error dump */}
        {isError && result.error && (
          <div className="mb-3 overflow-hidden rounded-[3px] border-2 border-red-400 bg-[#fff5f5]">
            <div className="flex items-center gap-2 border-b border-red-300 bg-gradient-to-b from-[#ffe0e0] to-[#ffd0d0] px-3 py-2">
              <Play className="h-4 w-4 rotate-90 text-red-700" />
              <h2 className="text-[13.5px] font-bold text-red-800">
                {result.error.kind === 'SYNTAX' ? 'Syntax error' : 'Runtime error'}
                {result.error.abapType ? ` — ${result.error.abapType}` : ''}
              </h2>
              <span className="ml-auto font-mono text-[11px] text-red-700/80">{programName}</span>
            </div>
            <div className="space-y-2 px-4 py-3 text-[13px] text-[#3a1f1f]">
              <p className="font-medium">{result.error.message}</p>
              {typeof result.error.line === 'number' && (
                <p className="font-mono text-[12.5px]">
                  Error occurred at <span className="font-bold">line {result.error.line}</span>
                </p>
              )}
              {result.error.statement && (
                <pre className="overflow-x-auto rounded-sm border border-red-200 bg-white px-3 py-2 font-mono text-[12.5px] text-[#7a1f1f]">
                  {result.error.statement}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* messages */}
        {result.messages.length > 0 && (
          <div className="mb-3 overflow-hidden rounded-[3px] border border-[#c5d2e2] bg-white">
            <div className="border-b border-[#d8e1ec] bg-[#eef2f8] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#3f5468]">
              Messages
            </div>
            <ul className="divide-y divide-[#eef2f7]">
              {result.messages.map((m, i) => (
                <li key={i} className="flex items-start gap-2 px-3 py-1.5 text-[12.5px]">
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

        {/* classical list */}
        <div className="overflow-hidden rounded-[3px] border border-[#b6c6d9] bg-white">
          <div className="flex items-center gap-2 border-b border-[#d8e1ec] bg-[#eef2f8] px-3 py-1.5">
            <FileText className="h-3.5 w-3.5 text-[#0a6ed1]" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#3f5468]">
              List output
            </span>
            <span className="ml-auto font-mono text-[11px] text-[#5b6d80]">{result.list.length} lines</span>
          </div>
          <div className="h-[340px]">
            <ListOutput list={result.list} />
          </div>
        </div>
      </div>
    </div>
  )
}
