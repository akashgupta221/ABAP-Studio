'use client'

// ── Function Builder (SE37) ───────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, FunctionSquare, Table2 } from 'lucide-react'
import { useWorkbench, api } from './use-workbench'
import { AbapSourceView } from './abap-editor'
import type { FmParam, FunctionModule } from './types'

function ParamTable({
  title, icon, params,
}: {
  title: string
  icon: React.ReactNode
  params: FmParam[]
}) {
  if (!params || params.length === 0) return null
  return (
    <div className="overflow-hidden rounded-[4px] border border-[#c3d0e0] bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-[#d8e1ec] bg-[#eef2f8] px-3 py-1.5">
        {icon}
        <span className="text-[11.5px] font-bold uppercase tracking-wide text-[#3f5468]">{title}</span>
        <span className="ml-auto rounded-sm border border-[#c5d2e2] bg-white px-1.5 text-[10.5px] font-semibold text-[#5b6d80]">
          {params.length}
        </span>
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="alv-grid">
            <th className="px-2 py-1 text-left text-[11px]">Parameter</th>
            <th className="px-2 py-1 text-left text-[11px]">Type</th>
            <th className="px-2 py-1 text-left text-[11px]">Optional</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr key={i} className="border-b border-[#eef2f7] hover:bg-[#e7f0fb]">
              <td className="px-2 py-1 font-mono font-semibold text-[#12283c]">{String(p.name ?? '')}</td>
              <td className="px-2 py-1 font-mono text-[#0a6e6e]">{String(p.type ?? p.kind ?? '')}</td>
              <td className="px-2 py-1 text-[#7b8a9c]">{p.optional ? 'yes' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function FunctionBuilderView() {
  const selected = useWorkbench((s) => s.selectedFunction)
  const setSelected = useWorkbench((s) => s.setSelectedFunction)

  const [fms, setFms] = useState<FunctionModule[] | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    api<{ functions: FunctionModule[] }>('/api/functions')
      .then((r) => setFms(r.functions))
      .catch(() => setFms([]))
  }, [])

  // auto-select when arriving via navigator/search/command field
  useEffect(() => {
    if (selected && fms && !fms.some((fm) => fm.name === selected)) {
      // stale selection — leave as-is, list will show empty detail
    }
  }, [selected, fms])

  const current = useMemo(() => fms?.find((fm) => fm.name === selected) ?? null, [fms, selected])

  const f = filter.trim().toUpperCase()
  const list = (fms ?? []).filter(
    (fm) => !f || fm.name.includes(f) || (fm.title ?? '').toUpperCase().includes(f) || fm.groupName.toUpperCase().includes(f),
  )

  const groups = useMemo(() => {
    const m = new Map<string, FunctionModule[]>()
    for (const fm of list) {
      const arr = m.get(fm.groupName) ?? []
      arr.push(fm)
      m.set(fm.groupName, arr)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [list])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f4f9]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#c3d0e0] bg-white px-4 py-2.5">
        <FunctionSquare className="h-5 w-5 text-[#5d3a8e]" />
        <div>
          <h1 className="text-[14px] font-bold text-[#12283c]">Function Builder (SE37)</h1>
          <p className="text-[11.5px] text-[#7b8a9c]">
            Global function modules of the training function groups — read-only, callable from ABAP
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* left: FM list */}
        <div className="wb-scroll w-[280px] shrink-0 overflow-auto border-r border-[#c3d0e0] bg-white">
          <div className="sticky top-0 z-10 border-b border-[#d8e1ec] bg-white p-1.5">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter function modules…"
              className="h-[26px] w-full rounded-[3px] border border-[#7f9db9] px-2 font-mono text-[11.5px] outline-none placeholder:font-sans placeholder:text-[#9aa8b8]"
              aria-label="Filter function modules"
            />
          </div>
          {fms === null && (
            <div className="space-y-1.5 p-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-5 animate-pulse rounded-sm bg-[#eef2f7]" />
              ))}
            </div>
          )}
          {fms !== null && fms.length === 0 && (
            <p className="p-3 text-[11.5px] italic text-[#9aa8b8]">
              No function modules — content may still be seeding.
            </p>
          )}
          {groups.map(([groupName, items]) => (
            <div key={groupName} className="border-b border-[#f0f4f9] pb-1">
              <p className="px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide text-[#8593a5]">
                Group {groupName}
              </p>
              {items.map((fm) => (
                <button
                  key={fm.id}
                  type="button"
                  onClick={() => setSelected(fm.name)}
                  className={`sap-tree-row w-full ${selected === fm.name ? '!bg-[#bcd8f6] !font-semibold' : ''}`}
                  title={fm.title || fm.name}
                >
                  <FunctionSquare className="h-3.5 w-3.5 shrink-0 text-[#5d3a8e]" />
                  <span className="truncate font-mono">{fm.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* right: detail */}
        <div className="wb-scroll min-w-0 flex-1 overflow-auto p-3">
          {!current && (
            <div className="flex h-full items-center justify-center text-[13px] text-[#7b8a9c]">
              Select a function module from the list
            </div>
          )}
          {current && (
            <div className="space-y-3">
              <div className="rounded-[4px] border border-[#c3d0e0] bg-white px-4 py-2.5 shadow-sm">
                <h2 className="font-mono text-[15px] font-bold text-[#12283c]">{current.name}</h2>
                <p className="text-[12.5px] text-[#44586c]">{current.title}</p>
                <p className="mt-1 text-[11px] text-[#7b8a9c]">
                  Function group <span className="font-mono font-semibold">{current.groupName}</span>
                  {current.isExample && ' · example module'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <ParamTable title="Importing" icon={<ArrowDownToLine className="h-3.5 w-3.5 text-[#0a6ed1]" />} params={current.importParams} />
                <ParamTable title="Exporting" icon={<ArrowUpFromLine className="h-3.5 w-3.5 text-[#0a8a5f]" />} params={current.exportParams} />
                <ParamTable title="Changing" icon={<ArrowLeftRight className="h-3.5 w-3.5 text-[#8a6d1a]" />} params={current.changingParams} />
                <ParamTable title="Tables" icon={<Table2 className="h-3.5 w-3.5 text-[#8a6d1a]" />} params={current.tablesParams} />
              </div>

              <div className="overflow-hidden rounded-[4px] border border-[#c3d0e0] bg-white shadow-sm">
                <div className="border-b border-[#d8e1ec] bg-[#eef2f8] px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-wide text-[#3f5468]">
                  Source code (read-only)
                </div>
                <div className="h-[380px]">
                  <AbapSourceView source={current.source || '* no source'} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
