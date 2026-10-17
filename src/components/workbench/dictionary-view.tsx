'use client'

// ── ABAP Data Dictionary (SE11) ───────────────────────────────────────
import { useEffect, useState } from 'react'
import { ArrowLeft, Database, KeyRound, Search, Table2 } from 'lucide-react'
import { useWorkbench, api } from './use-workbench'
import type { DdicField, DdicTable, TableDetail } from './types'

export function DictionaryView() {
  const openBrowserFor = useWorkbench((s) => s.openBrowserFor)
  const [tables, setTables] = useState<DdicTable[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<TableDetail | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    api<{ tables: DdicTable[] }>('/api/tables')
      .then((r) => setTables(r.tables))
      .catch(() => setTables([]))
  }, [])

  const loadDetail = async (name: string) => {
    setSelected(name)
    setDetail(null)
    try {
      const r = await api<TableDetail>(`/api/tables/${encodeURIComponent(name)}?page=1&pageSize=5`)
      setDetail(r)
    } catch {
      setDetail(null)
    }
  }

  const f = filter.trim().toUpperCase()
  const list = (tables ?? []).filter(
    (t) => !f || t.name.includes(f) || t.description.toUpperCase().includes(f),
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f4f9]">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#c3d0e0] bg-white px-4 py-2.5">
        <Database className="h-5 w-5 text-[#8a6d1a]" />
        <div>
          <h1 className="text-[14px] font-bold text-[#12283c]">ABAP Data Dictionary (SE11)</h1>
          <p className="text-[11.5px] text-[#7b8a9c]">
            Simulated DDIC — training tables from the SFLIGHT flight model and friends
          </p>
        </div>
        {selected && (
          <button type="button" className="sap-btn ml-auto" onClick={() => setSelected(null)}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to table list
          </button>
        )}
      </div>

      {!selected ? (
        /* table list */
        <div className="wb-scroll min-h-0 flex-1 overflow-auto p-4">
          <div className="mx-auto max-w-[1000px]">
            <div className="mb-2 flex items-center gap-2 rounded-[3px] border border-[#7f9db9] bg-white px-2 py-1.5">
              <Search className="h-3.5 w-3.5 text-[#7f9db9]" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter tables…"
                className="h-[24px] w-full bg-transparent font-mono text-[12px] outline-none placeholder:font-sans placeholder:text-[#9aa8b8]"
                aria-label="Filter tables"
              />
            </div>
            {tables === null && (
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-9 animate-pulse rounded-[4px] bg-[#e2e9f2]" />
                ))}
              </div>
            )}
            {tables !== null && tables.length === 0 && (
              <p className="rounded-[4px] border border-dashed border-[#c3d0e0] bg-white px-4 py-8 text-center text-[13px] text-[#8593a5]">
                No tables in the dictionary yet — the seeder may still be running.
              </p>
            )}
            <div className="overflow-hidden rounded-[4px] border border-[#c3d0e0] bg-white shadow-sm">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="alv-grid">
                    <th className="px-3 py-1.5 text-left text-[11.5px]">Table</th>
                    <th className="px-3 py-1.5 text-left text-[11.5px]">Short description</th>
                    <th className="px-3 py-1.5 text-right text-[11.5px]">Fields</th>
                    <th className="px-3 py-1.5 text-right text-[11.5px]">Entries</th>
                    <th className="px-3 py-1.5 text-center text-[11.5px]">Origin</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((t) => (
                    <tr
                      key={t.name}
                      className="cursor-pointer border-b border-[#eef2f7] hover:bg-[#e7f0fb]"
                      onClick={() => void loadDetail(t.name)}
                    >
                      <td className="px-3 py-1.5 font-mono font-bold text-[#0a3d73]">{t.name}</td>
                      <td className="px-3 py-1.5 text-[#44586c]">{t.description}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{t.fieldCount}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{t.rowCount}</td>
                      <td className="px-3 py-1.5 text-center">
                        <span
                          className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${
                            t.isSap
                              ? 'border-[#bcd8f6] bg-[#e9f2fc] text-[#0a3d73]'
                              : 'border-[#d8c8ec] bg-[#f5effc] text-[#5d3a8e]'
                          }`}
                        >
                          {t.isSap ? 'SAP' : 'Training'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* field catalog of one table */
        <div className="wb-scroll min-h-0 flex-1 overflow-auto p-4">
          <div className="mx-auto max-w-[1000px]">
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-[4px] border border-[#c3d0e0] bg-white px-4 py-2.5 shadow-sm">
              <Table2 className="h-5 w-5 text-[#8a6d1a]" />
              <div>
                <h2 className="font-mono text-[15px] font-bold text-[#12283c]">{selected}</h2>
                <p className="text-[12px] text-[#7b8a9c]">{detail?.table.description ?? ''}</p>
              </div>
              <button
                type="button"
                className="sap-btn sap-btn-primary ml-auto"
                onClick={() => openBrowserFor(selected)}
                title="Open contents in the Data Browser"
              >
                <Table2 className="h-3.5 w-3.5" />
                Display Data (SE16)
              </button>
            </div>

            <div className="overflow-hidden rounded-[4px] border border-[#c3d0e0] bg-white shadow-sm">
              <div className="border-b border-[#d8e1ec] bg-[#eef2f8] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#3f5468]">
                Field catalog — {detail?.fields.length ?? '…'} fields
              </div>
              {detail === null ? (
                <div className="space-y-1.5 p-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-6 animate-pulse rounded-sm bg-[#eef2f7]" />
                  ))}
                </div>
              ) : (
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="alv-grid">
                      <th className="w-16 px-2 py-1.5 text-center text-[11.5px]">Pos</th>
                      <th className="px-2 py-1.5 text-left text-[11.5px]">Field</th>
                      <th className="w-14 px-2 py-1.5 text-center text-[11.5px]">Key</th>
                      <th className="w-24 px-2 py-1.5 text-left text-[11.5px]">Data type</th>
                      <th className="w-16 px-2 py-1.5 text-right text-[11.5px]">Length</th>
                      <th className="w-16 px-2 py-1.5 text-right text-[11.5px]">Decimals</th>
                      <th className="px-2 py-1.5 text-left text-[11.5px]">Short text</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.fields.map((fld: DdicField, i: number) => (
                      <tr key={fld.name} className="border-b border-[#eef2f7] hover:bg-[#e7f0fb]">
                        <td className="px-2 py-1 text-center font-mono text-[#7b8a9c]">{i + 1}</td>
                        <td className="px-2 py-1 font-mono font-semibold text-[#12283c]">{fld.name}</td>
                        <td className="px-2 py-1 text-center">
                          {fld.key ? (
                            <span title="Key field">
                              <KeyRound className="mx-auto h-3.5 w-3.5 text-[#8a6d1a]" />
                            </span>
                          ) : (
                            <span className="text-[#d3dde8]">·</span>
                          )}
                        </td>
                        <td className="px-2 py-1 font-mono text-[#0a6e6e]">{fld.type}</td>
                        <td className="px-2 py-1 text-right font-mono">{fld.length}</td>
                        <td className="px-2 py-1 text-right font-mono">{fld.decimals || ''}</td>
                        <td className="px-2 py-1 text-[#44586c]">{fld.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* data preview (first 5 rows) */}
            {detail && detail.rows.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-[4px] border border-[#c3d0e0] bg-white shadow-sm">
                <div className="border-b border-[#d8e1ec] bg-[#eef2f8] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#3f5468]">
                  Preview — first {detail.rows.length} of {detail.total} entries
                </div>
                <div className="wb-scroll overflow-auto">
                  <table className="alv-grid w-full border-collapse text-[12px]">
                    <thead>
                      <tr>
                        {detail.fields.map((fld) => (
                          <th key={fld.name} className="px-2 py-1 text-left text-[11px]">
                            {fld.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.rows.map((row, i) => (
                        <tr key={i}>
                          {detail.fields.map((fld) => (
                            <td
                              key={fld.name}
                              className={`px-2 py-[3px] whitespace-nowrap ${fld.key ? 'font-mono font-bold text-[#12283c]' : ''}`}
                            >
                              {String(row[fld.name] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
