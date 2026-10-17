'use client'

// ── SAP ALV Grid (cl_salv_table / REUSE_ALV style) ────────────────────
import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Filter, Table2 } from 'lucide-react'
import type { AlvGrid } from './types'

const NUMERIC_TYPES = new Set([
  'I', 'INT1', 'INT2', 'INT4', 'INT8', 'F', 'P', 'N', 'DEC', 'QUAN', 'CURR', 'D16D', 'D34D',
])

function isNumericType(type: string): boolean {
  const t = type.toUpperCase()
  return NUMERIC_TYPES.has(t) || t.startsWith('INT') || t.startsWith('DEC')
}

export function AlvGridPanel({ alv }: { alv: AlvGrid }) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filter, setFilter] = useState('')

  const columns = useMemo(() => alv.columns.filter((c) => c.visible), [alv.columns])

  const rows = useMemo(() => {
    let r = [...alv.rows]
    if (filter) {
      const f = filter.toLowerCase()
      r = r.filter((row) => columns.some((c) => String(row[c.name] ?? '').toLowerCase().includes(f)))
    }
    if (sortCol) {
      const col = columns.find((c) => c.name === sortCol)
      const numeric = col ? isNumericType(col.type) : false
      r.sort((a, b) => {
        const av = String(a[sortCol] ?? '')
        const bv = String(b[sortCol] ?? '')
        let cmp: number
        if (numeric) {
          const an = parseFloat(av.replace(/\s/g, '').replace(',', '.')) || 0
          const bn = parseFloat(bv.replace(/\s/g, '').replace(',', '.')) || 0
          cmp = an - bn
        } else {
          cmp = av.localeCompare(bv)
        }
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return r
  }, [alv.rows, columns, filter, sortCol, sortDir])

  const onHeaderClick = (name: string) => {
    if (sortCol === name) {
      if (sortDir === 'asc') setSortDir('desc')
      else {
        setSortCol(null)
        setSortDir('asc')
      }
    } else {
      setSortCol(name)
      setSortDir('asc')
    }
  }

  const exportCsv = () => {
    const head = columns.map((c) => `"${(c.label || c.name).replace(/"/g, '""')}"`).join(';')
    const body = rows
      .map((r) =>
        columns.map((c) => `"${String(r[c.name] ?? '').replace(/"/g, '""')}"`).join(';'),
      )
      .join('\n')
    const csv = '\uFEFF' + head + '\n' + body
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `alv_export_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full min-h-0 flex-col border border-[#b6c6d9] bg-white">
      {/* ALV toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#c5d2e2] bg-gradient-to-b from-[#eef2f8] to-[#dbe4ef] px-2 py-1.5">
        <Table2 className="h-4 w-4 shrink-0 text-[#0a6ed1]" />
        <span className="truncate text-[13px] font-semibold text-[#1c3a5f]">{alv.title || 'ALV Grid'}</span>
        <span className="rounded-sm border border-[#c5d2e2] bg-white px-1.5 py-0.5 text-[11px] font-medium text-[#3f5468]">
          {rows.length} of {alv.totalRows} rows
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-[3px] border border-[#7f9db9] bg-white px-1.5">
            <Filter className="h-3 w-3 text-[#7f9db9]" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter rows…"
              className="h-[24px] w-32 bg-transparent text-[12px] outline-none placeholder:text-[#9aa8b8]"
              aria-label="Filter ALV rows"
            />
          </div>
          <button type="button" className="sap-btn" onClick={exportCsv} title="Export to CSV (spreadsheet)">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* grid */}
      <div className="wb-scroll min-h-0 flex-1 overflow-auto">
        <table className="alv-grid w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {columns.map((c) => {
                const numeric = isNumericType(c.type)
                const active = sortCol === c.name
                return (
                  <th
                    key={c.name}
                    onClick={() => onHeaderClick(c.name)}
                    className="cursor-pointer px-2 py-1.5 text-left text-[12px] select-none hover:bg-[#dbe4ef]"
                    style={{ textAlign: numeric ? 'right' : 'left' }}
                    title={`${c.name} (${c.type}${c.length ? `, len ${c.length}` : ''}) — click to sort`}
                  >
                    <span className={`inline-flex items-center gap-1 ${numeric ? 'flex-row-reverse' : ''}`}>
                      {c.label || c.name}
                      {active ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-[#0a6ed1]" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-[#0a6ed1]" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-[#9db0c4]" />
                      )}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={Math.max(1, columns.length)} className="px-3 py-6 text-center text-[13px] text-[#7b8a9c]">
                  No rows match the filter.
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => {
                  const numeric = isNumericType(c.type)
                  return (
                    <td
                      key={c.name}
                      className={`px-2 py-[3px] ${numeric ? 'text-right font-mono tabular-nums' : ''}`}
                      style={{ maxWidth: `${Math.max(10, c.length + 6)}ch` }}
                      title={String(row[c.name] ?? '')}
                    >
                      {numeric ? String(row[c.name] ?? '').trim() : String(row[c.name] ?? '')}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* footer */}
      <div className="flex items-center justify-between border-t border-[#c5d2e2] bg-[#eef2f8] px-2 py-1 text-[11px] font-medium text-[#3f5468]">
        <span>
          {alv.totalRows} entries · {columns.length} columns
        </span>
        <span className="font-mono">ALV Grid Display</span>
      </div>
    </div>
  )
}
