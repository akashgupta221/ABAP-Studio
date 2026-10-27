'use client'

// ── ABAP Dump Analysis (ST22) — adapted from App 2's dump screen ──────
// Lists the caller's own runtime errors from the execution log with the
// ABAP error type, short text and source line, like the SAP ST22 list.
import { useCallback, useEffect, useState } from 'react'
import { AlertOctagon, RefreshCw } from 'lucide-react'
import { api, useWorkbench } from './use-workbench'
import type { DumpEntry } from './types'

function formatStamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function DumpsView() {
  const addMessage = useWorkbench((s) => s.addMessage)
  const openProgramByName = useWorkbench((s) => s.openProgramByName)
  const [dumps, setDumps] = useState<DumpEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api<{ dumps: DumpEntry[] }>('/api/dumps?limit=50')
      setDumps(r.dumps)
    } catch (e) {
      addMessage('E', `ST22: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [addMessage])

  useEffect(() => {
    void load()
  }, [load])

  const openProgram = (name: string) => {
    void openProgramByName(name)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f4f9]">
      {/* header */}
      <div className="border-b border-[#c3d0e0] bg-white px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <AlertOctagon className="h-5 w-5 text-[#a02121]" />
          <div>
            <h1 className="text-[14px] font-bold text-[#17324a]">ABAP Dump Analysis (ST22)</h1>
            <p className="text-[11.5px] text-[#55677a]">
              Short dumps of your own program runs — the most recent first
            </p>
          </div>
          <button type="button" className="sap-btn ml-auto" onClick={() => void load()} title="Refresh the dump list">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* dump list */}
      <div className="wb-scroll min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-[1100px] overflow-hidden rounded-[4px] border border-[#b6c6d9] bg-white shadow-sm">
          {loading && (
            <div className="space-y-1.5 p-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-7 animate-pulse rounded-sm bg-[#e2e9f2]" />
              ))}
            </div>
          )}

          {!loading && dumps.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <AlertOctagon className="h-8 w-8 text-[#b9cbdd]" />
              <p className="text-[13px] font-medium text-[#44586c]">
                No short dumps exist — none of your program runs has terminated with a runtime error.
              </p>
              <p className="text-[12px] text-[#55677a]">
                Runtime errors (for example division by zero or unhandled exceptions) are recorded here.
              </p>
            </div>
          )}

          {!loading && dumps.length > 0 && (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-[#c5d2e2] bg-gradient-to-b from-[#eef2f8] to-[#dbe4ef] text-left text-[11px] uppercase tracking-wide text-[#44586c]">
                  <th className="px-3 py-1.5 font-semibold">Date / Time</th>
                  <th className="px-3 py-1.5 font-semibold">Program</th>
                  <th className="px-3 py-1.5 font-semibold">Error Type</th>
                  <th className="px-3 py-1.5 font-semibold">Short Text</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Line</th>
                </tr>
              </thead>
              <tbody>
                {dumps.map((d) => {
                  const isOpen = selected === d.id
                  return (
                    <tr
                      key={d.id}
                      className={`cursor-pointer border-b border-[#eef3f8] align-top hover:bg-[#e7f0fb] ${isOpen ? 'bg-[#f2f7fd]' : ''}`}
                      onClick={() => setSelected(isOpen ? null : d.id)}
                    >
                      <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[11.5px] text-[#55677a]">
                        {formatStamp(d.createdAt)}
                      </td>
                      <td className="px-3 py-1.5 font-mono font-semibold text-[#0b4fa8]">
                        <button
                          type="button"
                          className="hover:underline"
                          onClick={(e) => {
                            e.stopPropagation()
                            openProgram(d.programName)
                          }}
                          title="Open the program in the ABAP Editor"
                        >
                          {d.programName}
                        </button>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[12px] font-semibold text-[#a02121]">
                        {d.errorType ?? 'RUNTIME_ERROR'}
                      </td>
                      <td className="px-3 py-1.5 text-[#22364b]">
                        <span className="line-clamp-1">{d.message || '(no short text)'}</span>
                        {isOpen && (
                          <div className="mt-1.5 rounded-[3px] border border-[#e0c0c0] bg-[#fff8f8] px-2 py-1.5 text-[12px] text-[#3a1f1f]">
                            <p className="whitespace-pre-wrap font-mono">{d.message || '(no short text)'}</p>
                            <p className="mt-1 text-[11px] text-[#8a4b4b]">
                              Duration {d.durationMs} ms · {d.listLines} list line(s) produced before the dump
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-[11.5px] text-[#55677a]">
                        {d.errorLine ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && dumps.length > 0 && (
          <p className="mx-auto mt-2 max-w-[1100px] text-[11px] text-[#55677a]">
            Dumps are recorded per user: you only see the runtime errors of your own executions. Click a row for
            details, or the program name to open the editor.
          </p>
        )}
      </div>
    </div>
  )
}
