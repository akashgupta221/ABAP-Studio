'use client'

// ── Modern ABAP workspace: executable 7.40 examples + validated definitions ──
// This screen deliberately shows what is executable, validated, simulated and
// unsupported. It never implies a live SAP HANA, RAP, OData or AMDP runtime.
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Code2, Database,
  FileCode2, Loader2, Play, Plus, Save, ShieldCheck, Sparkles, Trash2,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ListOutput } from './list-output'
import { api, useWorkbench } from './use-workbench'
import type { ModernEnvironment, ModernKind, RunResult } from './types'
import {
  MODERN_CAPABILITIES,
  MODERN_DISCLAIMER,
  MODERN_LEVEL_LABEL,
  MODERN_LEVEL_TONE,
  capabilityFor,
  type ModernIssue,
  type ModernLevel,
  type ModernValidation,
} from '@/lib/modern'

interface ModernSummary {
  id: string
  name: string
  title: string
  description: string
  type: string
  paradigm: string
  modernKind: ModernKind
  isExample: boolean
  tags: string
  version: number
  updatedAt: string
  owner: { username: string } | null
}

interface ModernDetail extends ModernSummary {
  source: string
  environment: ModernEnvironment
}

const KIND_LABEL: Record<ModernKind, string> = {
  ABAP: 'ABAP 7.40',
  CDS: 'CDS DDL',
  RAP: 'RAP BDEF',
  AMDP: 'AMDP',
}

const KIND_ICON = {
  ABAP: Code2,
  CDS: Database,
  RAP: ShieldCheck,
  AMDP: FileCode2,
} as const

const LEVEL_TONE: Record<ModernLevel, string> = {
  ...MODERN_LEVEL_TONE,
}

function statusTone(status: ModernValidation['status']): string {
  if (status === 'INVALID') return 'border-red-300 bg-red-50 text-red-800'
  if (status === 'EXECUTABLE') return 'border-emerald-300 bg-emerald-50 text-emerald-800'
  return 'border-sky-300 bg-sky-50 text-sky-800'
}

function issueTone(severity: ModernIssue['severity']): string {
  if (severity === 'E') return 'text-red-800'
  if (severity === 'W') return 'text-amber-800'
  return 'text-slate-600'
}

function listText(result: RunResult): string {
  return result.list
    .map((line) =>
      line.segments
        .map((segment) => ' '.repeat(Math.max(0, segment.x - 1)) + segment.text)
        .join(''),
    )
    .join('\n')
}

export function ModernWorkspace() {
  const navigate = useWorkbench((s) => s.navigate)
  const addMessage = useWorkbench((s) => s.addMessage)

  const [objects, setObjects] = useState<ModernSummary[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ModernDetail | null>(null)
  const [source, setSource] = useState('')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<'validate' | 'run' | 'save' | 'create' | 'delete' | null>(null)
  const [validation, setValidation] = useState<ModernValidation | null>(null)
  const [output, setOutput] = useState<RunResult | null>(null)
  const [error, setError] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<ModernKind>('ABAP')
  const [newTitle, setNewTitle] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id)
    setLoading(true)
    setError('')
    try {
      const { program } = await api<{ program: ModernDetail }>(`/api/modern/${id}`)
      setDetail(program)
      setSource(program.source)
      setDirty(false)
      setValidation(null)
      setOutput(null)
    } catch (e) {
      setError((e as Error).message)
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshList = useCallback(async () => {
    const { programs } = await api<{ programs: ModernSummary[] }>('/api/modern')
    setObjects(programs)
    return programs
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const programs = await refreshList()
        if (cancelled) return
        const initial = programs.find((p) => p.name === 'Z_MD_CONSTRUCTORS') ?? programs[0]
        if (initial) await loadDetail(initial.id)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshList, loadDetail])

  const capability = detail ? capabilityFor(detail.modernKind) : null
  const KindIcon = detail ? KIND_ICON[detail.modernKind] : Sparkles
  const canEdit = !!detail && !detail.isExample
  const canExecute = detail?.modernKind === 'ABAP'

  const groupedObjects = useMemo(() => {
    const groups: { label: string; items: ModernSummary[] }[] = []
    const examples = (objects ?? []).filter((o) => o.isExample)
    const mine = (objects ?? []).filter((o) => !o.isExample)
    if (examples.length) groups.push({ label: 'Shared examples', items: examples })
    if (mine.length) groups.push({ label: 'Private objects', items: mine })
    return groups
  }, [objects])

  const validate = async () => {
    if (!detail) return
    setBusy('validate')
    setError('')
    try {
      const { validation: result } = await api<{ validation: ModernValidation }>(
        '/api/modern/validate',
        {
          method: 'POST',
          body: JSON.stringify({ kind: detail.modernKind, source }),
        },
      )
      setValidation(result)
      addMessage(
        result.status === 'INVALID' ? 'E' : 'S',
        `${detail.name}: ${result.summary}`,
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const execute = async () => {
    if (!detail || !canExecute) return
    setBusy('run')
    setError('')
    try {
      const result = await api<RunResult>('/api/execute', {
        method: 'POST',
        body: JSON.stringify({ name: detail.name, source }),
      })
      setOutput(result)
      addMessage(
        result.status === 'ERROR' ? 'E' : 'S',
        `Modern ABAP ${detail.name} executed (${result.durationMs} ms)`,
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (!detail || !canEdit || !dirty) return
    setBusy('save')
    setError('')
    try {
      const { program } = await api<{ program: ModernDetail }>(`/api/modern/${detail.id}`, {
        method: 'PUT',
        body: JSON.stringify({ source }),
      })
      setDetail(program)
      setDirty(false)
      setObjects((current) =>
        (current ?? []).map((item) =>
          item.id === program.id
            ? { ...item, title: program.title, version: program.version, updatedAt: program.updatedAt }
            : item,
        ),
      )
      addMessage('S', `Modern object ${detail.name} saved`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newName.trim()) return
    setBusy('create')
    setError('')
    try {
      const { program } = await api<{ program: ModernDetail }>('/api/modern', {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim().toUpperCase(),
          modernKind: newKind,
          title: newTitle.trim(),
        }),
      })
      await refreshList()
      setNewOpen(false)
      setNewName('')
      setNewTitle('')
      await loadDetail(program.id)
      addMessage('S', `Modern object ${program.name} created`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!detail || detail.isExample) return
    setBusy('delete')
    setError('')
    try {
      await api(`/api/modern/${detail.id}`, { method: 'DELETE' })
      addMessage('S', `Modern object ${detail.name} deleted`)
      setDeleteOpen(false)
      const programs = await refreshList()
      const next = programs.find((item) => item.name === 'Z_MD_CONSTRUCTORS') ?? programs[0]
      if (next) await loadDetail(next.id)
      else {
        setDetail(null)
        setSelectedId(null)
        setSource('')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#ebf1f7]">
      <header className="shrink-0 border-b border-[#b9cee1] bg-gradient-to-b from-[#e6eff9] to-[#d5e3f1] px-4 py-2 text-[#17324a]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#4C6B8A]" aria-hidden />
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#55677a]">
                System MER · Client 105 · Learning simulator
              </span>
            </div>
            <h1 className="text-[16px] font-bold leading-tight">Modern ABAP Workspace</h1>
          </div>
          <button
            type="button"
            className="sap-btn min-h-[24px]"
            onClick={() => navigate('home')}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Standard workbench
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto grid max-w-[1500px] gap-3 p-3 lg:grid-cols-[250px_minmax(0,1fr)_290px]">
          {/* ── object list ── */}
          <aside
            className="min-w-0 rounded border border-[#c5d3e1] bg-white"
            aria-labelledby="modern-objects-heading"
          >
            <div className="flex items-center gap-2 border-b border-[#d7e1eb] px-3 py-2">
              <h2 id="modern-objects-heading" className="text-[12.5px] font-semibold text-[#16324d]">
                Objects
              </h2>
              <span className="rounded bg-[#e8eef5] px-1.5 py-0.5 text-[10.5px] font-medium text-[#42576d]">
                {objects?.length ?? 0}
              </span>
              <button
                type="button"
                className="ml-auto inline-flex min-h-[28px] items-center gap-1 rounded border border-[#8da7c2] bg-[#f7fafc] px-2 text-[11.5px] font-medium text-[#173a5e] hover:bg-[#e8f0f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0b5aa6]"
                onClick={() => {
                  setNewOpen(true)
                  setError('')
                }}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                New
              </button>
            </div>
            <div className="max-h-[260px] overflow-auto p-1 lg:max-h-none" aria-busy={objects === null}>
              {objects === null && (
                <p className="p-3 text-[12px] text-[#42576d]">Loading Modern objects…</p>
              )}
              {groupedObjects.map((group) => (
                <div key={group.label} className="mb-2">
                  <p className="px-2 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#51667c]">
                    {group.label}
                  </p>
                  <ul className="space-y-1">
                    {group.items.map((item) => {
                      const ItemIcon = KIND_ICON[item.modernKind]
                      const selected = item.id === selectedId
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            aria-current={selected ? 'true' : undefined}
                            onClick={() => void loadDetail(item.id)}
                            className={`w-full rounded border px-2 py-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0b5aa6] ${
                              selected
                                ? 'border-[#6a97c4] bg-[#e6f0fa]'
                                : 'border-transparent hover:border-[#c6d8e9] hover:bg-[#f2f7fc]'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <ItemIcon className="h-3.5 w-3.5 shrink-0 text-[#3e5d7d]" aria-hidden />
                              <span className="truncate font-mono text-[11.5px] font-semibold text-[#123a60]">
                                {item.name}
                              </span>
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-[#42576d]">
                              {item.title}
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-1">
                              <span className="rounded bg-[#eef2f6] px-1 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-[#40556b]">
                                {KIND_LABEL[item.modernKind]}
                              </span>
                              <span className="text-[10px] text-[#51667c]">
                                {item.isExample ? 'Example · read-only' : `Private · v${item.version}`}
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
              {objects?.length === 0 && (
                <p className="p-3 text-[12px] text-[#42576d]">
                  No Modern objects yet. Create a private object to begin.
                </p>
              )}
            </div>
          </aside>

          {/* ── editor + result ── */}
          <section className="min-w-0 space-y-3" aria-labelledby="modern-editor-heading">
            <div className="rounded border border-[#c5d3e1] bg-white">
              <div className="flex flex-wrap items-center gap-2 border-b border-[#d7e1eb] px-3 py-2">
                <KindIcon className="h-4 w-4 text-[#24547f]" aria-hidden />
                <h2 id="modern-editor-heading" className="min-w-0 truncate font-mono text-[13px] font-semibold text-[#123a60]">
                  {detail?.name ?? 'Select a Modern object'}
                </h2>
                {detail && (
                  <span className="rounded border border-[#b9c9d9] bg-[#f0f5fa] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#294b6c]">
                    {KIND_LABEL[detail.modernKind]}
                  </span>
                )}
                {detail && (
                  <span className="text-[10.5px] text-[#51667c]">
                    {detail.isExample ? 'shared example · read-only' : `private · v${detail.version}`}
                    {dirty && ' · unsaved changes'}
                  </span>
                )}
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    className="inline-flex min-h-[30px] items-center gap-1.5 rounded border border-[#7f9db9] bg-white px-2.5 text-[11.5px] font-medium text-[#173a5e] hover:bg-[#eef5fb] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0b5aa6]"
                    onClick={() => void validate()}
                    disabled={!detail || !!busy}
                  >
                    {busy === 'validate' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
                    Validate
                  </button>
                  <button
                    type="button"
                    className="sap-btn sap-btn-primary min-h-[28px]"
                    onClick={() => void execute()}
                    disabled={!detail || !canExecute || !!busy}
                    title={canExecute ? 'Execute in the local ABAP engine' : 'This artefact is validated only — there is no runtime'}
                  >
                    {busy === 'run' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
                    Execute
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      className="inline-flex min-h-[30px] items-center gap-1.5 rounded border border-[#7f9db9] bg-white px-2.5 text-[11.5px] font-medium text-[#173a5e] hover:bg-[#eef5fb] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0b5aa6]"
                      onClick={() => void save()}
                      disabled={!dirty || !!busy}
                    >
                      {busy === 'save' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Save className="h-3.5 w-3.5" aria-hidden />}
                      Save
                    </button>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      className="inline-flex min-h-[30px] items-center gap-1.5 rounded border border-[#b58b8b] bg-white px-2.5 text-[11.5px] font-medium text-[#8b2525] hover:bg-[#fbf0f0] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0b5aa6]"
                      onClick={() => setDeleteOpen(true)}
                      disabled={!!busy}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Delete
                    </button>
                  )}
                </div>
              </div>

              <div className="px-3 py-2">
                <p className="mb-2 rounded border border-[#d7e4ef] bg-[#f6f9fc] px-2.5 py-2 text-[11.5px] leading-relaxed text-[#334b62]">
                  {MODERN_DISCLAIMER}
                </p>
                {!canExecute && detail && (
                  <p className="mb-2 flex items-start gap-1.5 rounded border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11.5px] leading-relaxed text-amber-900">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                      {KIND_LABEL[detail.modernKind]} definitions are structurally validated only. There is no
                      CDS/RAP/AMDP runtime in this simulator, so Execute is intentionally disabled.
                    </span>
                  </p>
                )}
                {error && (
                  <p role="alert" className="mb-2 rounded border border-red-300 bg-red-50 px-2.5 py-2 text-[12px] text-red-800">
                    {error}
                  </p>
                )}
                <label htmlFor="modern-source" className="mb-1 block text-[11.5px] font-semibold text-[#294b6c]">
                  Source code
                  <span className="ml-1 font-normal text-[#51667c]">
                    {detail?.isExample ? '(example is read-only)' : '(editable)'}
                  </span>
                </label>
                <textarea
                  id="modern-source"
                  value={source}
                  onChange={(event) => {
                    setSource(event.target.value)
                    setDirty(true)
                    setValidation(null)
                    setOutput(null)
                  }}
                  readOnly={!canEdit}
                  spellCheck={false}
                  wrap="off"
                  aria-describedby="modern-source-help"
                  className="min-h-[340px] w-full resize-y rounded border border-[#8fa8c1] bg-[#fbfdff] p-2 font-mono text-[12px] leading-[1.55] text-[#102a43] shadow-inner focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0b5aa6] read-only:bg-[#f4f7fa]"
                />
                <p id="modern-source-help" className="mt-1 text-[10.5px] text-[#51667c]">
                  {loading
                    ? 'Loading the definition…'
                    : 'Validate with the button above. Only ABAP sources can be executed; CDS, RAP and AMDP are never run.'}
                </p>
              </div>
            </div>

            {validation && (
              <div className="rounded border border-[#c5d3e1] bg-white" role="status" aria-live="polite">
                <div className="flex flex-wrap items-center gap-2 border-b border-[#d7e1eb] px-3 py-2">
                  <h2 className="text-[12.5px] font-semibold text-[#16324d]">Validation result</h2>
                  <span className={`rounded border px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${statusTone(validation.status)}`}>
                    {validation.status}
                  </span>
                  <span className="text-[11px] text-[#42576d]">{validation.kind}</span>
                </div>
                <div className="px-3 py-2">
                  <p className="text-[12px] text-[#294b6c]">{validation.summary}</p>
                  {validation.issues.length > 0 && (
                    <ul className="mt-2 divide-y divide-[#edf1f5] border-t border-[#edf1f5]">
                      {validation.issues.map((issue, index) => (
                        <li key={`${issue.line}-${index}`} className={`flex gap-2 py-1.5 text-[11.5px] ${issueTone(issue.severity)}`}>
                          <span className="w-5 shrink-0 font-mono font-semibold">{issue.severity}</span>
                          <span className="w-10 shrink-0 font-mono">L{issue.line}</span>
                          <span className="min-w-0">{issue.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {output && (
              <div className="rounded border border-[#c5d3e1] bg-white" aria-labelledby="modern-output-heading">
                <div className="flex flex-wrap items-center gap-2 border-b border-[#d7e1eb] px-3 py-2">
                  <h2 id="modern-output-heading" className="text-[12.5px] font-semibold text-[#16324d]">
                    Execution output
                  </h2>
                  <span className={`rounded border px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${
                    output.status === 'ERROR'
                      ? 'border-red-300 bg-red-50 text-red-800'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  }`}>
                    {output.status}
                  </span>
                  <span className="text-[10.5px] text-[#51667c]">
                    {output.durationMs} ms · {output.list.length} list lines · {output.stats.steps} steps
                  </span>
                </div>
                <div className="px-3 py-2">
                  {output.error && (
                    <div className="mb-2 rounded border border-red-300 bg-red-50 px-2.5 py-2 text-[12px] text-red-800">
                      <p className="font-semibold">
                        {output.error.kind === 'SYNTAX' ? 'Syntax error' : 'Runtime error'}
                        {output.error.abapType ? ` — ${output.error.abapType}` : ''}
                      </p>
                      <p>{output.error.message}</p>
                      {typeof output.error.line === 'number' && (
                        <p className="mt-1 font-mono text-[11px]">Line {output.error.line}</p>
                      )}
                    </div>
                  )}
                  {output.status === 'REQUIRES_INPUT' && (
                    <p className="mb-2 rounded border border-sky-300 bg-sky-50 px-2.5 py-2 text-[12px] text-sky-900">
                      This program uses a selection screen. Run it from the Standard ABAP Editor to enter parameters.
                    </p>
                  )}
                  {output.list.length > 0 ? (
                    <div className="h-[300px] border border-[#b8b8b8] bg-white">
                      <ListOutput list={output.list} />
                    </div>
                  ) : (
                    <pre className="min-h-[80px] overflow-auto rounded border border-[#d7e1eb] bg-[#fbfdff] p-2 font-mono text-[11.5px] text-[#294b6c]">
                      {output.error ? 'No list output.' : listText(output) || 'No list output.'}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ── capability matrix ── */}
          <aside className="min-w-0 rounded border border-[#c5d3e1] bg-white" aria-labelledby="modern-capability-heading">
            <div className="border-b border-[#d7e1eb] px-3 py-2">
              <h2 id="modern-capability-heading" className="text-[12.5px] font-semibold text-[#16324d]">
                Capability matrix
              </h2>
              <p className="mt-0.5 text-[10.5px] leading-snug text-[#51667c]">
                What actually runs in this training environment.
              </p>
            </div>
            <div className="p-2">
              {capability && detail && (
                <div className="mb-2 rounded border border-[#b9cfe2] bg-[#f2f8fd] p-2">
                  <div className="flex items-center gap-1.5">
                    <KindIcon className="h-3.5 w-3.5 text-[#24547f]" aria-hidden />
                    <span className="text-[11.5px] font-semibold text-[#16324d]">{KIND_LABEL[detail.modernKind]}</span>
                    <span className={`ml-auto rounded border px-1 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${LEVEL_TONE[capability.level]}`}>
                      {MODERN_LEVEL_LABEL[capability.level]}
                    </span>
                  </div>
                  <p className="mt-1 text-[10.5px] leading-snug text-[#334b62]">{capability.detail}</p>
                </div>
              )}
              <ul className="space-y-1">
                {MODERN_CAPABILITIES.map((item) => (
                  <li key={item.id}>
                    <details className="rounded border border-[#d7e1eb] bg-[#fbfdff]">
                      <summary className="flex min-h-[32px] cursor-pointer list-none items-center gap-1.5 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0b5aa6]">
                        <span className={`shrink-0 rounded border px-1 py-0.5 text-[8.5px] font-bold uppercase tracking-wide ${LEVEL_TONE[item.level]}`}>
                          {MODERN_LEVEL_LABEL[item.level]}
                        </span>
                        <span className="min-w-0 text-[10.5px] font-medium leading-tight text-[#294b6c]">{item.label}</span>
                      </summary>
                      <p className="border-t border-[#e7edf3] px-2 py-1.5 text-[10px] leading-relaxed text-[#42576d]">
                        {item.detail}
                      </p>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>

      <Dialog open={newOpen} onOpenChange={(open) => !open && setNewOpen(false)}>
        <DialogContent className="bg-white sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-[16px] text-[#16324d]">Create a Modern object</DialogTitle>
            <DialogDescription className="text-[12px] text-[#42576d]">
              Private to you. Examples remain shared and read-only. Names conventionally start with Z.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void create(event)} className="space-y-3">
            <div>
              <label htmlFor="modern-new-name" className="mb-1 block text-[12px] font-medium text-[#294b6c]">
                Object name
              </label>
              <input
                id="modern-new-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value.toUpperCase())}
                placeholder="Z_MY_MODERN_ABAP"
                spellCheck={false}
                className="min-h-[32px] w-full rounded border border-[#8fa8c1] px-2 font-mono text-[12px] uppercase text-[#102a43] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0b5aa6]"
              />
            </div>
            <div>
              <label htmlFor="modern-new-kind" className="mb-1 block text-[12px] font-medium text-[#294b6c]">
                Artefact kind
              </label>
              <select
                id="modern-new-kind"
                value={newKind}
                onChange={(event) => setNewKind(event.target.value as ModernKind)}
                className="min-h-[32px] w-full rounded border border-[#8fa8c1] bg-white px-2 text-[12px] text-[#102a43] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0b5aa6]"
              >
                <option value="ABAP">ABAP 7.40 (executable)</option>
                <option value="CDS">CDS view entity (validated)</option>
                <option value="RAP">RAP behavior definition (validated)</option>
                <option value="AMDP">AMDP class (simulated)</option>
              </select>
            </div>
            <div>
              <label htmlFor="modern-new-title" className="mb-1 block text-[12px] font-medium text-[#294b6c]">
                Title <span className="font-normal text-[#51667c]">(optional)</span>
              </label>
              <input
                id="modern-new-title"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                className="min-h-[32px] w-full rounded border border-[#8fa8c1] px-2 text-[12px] text-[#102a43] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0b5aa6]"
              />
            </div>
            {error && (
              <p role="alert" className="rounded border border-red-300 bg-red-50 px-2 py-1.5 text-[11.5px] text-red-800">
                {error}
              </p>
            )}
            <DialogFooter>
              <button
                type="button"
                className="sap-btn"
                onClick={() => setNewOpen(false)}
                disabled={busy === 'create'}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="sap-btn sap-btn-primary"
                disabled={!newName.trim() || busy === 'create'}
              >
                {busy === 'create' && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                Create object
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(open) => !open && setDeleteOpen(false)}>
        <DialogContent className="bg-white sm:max-w-[430px]">
          <DialogHeader>
            <DialogTitle className="text-[16px] text-[#16324d]">Delete {detail?.name}?</DialogTitle>
            <DialogDescription className="text-[12px] text-[#42576d]">
              This permanently deletes the private object and detaches its execution log entries. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              className="sap-btn"
              onClick={() => setDeleteOpen(false)}
              disabled={busy === 'delete'}
            >
              Cancel
            </button>
            <button
              type="button"
              className="sap-btn sap-btn-danger"
              onClick={() => void remove()}
              disabled={busy === 'delete'}
            >
              {busy === 'delete' && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              Delete object
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
