'use client'

// ── Data Browser (SE16) with per-field selection criteria (SE16N) ─────
import { useCallback, useEffect, useState } from 'react'
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Database, FilterX, Plus, Search, Table2, Trash2,
} from 'lucide-react'
import { useWorkbench, api } from './use-workbench'
import type { DdicTable, TableDetail } from './types'

const SELECTION_OPS = ['EQ', 'NE', 'GT', 'LT', 'GE', 'LE', 'BT', 'CP'] as const
type SelectionOp = (typeof SELECTION_OPS)[number]

interface Criterion {
  field: string
  op: SelectionOp
  low: string
  high: string
}

const EMPTY_CRITERION: Criterion = { field: '', op: 'EQ', low: '', high: '' }

function criteriaToFilters(criteria: Criterion[]): string | undefined {
  const valid = criteria
    .filter((c) => c.field && (c.low || c.op === 'CP'))
    .map((c) => (c.op === 'BT' ? { field: c.field, op: c.op, low: c.low, high: c.high } : { field: c.field, op: c.op, low: c.low }))
  return valid.length > 0 ? JSON.stringify(valid) : undefined
}

export function DataBrowserView() {
  const presetTable = useWorkbench((s) => s.browserTable)
  const [tableList, setTableList] = useState<DdicTable[]>([])
  const [table, setTable] = useState(presetTable ?? '')
  const [applied, setApplied] = useState(presetTable ?? '')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<TableDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [criteria, setCriteria] = useState<Criterion[]>([])

  useEffect(() => {
    api<{ tables: DdicTable[] }>('/api/tables')
      .then((r) => setTableList(r.tables))
      .catch(() => setTableList([]))
  }, [])

  // react to command field / navigator selections
  useEffect(() => {
    if (presetTable && presetTable !== table) {
      setTable(presetTable)
      setApplied(presetTable)
      setPage(1)
      setCriteria([])
    }
  }, [presetTable, table])

  const load = useCallback(
    async (tableName: string, pageNo: number, query: string, crits: Criterion[]) => {
      const name = tableName.trim().toUpperCase()
      if (!name) return
      setLoading(true)
      setError(null)
      try {
        const filters = criteriaToFilters(crits)
        const r = await api<TableDetail>(
          `/api/tables/${encodeURIComponent(name)}?page=${pageNo}&pageSize=50&q=${encodeURIComponent(query)}` +
            (filters ? `&filters=${encodeURIComponent(filters)}` : ''),
        )
        setData(r)
      } catch (e) {
        setData(null)
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  // initial / preset load
  useEffect(() => {
    if (applied) void load(applied, 1, '', [])
  }, [applied, load])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  const gotoPage = (p: number) => {
    const np = Math.min(Math.max(1, p), totalPages)
    setPage(np)
    void load(applied, np, q, criteria)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setApplied(table.trim().toUpperCase())
    setPage(1)
    setQ('')
    setCriteria([])
    void load(table.trim().toUpperCase(), 1, '', [])
  }

  const submitFilter = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    void load(applied, 1, q, criteria)
  }

  const submitCriteria = () => {
    setPage(1)
    void load(applied, 1, q, criteria)
  }

  const updateCriterion = (idx: number, patch: Partial<Criterion>) => {
    setCriteria((cs) => cs.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#ebf1f7]">
      {/* header */}
      <div className="border-b border-[#c6d7e6] bg-white px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <Table2 className="h-5 w-5 text-[#8a6d1a]" />
          <div>
            <h1 className="text-[14px] font-bold text-[#17324a]">Data Browser (SE16)</h1>
            <p className="text-[11.5px] text-[#55677a]">Display table contents of the training database</p>
          </div>
        </div>
        <form onSubmit={submit} className="mt-2 flex flex-wrap items-center gap-2">
          <label htmlFor="se16-table" className="text-[12px] font-medium text-[#44586c]">
            Table
          </label>
          <input
            id="se16-table"
            list="se16-tables"
            value={table}
            onChange={(e) => setTable(e.target.value.toUpperCase())}
            placeholder="e.g. SFLIGHT"
            className="h-[28px] w-[220px] rounded-none border border-[#a8c0d6] bg-white px-2 font-mono text-[12.5px] uppercase outline-none focus:border-[#0a6ed1]"
            aria-label="Table name"
          />
          <datalist id="se16-tables">
            {tableList.map((t) => (
              <option key={t.name} value={t.name}>
                {t.description}
              </option>
            ))}
          </datalist>
          <button type="submit" className="sap-btn sap-btn-primary">
            <Table2 className="h-3.5 w-3.5" />
            Display
          </button>
          {data && (
            <span className="text-[12px] text-[#44586c]">
              <span className="font-semibold">{data.table.description}</span>
            </span>
          )}
        </form>
      </div>

      {/* selection criteria (SE16N-style per-field options) */}
      {applied && data && (
        <div className="border-b border-[#c6d7e6] bg-white px-4 py-2">
          <div className="mx-auto max-w-[1200px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-semibold text-[#44586c]">Selection Criteria</span>
              <span className="text-[11px] text-[#55677a]">
                Field · Option (EQ, NE, GT, LT, GE, LE, BT, CP with * wildcard) · Value
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  className="sap-btn"
                  onClick={() => setCriteria((cs) => (cs.length < 10 ? [...cs, { ...EMPTY_CRITERION }] : cs))}
                  disabled={criteria.length >= 10}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Criterion
                </button>
                {criteria.length > 0 && (
                  <button
                    type="button"
                    className="sap-btn"
                    title="Remove all criteria and reload the full table"
                    onClick={() => {
                      setCriteria([])
                      setPage(1)
                      void load(applied, 1, q, [])
                    }}
                  >
                    <FilterX className="h-3.5 w-3.5" />
                    Clear
                  </button>
                )}
                <button type="button" className="sap-btn sap-btn-primary" onClick={submitCriteria}>
                  <Table2 className="h-3.5 w-3.5" />
                  Execute (F8)
                </button>
              </div>
            </div>
            {criteria.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {criteria.map((c, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-1.5">
                    <select
                      className="h-[28px] w-[180px] rounded-none border border-[#a8c0d6] bg-white px-1 font-mono text-[12px] uppercase outline-none focus:border-[#0a6ed1]"
                      value={c.field}
                      onChange={(e) => updateCriterion(idx, { field: e.target.value.toUpperCase() })}
                      aria-label={`Criterion ${idx + 1}: field`}
                    >
                      <option value="">Field…</option>
                      {(data?.fields ?? []).map((f) => (
                        <option key={f.name} value={f.name}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-[28px] w-[72px] rounded-none border border-[#a8c0d6] bg-white px-1 font-mono text-[12px] outline-none focus:border-[#0a6ed1]"
                      value={c.op}
                      onChange={(e) => updateCriterion(idx, { op: e.target.value as SelectionOp })}
                      aria-label={`Criterion ${idx + 1}: option`}
                    >
                      {SELECTION_OPS.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                    <input
                      className="h-[28px] w-[170px] rounded-none border border-[#a8c0d6] bg-white px-2 font-mono text-[12px] outline-none focus:border-[#0a6ed1]"
                      value={c.low}
                      onChange={(e) => updateCriterion(idx, { low: e.target.value })}
                      placeholder={c.op === 'CP' ? 'pattern e.g. AA*' : c.op === 'BT' ? 'Low' : 'Value'}
                      aria-label={`Criterion ${idx + 1}: low value`}
                    />
                    {c.op === 'BT' && (
                      <input
                        className="h-[28px] w-[170px] rounded-none border border-[#a8c0d6] bg-white px-2 font-mono text-[12px] outline-none focus:border-[#0a6ed1]"
                        value={c.high}
                        onChange={(e) => updateCriterion(idx, { high: e.target.value })}
                        placeholder="High"
                        aria-label={`Criterion ${idx + 1}: high value`}
                      />
                    )}
                    <button
                      type="button"
                      className="rounded-sm p-1 text-[#55677a] hover:bg-[#dbe8f8] hover:text-[#c4302f]"
                      onClick={() => setCriteria((cs) => cs.filter((_, i) => i !== idx))}
                      aria-label={`Remove criterion ${idx + 1}`}
                      title="Remove this criterion"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* data grid */}
      <div className="wb-scroll min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-[1200px]">
          {!applied && (
            <div className="flex flex-col items-center gap-2 rounded-none border border-dashed border-[#c6d7e6] bg-white px-6 py-12 text-center">
              <Database className="h-8 w-8 text-[#b4c4d6]" />
              <p className="text-[13px] font-medium text-[#44586c]">Enter a table name to display its contents</p>
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {tableList.slice(0, 12).map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    className="rounded-sm border border-[#c6d7e6] bg-white px-2 py-1 font-mono text-[11.5px] font-semibold text-[#17324a] hover:border-[#8fb0d4] hover:text-[#0a6ed1]"
                    onClick={() => {
                      setTable(t.name)
                      setApplied(t.name)
                      setPage(1)
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-none border-2 border-red-300 bg-[#fff5f5] px-4 py-3 text-[13px] text-red-800">
              {error}
            </div>
          )}

          {loading && (
            <div className="space-y-1.5">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-7 animate-pulse rounded-sm bg-[#e6eef7]" />
              ))}
            </div>
          )}

          {!loading && data && (
            <div className="overflow-hidden rounded-none border border-[#c6d7e6] bg-white">
              {/* toolbar */}
              <div className="flex flex-wrap items-center gap-2 border-b border-[#c6d7e6] bg-gradient-to-b from-[#eef2f8] to-[#dbe4ef] px-2 py-1.5">
                <span className="font-mono text-[13px] font-bold text-[#17324a]">{data.table.name}</span>
                <span className="text-[12px] text-[#44586c]">{data.table.description}</span>
                <form onSubmit={submitFilter} className="ml-auto flex items-center gap-1.5">
                  <div className="flex items-center gap-1 rounded-none border border-[#a8c0d6] bg-white px-1.5">
                    <Search className="h-3 w-3 text-[#55677a]" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search in table…"
                      className="h-[24px] w-40 bg-transparent text-[12px] outline-none placeholder:text-[#9aa8b8]"
                      aria-label="Search within table contents"
                    />
                  </div>
                  <button type="submit" className="sap-btn">
                    Find
                  </button>
                </form>
              </div>

              {/* table */}
              <div className="wb-scroll overflow-auto">
                <table className="alv-grid w-full border-collapse text-[12.5px]">
                  <thead>
                    <tr>
                      <th className="w-10 px-2 py-1 text-center text-[11px]">#</th>
                      {data.fields.map((fld) => (
                        <th
                          key={fld.name}
                          className="px-2 py-1 text-left text-[11.5px]"
                          title={`${fld.name} · ${fld.type}(${fld.length}) — ${fld.text}`}
                        >
                          {fld.key ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#8a6d1a]" title="Key field" />
                              {fld.name}
                            </span>
                          ) : (
                            fld.name
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.length === 0 && (
                      <tr>
                        <td colSpan={data.fields.length + 1} className="px-3 py-8 text-center text-[13px] text-[#55677a]">
                          No entries found{q ? ` for "${q}"` : ''}.
                        </td>
                      </tr>
                    )}
                    {data.rows.map((row, i) => (
                      <tr key={i}>
                        <td className="px-2 py-[3px] text-center font-mono text-[11px] text-[#93a9c2]">
                          {(data.page - 1) * data.pageSize + i + 1}
                        </td>
                        {data.fields.map((fld) => (
                          <td
                            key={fld.name}
                            className={`whitespace-nowrap px-2 py-[3px] ${fld.key ? 'font-mono font-bold text-[#17324a]' : ''}`}
                          >
                            {String(row[fld.name] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* footer pagination */}
              <div className="flex flex-wrap items-center gap-2 border-t border-[#c6d7e6] bg-[#edf3fa] px-2 py-1.5 text-[11.5px] text-[#44586c]">
                <span>
                  {data.total} entries · page {data.page}/{totalPages}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <button type="button" className="sap-btn !px-1.5" disabled={data.page <= 1} onClick={() => gotoPage(1)} title="First page" aria-label="First page">
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className="sap-btn !px-1.5" disabled={data.page <= 1} onClick={() => gotoPage(data.page - 1)} title="Previous page" aria-label="Previous page">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-1 font-mono">
                    {data.page} / {totalPages}
                  </span>
                  <button type="button" className="sap-btn !px-1.5" disabled={data.page >= totalPages} onClick={() => gotoPage(data.page + 1)} title="Next page" aria-label="Next page">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className="sap-btn !px-1.5" disabled={data.page >= totalPages} onClick={() => gotoPage(totalPages)} title="Last page" aria-label="Last page">
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
