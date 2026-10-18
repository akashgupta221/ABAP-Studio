'use client'

// ── SAP ALV Grid (cl_salv_table / REUSE_ALV style) ────────────────────
import { useMemo, useState } from 'react'
import { Download, Filter } from 'lucide-react'
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
  const [selectedRow, setSelectedRow] = useState<Record<string, string> | null>(null)

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
    <div className="flex h-full min-h-0 flex-col border border-[#9fb1c5] bg-white">
      {/* ALV title strip */}
      {alv.title && (
        <div className="alv-title flex h-[22px] shrink-0 items-center px-2 text-[12px]">
          <span className="truncate">{alv.title}</span>
        </div>
      )}

      {/* ALV toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[#b4c4d6] bg-[#eef2f7] px-1.5 py-[3px]">
        <span className="text-[11.5px] text-[#33475c]">
          {rows.length} of {alv.totalRows} rows
        </span>
        <div className="sap-toolbar-sep" />
        <div className="flex items-center gap-1">
          <Filter className="h-3.5 w-3.5 shrink-0 text-[#33475c]" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter rows…"
            className="sap-field w-36 text-[12px]"
            aria-label="Filter ALV rows"
          />
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" className="sap-tool-btn" onClick={exportCsv} title="Export to CSV (spreadsheet)">
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* grid */}
      <div className="wb-scroll min-h-0 flex-1 overflow-auto">
        <table className="alv-grid w-full border-collapse text-[12px]">
          <thead>
            <tr>
              {columns.map((c) => {
                const numeric = isNumericType(c.type)
                const active = sortCol === c.name
                return (
                  <th
                    key={c.name}
                    onClick={() => onHeaderClick(c.name)}
                    className="cursor-pointer px-1.5 py-1 text-left select-none"
                    style={{ textAlign: numeric ? 'right' : 'left' }}
                    title={`${c.name} (${c.type}${c.length ? `, len ${c.length}` : ''}) — click to sort`}
                  >
                    <span className={`inline-flex items-baseline gap-1 ${numeric ? 'flex-row-reverse' : ''}`}>
                      {c.label || c.name}
                      {active && (
                        <span className="text-[9px] text-[#0a2f57]">{sortDir === 'asc' ? '▲' : '▼'}</span>
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
                <td colSpan={Math.max(1, columns.length)} className="px-3 py-6 text-center text-[12px] text-[#5b6d80]">
                  No rows match the filter.
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr
                key={i}
                data-selected={selectedRow === row ? 'true' : undefined}
                onClick={() => setSelectedRow(row)}
                className="cursor-pointer"
              >
                {columns.map((c) => {
                  const numeric = isNumericType(c.type)
                  return (
                    <td
                      key={c.name}
                      className={`h-5 px-1.5 py-0.5 leading-4 ${numeric ? 'text-right font-mono tabular-nums' : ''}`}
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
      <div className="flex shrink-0 items-center justify-between border-t border-[#c5d2e2] bg-[#eef2f8] px-2 py-[3px] text-[11px] text-[#33475c]">
        <span>
          {alv.totalRows} entries · {columns.length} columns
        </span>
        <span className="font-mono">ALV Grid Display</span>
      </div>
    </div>
  )
}
