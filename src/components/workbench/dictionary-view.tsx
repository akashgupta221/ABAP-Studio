'use client'

// ── ABAP Data Dictionary (SE11) ───────────────────────────────────────
// SAP example tables are shared training content (read-only). The owner can
// create and maintain customer tables (Z*/Y*) — entries and field catalog —
// and every table is immediately usable in ABAP (the engine loads the whole
// dictionary into its runtime snapshot).
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Database, KeyRound, Pencil, Plus, Search, Table2, Trash2 } from 'lucide-react'
import { useWorkbench, api } from './use-workbench'
import type { DdicField, DdicTable, TableDetail } from './types'

interface FieldDraft {
  name: string
  type: string
  length: string
  decimals: string
  key: boolean
  text: string
}

const FIELD_TYPES = ['CHAR', 'NUMC', 'DEC', 'QUAN', 'CURR', 'INT4', 'INT2', 'INT1', 'DATS', 'TIMS', 'STR', 'RAW']

function emptyField(): FieldDraft {
  return { name: '', type: 'CHAR', length: '10', decimals: '', key: false, text: '' }
}

function FieldEditor(props: {
  fields: FieldDraft[]
  onChange: (fields: FieldDraft[]) => void
}) {
  const { fields, onChange } = props
  const set = (i: number, patch: Partial<FieldDraft>) => {
    onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  }
  return (
    <div className="overflow-hidden rounded-none border border-[#c6d7e6] bg-white">
      <div className="border-b border-[#dce6f0] bg-[#edf3fa] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#44586c]">
        Field catalog
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="alv-grid">
            <th className="w-10 px-1 py-1 text-center text-[11px]">#</th>
            <th className="px-1 py-1 text-left text-[11px]">Field name</th>
            <th className="w-24 px-1 py-1 text-left text-[11px]">Type</th>
            <th className="w-16 px-1 py-1 text-left text-[11px]">Length</th>
            <th className="w-16 px-1 py-1 text-left text-[11px]">Decimals</th>
            <th className="w-12 px-1 py-1 text-center text-[11px]">Key</th>
            <th className="px-1 py-1 text-left text-[11px]">Short text</th>
            <th className="w-8 px-1 py-1" />
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) => {
            const fixed = ['INT4', 'INT2', 'INT1', 'DATS', 'TIMS'].includes(f.type)
            const variable = f.type === 'STR'
            return (
              <tr key={i} className="border-b border-[#eef3f8]">
                <td className="px-1 py-[3px] text-center font-mono text-[#55677a]">{i + 1}</td>
                <td className="px-1 py-[3px]">
                  <input
                    value={f.name}
                    onChange={(e) => set(i, { name: e.target.value.toUpperCase() })}
                    className="h-[22px] w-full rounded-none border border-[#c6d7e6] bg-white px-1.5 font-mono text-[11.5px] uppercase outline-none focus:border-[#0a6ed1]"
                    aria-label={`Field ${i + 1} name`}
                  />
                </td>
                <td className="px-1 py-[3px]">
                  <select
                    value={f.type}
                    onChange={(e) => set(i, { type: e.target.value })}
                    className="h-[22px] w-full rounded-none border border-[#c6d7e6] bg-white px-1 font-mono text-[11.5px] outline-none"
                    aria-label={`Field ${i + 1} type`}
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-[3px]">
                  <input
                    value={fixed ? { INT4: '4', INT2: '2', INT1: '1', DATS: '8', TIMS: '6' }[f.type] : variable ? '' : f.length}
                    disabled={fixed || variable}
                    onChange={(e) => set(i, { length: e.target.value })}
                    className="h-[22px] w-full rounded-none border border-[#c6d7e6] bg-white px-1.5 text-right font-mono text-[11.5px] outline-none disabled:bg-[#f0f4f8]"
                    aria-label={`Field ${i + 1} length`}
                  />
                </td>
                <td className="px-1 py-[3px]">
                  <input
                    value={f.decimals}
                    disabled={!['DEC', 'QUAN', 'CURR'].includes(f.type)}
                    onChange={(e) => set(i, { decimals: e.target.value })}
                    className="h-[22px] w-full rounded-none border border-[#c6d7e6] bg-white px-1.5 text-right font-mono text-[11.5px] outline-none disabled:bg-[#f0f4f8]"
                    aria-label={`Field ${i + 1} decimals`}
                  />
                </td>
                <td className="px-1 py-[3px] text-center">
                  <input
                    type="checkbox"
                    checked={f.key}
                    onChange={(e) => set(i, { key: e.target.checked })}
                    aria-label={`Field ${i + 1} key`}
                  />
                </td>
                <td className="px-1 py-[3px]">
                  <input
                    value={f.text}
                    onChange={(e) => set(i, { text: e.target.value })}
                    className="h-[22px] w-full rounded-none border border-[#c6d7e6] bg-white px-1.5 text-[11.5px] outline-none focus:border-[#0a6ed1]"
                    aria-label={`Field ${i + 1} short text`}
                  />
                </td>
                <td className="px-1 py-[3px] text-center">
                  {fields.length > 1 && (
                    <button
                      type="button"
                      className="text-[#a33] hover:text-[#c33]"
                      onClick={() => onChange(fields.filter((_, j) => j !== i))}
                      aria-label={`Remove field ${i + 1}`}
                      title="Remove field"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="border-t border-[#dce6f0] px-2 py-1.5">
        <button type="button" className="sap-btn" onClick={() => onChange([...fields, emptyField()])}>
          <Plus className="h-3 w-3" />
          Add field
        </button>
      </div>
    </div>
  )
}

function draftsFromFields(fields: DdicField[] | undefined): FieldDraft[] {
  if (!fields || fields.length === 0) return [emptyField()]
  return fields.map((f) => ({
    name: f.name,
    type: f.type,
    length: f.length === null || f.length === undefined ? '' : String(f.length),
    decimals: f.decimals === null || f.decimals === undefined ? '' : String(f.decimals),
    key: !!f.key,
    text: f.text ?? '',
  }))
}

export function DictionaryView() {
  const openBrowserFor = useWorkbench((s) => s.openBrowserFor)
  const [tables, setTables] = useState<DdicTable[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<TableDetail | null>(null)
  const [filter, setFilter] = useState('')
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view')
  const [draftName, setDraftName] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [draftFields, setDraftFields] = useState<FieldDraft[]>([emptyField()])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [rows, setRows] = useState<{ seq: number; data: Record<string, string> }[] | null>(null)
  const [newRow, setNewRow] = useState<Record<string, string>>({})

  const refreshList = useCallback(() => {
    api<{ tables: DdicTable[] }>('/api/tables')
      .then((r) => setTables(r.tables))
      .catch(() => setTables([]))
  }, [])

  useEffect(() => {
    refreshList()
  }, [refreshList])

  const loadDetail = async (name: string) => {
    setSelected(name)
    setDetail(null)
    setMode('view')
    setMsg(null)
    try {
      const r = await api<TableDetail>(`/api/tables/${encodeURIComponent(name)}?page=1&pageSize=5`)
      setDetail(r)
    } catch {
      setDetail(null)
    }
  }

  const loadRows = useCallback(async (name: string) => {
    try {
      const r = await api<{ rows: { seq: number; data: Record<string, string> }[] }>(`/api/tables/${encodeURIComponent(name)}/rows`)
      setRows(r.rows)
    } catch {
      setRows(null)
    }
  }, [])

  useEffect(() => {
    if (selected) void loadRows(selected)
    else setRows(null)
  }, [selected, loadRows])

  const openCreate = () => {
    setDraftName('')
    setDraftDesc('')
    setDraftFields([emptyField()])
    setMode('create')
    setSelected(null)
    setMsg(null)
  }

  const openEdit = () => {
    if (!selected) return
    setDraftName(selected)
    setDraftDesc(detail?.table.description ?? '')
    setDraftFields(draftsFromFields(detail?.fields))
    setMode('edit')
    setMsg(null)
  }

  const buildPayload = () => ({
    name: draftName,
    description: draftDesc,
    fields: draftFields.map((f) => ({
      name: f.name,
      type: f.type,
      length: ['INT4', 'INT2', 'INT1', 'DATS', 'TIMS'].includes(f.type)
        ? undefined
        : f.type === 'STR'
          ? undefined
          : f.length === '' ? undefined : Number(f.length),
      decimals: ['DEC', 'QUAN', 'CURR'].includes(f.type) && f.decimals !== '' ? Number(f.decimals) : undefined,
      key: f.key,
      text: f.text,
    })),
  })

  const saveTable = async () => {
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'create') {
        await api('/api/tables', { method: 'POST', body: JSON.stringify(buildPayload()) })
        setMsg({ kind: 'ok', text: `Table ${draftName.toUpperCase()} created` })
        await loadDetail(draftName.toUpperCase())
        refreshList()
      } else {
        await api(`/api/tables/${encodeURIComponent(selected!)}`, { method: 'PUT', body: JSON.stringify(buildPayload()) })
        setMsg({ kind: 'ok', text: 'Table updated' })
        await loadDetail(selected!)
        refreshList()
      }
      setMode('view')
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Save failed' })
    } finally {
      setBusy(false)
    }
  }

  const deleteTable = async () => {
    if (!selected) return
    if (!window.confirm(`Delete table ${selected} and all its entries?`)) return
    setBusy(true)
    try {
      await api(`/api/tables/${encodeURIComponent(selected)}`, { method: 'DELETE' })
      setSelected(null)
      setDetail(null)
      refreshList()
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Delete failed' })
    } finally {
      setBusy(false)
    }
  }

  const addRow = async () => {
    if (!selected || !detail) return
    setBusy(true)
    try {
      await api(`/api/tables/${encodeURIComponent(selected)}/rows`, {
        method: 'POST',
        body: JSON.stringify({ data: newRow }),
      })
      setNewRow({})
      await Promise.all([loadRows(selected), loadDetail(selected)])
      refreshList()
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Could not add entry' })
    } finally {
      setBusy(false)
    }
  }

  const deleteRowBySeq = async (seq: number) => {
    if (!selected) return
    setBusy(true)
    try {
      await api(`/api/tables/${encodeURIComponent(selected)}/rows?seq=${seq}`, { method: 'DELETE' })
      await Promise.all([loadRows(selected), loadDetail(selected)])
      refreshList()
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Could not delete entry' })
    } finally {
      setBusy(false)
    }
  }

  const f = filter.trim().toUpperCase()
  const list = (tables ?? []).filter(
    (t) => !f || t.name.includes(f) || t.description.toUpperCase().includes(f),
  )
  const editable = !!detail && detail.table.isSap === false

  const formView = (
    <div className="wb-scroll min-h-0 flex-1 overflow-auto p-4">
      <div className="mx-auto max-w-[1000px] space-y-3">
        <div className="rounded-none border border-[#c6d7e6] bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <Table2 className="h-5 w-5 text-[#8a6d1a]" />
            <h2 className="text-[14px] font-bold text-[#17324a]">
              {mode === 'create' ? 'Create Dictionary Table (SE11)' : `Maintain Table ${draftName}`}
            </h2>
            <button type="button" className="sap-btn ml-auto" onClick={() => (selected ? void loadDetail(selected) : setMode('view'))}>
              Cancel
            </button>
            <button type="button" className="sap-btn sap-btn-primary" disabled={busy} onClick={() => void saveTable()}>
              {busy ? 'Saving…' : mode === 'create' ? 'Create (Activate)' : 'Save'}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-[140px_1fr] items-center gap-2">
            <label className="text-[12px] font-semibold text-[#44586c]" htmlFor="ddic-table-name">Table name</label>
            <input
              id="ddic-table-name"
              value={draftName}
              disabled={mode === 'edit'}
              onChange={(e) => setDraftName(e.target.value.toUpperCase())}
              placeholder="Z_MY_TABLE (customer namespace: Z*/Y*)"
              className="h-[26px] w-full max-w-[320px] rounded-none border border-[#c6d7e6] bg-white px-2 font-mono text-[12px] uppercase outline-none focus:border-[#0a6ed1] disabled:bg-[#f0f4f8]"
            />
            <label className="text-[12px] font-semibold text-[#44586c]" htmlFor="ddic-table-desc">Short description</label>
            <input
              id="ddic-table-desc"
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              placeholder="What the table stores"
              className="h-[26px] w-full max-w-[560px] rounded-none border border-[#c6d7e6] bg-white px-2 text-[12px] outline-none focus:border-[#0a6ed1]"
            />
          </div>
        </div>
        <FieldEditor fields={draftFields} onChange={setDraftFields} />
        <p className="text-[11.5px] text-[#55677a]">
          After activation the table is part of the dictionary: write ABAP like
          <code className="mx-1 rounded-sm bg-[#eef2f7] px-1 font-mono text-[11px]">DATA wa TYPE {draftName.toUpperCase() || 'Z_MY_TABLE'}.</code>
          or
          <code className="mx-1 rounded-sm bg-[#eef2f7] px-1 font-mono text-[11px]">SELECT * FROM {draftName.toUpperCase() || 'Z_MY_TABLE'}.</code>
          and browse it in SE16.
        </p>
      </div>
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#ebf1f7]">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#c6d7e6] bg-white px-4 py-2.5">
        <Database className="h-5 w-5 text-[#8a6d1a]" />
        <div>
          <h1 className="text-[14px] font-bold text-[#17324a]">ABAP Data Dictionary (SE11)</h1>
          <p className="text-[11.5px] text-[#55677a]">
            Simulated DDIC — SAP flight-model tables (read-only) plus customer tables Z*/Y* you can create and maintain
          </p>
        </div>
        {mode === 'view' && !selected && (
          <button type="button" className="sap-btn sap-btn-primary ml-auto" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Create Table
          </button>
        )}
        {mode === 'view' && selected && (
          <button type="button" className="sap-btn ml-auto" onClick={() => setSelected(null)}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to table list
          </button>
        )}
      </div>

      {msg && (
        <div
          className={`px-4 py-1.5 text-[12px] ${msg.kind === 'ok' ? 'border-b border-[#cfe3cf] bg-[#eef7ee] text-[#22632a]' : 'border-b border-[#e6c9c9] bg-[#f9eeee] text-[#8a2222]'}`}
          role="status"
        >
          {msg.text}
        </div>
      )}

      {mode !== 'view' ? (
        formView
      ) : !selected ? (
        /* table list */
        <div className="wb-scroll min-h-0 flex-1 overflow-auto p-4">
          <div className="mx-auto max-w-[1000px]">
            <div className="mb-2 flex items-center gap-2 rounded-none border border-[#a8c0d6] bg-white px-2 py-1.5">
              <Search className="h-3.5 w-3.5 text-[#55677a]" />
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
                  <div key={i} className="h-9 animate-pulse rounded-none bg-[#e6eef7]" />
                ))}
              </div>
            )}
            {tables !== null && tables.length === 0 && (
              <p className="rounded-none border border-dashed border-[#c6d7e6] bg-white px-4 py-8 text-center text-[13px] text-[#55677a]">
                No tables in the dictionary yet — the seeder may still be running.
              </p>
            )}
            <div className="overflow-hidden rounded-none border border-[#c6d7e6] bg-white">
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
                      className="cursor-pointer border-b border-[#eef3f8] hover:bg-[#e8f1fa]"
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
          <div className="mx-auto max-w-[1000px] space-y-3">
            <div className="flex flex-wrap items-center gap-3 rounded-none border border-[#c6d7e6] bg-white px-4 py-2.5">
              <Table2 className="h-5 w-5 text-[#8a6d1a]" />
              <div>
                <h2 className="font-mono text-[15px] font-bold text-[#17324a]">{selected}</h2>
                <p className="text-[12px] text-[#55677a]">{detail?.table.description ?? ''}</p>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {editable && (
                  <>
                    <button type="button" className="sap-btn" onClick={openEdit}>
                      <Pencil className="h-3.5 w-3.5" />
                      Change Fields
                    </button>
                    <button type="button" className="sap-btn" onClick={() => void deleteTable()} disabled={busy}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Table
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="sap-btn sap-btn-primary"
                  onClick={() => openBrowserFor(selected)}
                  title="Open contents in the Data Browser"
                >
                  <Table2 className="h-3.5 w-3.5" />
                  Display Data (SE16)
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-none border border-[#c6d7e6] bg-white">
              <div className="border-b border-[#dce6f0] bg-[#edf3fa] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#44586c]">
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
                      <tr key={fld.name} className="border-b border-[#eef3f8] hover:bg-[#e8f1fa]">
                        <td className="px-2 py-1 text-center font-mono text-[#55677a]">{i + 1}</td>
                        <td className="px-2 py-1 font-mono font-semibold text-[#17324a]">{fld.name}</td>
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

            {/* entries maintenance + preview */}
            {detail && (
              <div className="overflow-hidden rounded-none border border-[#c6d7e6] bg-white">
                <div className="flex items-center border-b border-[#dce6f0] bg-[#edf3fa] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#44586c]">
                  <span>
                    Entries — showing {detail.rows.length} of {detail.total}
                  </span>
                  {editable && (
                    <span className="ml-auto font-normal normal-case">
                      <button type="button" className="sap-btn" onClick={() => void addRow()} disabled={busy}>
                        <Plus className="h-3 w-3" />
                        Add Entry
                      </button>
                    </span>
                  )}
                </div>
                <div className="wb-scroll overflow-auto">
                  <table className="alv-grid w-full border-collapse text-[12px]">
                    <thead>
                      <tr>
                        {editable && <th className="w-8 px-1 py-1" />}
                        {detail.fields.map((fld) => (
                          <th key={fld.name} className="px-2 py-1 text-left text-[11px]">
                            {fld.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {editable && (
                        <tr className="border-b border-[#eef3f8] bg-[#f7fafd]">
                          {editable && <td />}
                          {detail.fields.map((fld) => (
                            <td key={fld.name} className="px-1 py-[3px]">
                              <input
                                value={newRow[fld.name] ?? ''}
                                onChange={(e) => setNewRow((r) => ({ ...r, [fld.name]: e.target.value }))}
                                className="h-[22px] w-full min-w-[70px] rounded-none border border-[#c6d7e6] bg-white px-1.5 font-mono text-[11.5px] outline-none focus:border-[#0a6ed1]"
                                aria-label={`New entry ${fld.name}`}
                                placeholder={fld.key ? 'key' : ''}
                              />
                            </td>
                          ))}
                        </tr>
                      )}
                      {(rows ?? detail.rows.map((r: Record<string, string>, i: number) => ({ seq: i, data: r }))).length === 0 && (
                        <tr>
                          <td colSpan={detail.fields.length + 1} className="px-3 py-3 text-center text-[12px] text-[#55677a]">
                            No entries yet
                          </td>
                        </tr>
                      )}
                      {(rows ?? detail.rows.map((r: Record<string, string>, i: number) => ({ seq: i, data: r }))).map((row) => (
                        <tr key={row.seq} className="border-b border-[#eef3f8] hover:bg-[#e8f1fa]">
                          {editable && (
                            <td className="px-1 py-[3px] text-center">
                              <button
                                type="button"
                                className="text-[#a33] hover:text-[#c33]"
                                onClick={() => void deleteRowBySeq(row.seq)}
                                aria-label={`Delete entry ${row.seq + 1}`}
                                title="Delete entry"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          )}
                          {detail.fields.map((fld) => (
                            <td
                              key={fld.name}
                              className={`px-2 py-[3px] whitespace-nowrap ${fld.key ? 'font-mono font-bold text-[#17324a]' : ''}`}
                            >
                              {String(row.data[fld.name] ?? '')}
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
