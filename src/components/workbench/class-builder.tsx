'use client'

// ── Class Builder (SE24) ──────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { Braces, FileCode2, Play, Search } from 'lucide-react'
import { useWorkbench, api } from './use-workbench'
import type { ProgramListItem } from './types'

export function ClassBuilderView() {
  const openProgramByName = useWorkbench((s) => s.openProgramByName)
  const [classes, setClasses] = useState<ProgramListItem[] | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    api<{ programs: ProgramListItem[] }>('/api/programs?type=CLASS')
      .then((r) => setClasses(r.programs))
      .catch(() => setClasses([]))
  }, [])

  const f = filter.trim().toUpperCase()
  const list = (classes ?? []).filter(
    (c) => !f || c.name.includes(f) || c.title.toUpperCase().includes(f),
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f4f9]">
      <div className="border-b border-[#c3d0e0] bg-white px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <Braces className="h-5 w-5 text-[#0a6e6e]" />
          <div>
            <h1 className="text-[14px] font-bold text-[#12283c]">Class Builder (SE24)</h1>
            <p className="text-[11.5px] text-[#7b8a9c]">
              ABAP Objects classes — definitions and implementations open in the editor
            </p>
          </div>
          <span className="ml-auto rounded-sm border border-[#c5d2e2] bg-white px-2 py-1 font-mono text-[11px] text-[#3f5468]">
            {classes?.length ?? '…'} classes
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 rounded-[3px] border border-[#7f9db9] bg-white px-2 py-1">
          <Search className="h-3.5 w-3.5 text-[#7f9db9]" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter classes…"
            className="h-[24px] w-full bg-transparent font-mono text-[12px] outline-none placeholder:font-sans placeholder:text-[#9aa8b8]"
            aria-label="Filter classes"
          />
        </div>
      </div>

      <div className="wb-scroll min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-[900px]">
          {classes === null && (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-[4px] bg-[#e2e9f2]" />
              ))}
            </div>
          )}
          {classes !== null && classes.length === 0 && (
            <p className="rounded-[4px] border border-dashed border-[#c3d0e0] bg-white px-4 py-8 text-center text-[13px] text-[#8593a5]">
              No classes in the repository yet — the seeder may still be running, or create one via
              Program → New Object.
            </p>
          )}
          <div className="space-y-2">
            {list.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-[4px] border border-[#c3d0e0] bg-white px-3 py-2.5 shadow-sm hover:border-[#8fb0d4]"
              >
                <Braces className="h-4 w-4 shrink-0 text-[#0a6e6e]" />
                <div className="min-w-0">
                  <p className="font-mono text-[13px] font-bold text-[#12283c]">{c.name}</p>
                  <p className="truncate text-[12px] text-[#44586c]">{c.title || c.description}</p>
                  <p className="mt-0.5 text-[10.5px] text-[#8593a5]">
                    {c.topicTitle ? `${c.topicTitle} · ` : ''}
                    {c.executions} executions
                  </p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  <button type="button" className="sap-btn" onClick={() => void openProgramByName(c.name)}>
                    <FileCode2 className="h-3.5 w-3.5" />
                    Open in Editor
                  </button>
                  <button
                    type="button"
                    className="sap-btn sap-btn-primary"
                    onClick={async () => {
                      await openProgramByName(c.name)
                      useWorkbench.getState().runProgram(c.name)
                    }}
                    title="Execute class report"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Execute
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
