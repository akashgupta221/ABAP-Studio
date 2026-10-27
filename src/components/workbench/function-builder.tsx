'use client'

// ── Function Builder (SE37) — full create / change / activate / test ───
// The screen is deliberately self-contained: the repository stays App 1's
// Prisma/Turso data, while the interaction model follows the SAP WebGUI
// Function Builder (attributes, interface parameters, source, test console).
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Braces,
  CircleCheckBig,
  Lock,
  Pencil,
  Play,
  Plus,
  Power,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useWorkbench, api } from './use-workbench'
import { AbapEditor } from './abap-editor'
import type {
  CheckIssue,
  FmParam,
  FmTestResponse,
  FunctionGroup,
  FunctionModule,
} from './types'

type ParamKind = 'import' | 'export' | 'changing' | 'tables'
type EditorTab = 'attributes' | ParamKind | 'exceptions' | 'source' | 'test'

interface FmParams {
  import: FmParam[]
  export: FmParam[]
  changing: FmParam[]
  tables: FmParam[]
  exceptions: string[]
}

interface FmDraft {
  title: string
  groupName: string
  source: string
  params: FmParams
}

const TABS: { id: EditorTab; label: string }[] = [
  { id: 'attributes', label: 'Attributes' },
  { id: 'import', label: 'Import' },
  { id: 'export', label: 'Export' },
  { id: 'changing', label: 'Changing' },
  { id: 'tables', label: 'Tables' },
  { id: 'exceptions', label: 'Exceptions' },
  { id: 'source', label: 'Source Code' },
  { id: 'test', label: 'Test' },
]

const PARAM_TITLES: Record<ParamKind, string> = {
  import: 'Import parameters',
  export: 'Export parameters',
  changing: 'Changing parameters',
  tables: 'Tables parameters',
}

const PARAM_HINTS: Record<ParamKind, string> = {
  import: 'Values passed into the function module.',
  export: 'Values returned by the function module.',
  changing: 'Values passed in and written back by the module.',
  tables: 'Internal-table parameters. The test console does not populate them.',
}

function cloneParams(source: FmParams): FmParams {
  return JSON.parse(JSON.stringify(source)) as FmParams
}

function draftFrom(fm: FunctionModule): FmDraft {
  return {
    title: fm.title ?? '',
    groupName: fm.groupName,
    source: fm.source ?? '',
    params: {
      import: fm.importParams ?? [],
      export: fm.exportParams ?? [],
      changing: fm.changingParams ?? [],
      tables: fm.tablesParams ?? [],
      exceptions: fm.exceptions ?? [],
    },
  }
}

function draftSnapshot(draft: FmDraft): string {
  return JSON.stringify(draft)
}

function defaultsFrom(fm: FunctionModule): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of [...(fm.importParams ?? []), ...(fm.changingParams ?? [])]) {
    out[p.name] = String(p.default ?? '')
  }
  return out
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isStructuredType(p: FmParam): boolean {
  const type = String(p.type ?? '').toUpperCase()
  return Boolean(type) && !['STRING', 'C', 'CHAR', 'N', 'NUMC', 'I', 'INT', 'INT4', 'P', 'DEC', 'F', 'D', 'T', 'DATE', 'TIME', 'X', 'XSTRING'].includes(type)
}

export function FunctionBuilderView() {
  const selected = useWorkbench((s) => s.selectedFunction)
  const setSelected = useWorkbench((s) => s.setSelectedFunction)
  const addMessage = useWorkbench((s) => s.addMessage)

  const [fms, setFms] = useState<FunctionModule[]>([])
  const [groups, setGroups] = useState<FunctionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ kind: 'S' | 'E' | 'W' | 'I'; text: string } | null>(null)
  const [filter, setFilter] = useState('')
  const [activeName, setActiveName] = useState<string | null>(selected)
  const [highlighted, setHighlighted] = useState<string | null>(selected)
  const [startMode, setStartMode] = useState<'display' | 'change' | 'create'>('display')
  const [valueHelpOpen, setValueHelpOpen] = useState(false)
  const [record, setRecord] = useState<FunctionModule | null>(null)
  const [draft, setDraft] = useState<FmDraft | null>(null)
  const [saved, setSaved] = useState('')
  const [mode, setMode] = useState<'display' | 'change'>('display')
  const [tab, setTab] = useState<EditorTab>('source')
  const [issues, setIssues] = useState<CheckIssue[] | null>(null)
  const [testInputs, setTestInputs] = useState<Record<string, string>>({})
  const [testResult, setTestResult] = useState<FmTestResponse | null>(null)
  const [createFmOpen, setCreateFmOpen] = useState(false)
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [deleteFmOpen, setDeleteFmOpen] = useState(false)

  const dirty = !!draft && !!saved && draftSnapshot(draft) !== saved
  const editing = !!record && !record.isExample && mode === 'change'
  const canEdit = !!record && !record.isExample
  const editableGroups = groups.filter((group) => !group.isExample)

  const refreshLists = useCallback(async () => {
    const [fnRes, groupRes] = await Promise.all([
      api<{ functions: FunctionModule[] }>('/api/functions'),
      api<{ groups: FunctionGroup[] }>('/api/function-groups'),
    ])
    setFms(fnRes.functions)
    setGroups(groupRes.groups)
    return fnRes.functions
  }, [])

  const applyRecord = useCallback((fm: FunctionModule, nextMode: 'display' | 'change' = 'display') => {
    const next = draftFrom(fm)
    setRecord(fm)
    setDraft(next)
    setSaved(draftSnapshot(next))
    setTestInputs(defaultsFrom(fm))
    setTestResult(null)
    setIssues(null)
    setMode(nextMode)
    setActiveName(fm.name)
    setSelected(fm.name)
  }, [setSelected])

  const loadRecord = useCallback(async (name: string, nextMode: 'display' | 'change' = 'display') => {
    const res = await api<{ function: FunctionModule }>(`/api/functions/${encodeURIComponent(name)}`)
    applyRecord(res.function, nextMode)
    return res.function
  }, [applyRecord])

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      try {
        const list = await refreshLists()
        if (cancelled) return
        const preferred = selected && list.some((fm) => fm.name === selected) ? selected : null
        if (preferred) await loadRecord(preferred)
        else {
          setActiveName(null)
          setHighlighted(null)
          setRecord(null)
          setDraft(null)
        }
      } catch (e) {
        if (!cancelled) setError(errorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void boot()
    return () => { cancelled = true }
    // The initial selectedFunction is a one-time navigation hint.
  }, [])

  useEffect(() => {
    if (!selected || selected === activeName) return
    const exists = fms.some((fm) => fm.name === selected)
    if (!exists) return
    if (dirty) {
      // A search/command-field navigation should not silently discard edits.
      const discard = window.confirm('Discard unsaved function module changes?')
      if (!discard) {
        setSelected(activeName ?? '')
        return
      }
    }
    setMode('display')
    void loadRecord(selected).catch((e) => setError(errorMessage(e)))
  }, [selected])

  const openFm = (name: string, nextMode: 'display' | 'change' = 'display', nextTab: EditorTab = 'source') => {
    if (dirty && !window.confirm('Discard unsaved function module changes?')) return
    setMode(nextMode)
    setError('')
    setNotice(null)
    setValueHelpOpen(false)
    setSelected(name)
    setActiveName(name)
    setHighlighted(name)
    void loadRecord(name, nextMode)
      .then(() => setTab(nextTab))
      .catch((e) => setError(errorMessage(e)))
  }

  const backToRepository = () => {
    if (dirty && !window.confirm('Discard unsaved function module changes?')) return
    setHighlighted(record?.name ?? highlighted)
    setRecord(null)
    setDraft(null)
    setActiveName(null)
    setSelected('')
    setMode('display')
    setTab('source')
    setTestResult(null)
    setIssues(null)
  }

  const updateDraft = (patch: Partial<FmDraft>) => {
    setDraft((current) => current ? { ...current, ...patch } : current)
  }

  const updateParam = (kind: ParamKind, index: number, patch: Partial<FmParam>) => {
    setDraft((current) => {
      if (!current) return current
      const params = cloneParams(current.params)
      params[kind] = params[kind].map((param, i) => i === index ? { ...param, ...patch } : param)
      return { ...current, params }
    })
  }

  const addParam = (kind: ParamKind) => {
    setDraft((current) => {
      if (!current) return current
      const params = cloneParams(current.params)
      params[kind] = [...params[kind], { name: `P_${params[kind].length + 1}`, type: 'STRING', optional: false, default: '' }]
      return { ...current, params }
    })
  }

  const deleteParam = (kind: ParamKind, index: number) => {
    setDraft((current) => {
      if (!current) return current
      const params = cloneParams(current.params)
      params[kind] = params[kind].filter((_, i) => i !== index)
      return { ...current, params }
    })
  }

  const save = async (activate = false): Promise<boolean> => {
    if (!record || !draft) return false
    if (record.isExample) {
      setNotice({ kind: 'E', text: 'Shared example function modules are read-only.' })
      return false
    }
    if (activate) {
      const ok = await runCheck(true)
      if (!ok) return false
    }
    setBusy(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        title: draft.title,
        source: draft.source,
        groupName: draft.groupName,
        params: draft.params,
      }
      if (activate) payload.activate = true
      const res = await api<{ function: FunctionModule }>(
        `/api/functions/${encodeURIComponent(record.name)}`,
        { method: 'PUT', body: JSON.stringify(payload) },
      )
      applyRecord(res.function, mode)
      setNotice({
        kind: 'S',
        text: activate
          ? `Function module ${record.name} saved and activated.`
          : `Function module ${record.name} saved${res.function.active ? '' : ' — inactive until activated'}.`,
      })
      addMessage('S', activate ? `Function module ${record.name} activated` : `Function module ${record.name} saved`)
      await refreshLists()
      return true
    } catch (e) {
      setNotice({ kind: 'E', text: errorMessage(e) })
      return false
    } finally {
      setBusy(false)
    }
  }

  const runCheck = async (silentSuccess = false): Promise<boolean> => {
    if (!draft) return false
    setBusy(true)
    setError('')
    try {
      const res = await api<{ issues: CheckIssue[] }>('/api/check', {
        method: 'POST',
        body: JSON.stringify({ source: draft.source }),
      })
      setIssues(res.issues)
      const errors = res.issues.filter((issue) => issue.kind === 'E')
      if (errors.length) {
        setNotice({ kind: 'E', text: `Syntax check found ${errors.length} error${errors.length === 1 ? '' : 's'}.` })
        return false
      }
      if (!silentSuccess) {
        setNotice({ kind: 'S', text: 'Syntax check finished — no errors found.' })
        addMessage('S', 'Syntax check finished: no errors found')
      }
      return true
    } catch (e) {
      setNotice({ kind: 'E', text: errorMessage(e) })
      return false
    } finally {
      setBusy(false)
    }
  }

  const deactivate = async () => {
    if (!record || record.isExample) return
    setBusy(true)
    setError('')
    try {
      const res = await api<{ function: FunctionModule }>(
        `/api/functions/${encodeURIComponent(record.name)}`,
        { method: 'PUT', body: JSON.stringify({ deactivate: true }) },
      )
      applyRecord(res.function, mode)
      setNotice({ kind: 'I', text: `Function module ${record.name} is now inactive.` })
      addMessage('I', `Function module ${record.name} deactivated`)
      await refreshLists()
    } catch (e) {
      setNotice({ kind: 'E', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const deleteFm = async () => {
    if (!record || record.isExample) return
    setBusy(true)
    setError('')
    try {
      await api(`/api/functions/${encodeURIComponent(record.name)}`, { method: 'DELETE' })
      setDeleteFmOpen(false)
      setHighlighted(null)
      setRecord(null)
      setDraft(null)
      setActiveName(null)
      setSelected('')
      setNotice({ kind: 'S', text: `Function module ${record.name} deleted.` })
      addMessage('S', `Function module ${record.name} deleted`)
      await refreshLists()
    } catch (e) {
      setNotice({ kind: 'E', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const runTest = async () => {
    if (!record) return
    if (dirty) {
      setNotice({ kind: 'W', text: 'Save the function module before testing the current source.' })
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await api<FmTestResponse>('/api/functions/test', {
        method: 'POST',
        body: JSON.stringify({ name: record.name, inputs: testInputs }),
      })
      setTestResult(res)
      const result = res.result
      if (result.status === 'ERROR') {
        setNotice({ kind: 'E', text: result.error?.message ?? 'Runtime error while testing the function module.' })
        addMessage('E', `Function module ${record.name} test failed`)
      } else if (res.subrc && res.subrc !== 0) {
        setNotice({ kind: 'W', text: `Function module ${record.name} returned sy-subrc ${res.subrc}.`, })
        addMessage('W', `Function module ${record.name}: sy-subrc ${res.subrc}`)
      } else {
        setNotice({ kind: 'S', text: `Function module ${record.name} executed successfully.` })
        addMessage('S', `Function module ${record.name} test completed`)
      }
    } catch (e) {
      setNotice({ kind: 'E', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const deleteGroup = async (group: FunctionGroup) => {
    if (group.isExample) return
    const question = group.moduleCount > 0
      ? `Function group ${group.name} contains ${group.moduleCount} function module(s). Delete the group and all its modules?`
      : `Delete function group ${group.name}?`
    if (!window.confirm(question)) return
    setBusy(true)
    try {
      await api(`/api/function-groups/${encodeURIComponent(group.name)}?force=true`, { method: 'DELETE' })
      addMessage('S', `Function group ${group.name} deleted`)
      await refreshLists()
      if (record && record.groupName === group.name) {
        setHighlighted(null)
        setRecord(null)
        setDraft(null)
        setActiveName(null)
        setSelected('')
      }
    } catch (e) {
      setNotice({ kind: 'E', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const visible = useMemo(() => {
    const q = filter.trim().toUpperCase()
    if (!q) return fms
    return fms.filter((fm) =>
      fm.name.includes(q) ||
      fm.groupName.includes(q) ||
      (fm.title ?? '').toUpperCase().includes(q),
    )
  }, [fms, filter])

  const primaryTarget = highlighted ?? record?.name ?? (filter.trim() ? visible[0]?.name ?? null : null)

  const runPrimary = () => {
    if (startMode === 'create') {
      setCreateFmOpen(true)
      return
    }
    if (!primaryTarget) {
      setNotice({ kind: 'I', text: 'Select a function module or type a name first.' })
      return
    }
    openFm(primaryTarget, startMode === 'change' ? 'change' : 'display')
  }

  const openTest = () => {
    if (!primaryTarget) {
      setNotice({ kind: 'I', text: 'Select a function module first.' })
      return
    }
    openFm(primaryTarget, 'display', 'test')
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f0f4f9] text-[13px] text-[#55677a]">
        Loading Function Builder…
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f4f9]" data-testid="function-builder">
      <div className="shrink-0 border-b border-[#b9c8db] bg-[#e4ebf5] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Braces className="h-5 w-5 text-[#5d3a8e]" />
          <div className="min-w-0">
            <h1 className="text-[14px] font-bold text-[#12283c]">Function Builder (SE37)</h1>
            <p className="truncate text-[11.5px] text-[#4e6074]">
              {fms.length} function module{fms.length === 1 ? '' : 's'} in {groups.length} function group{groups.length === 1 ? '' : 's'} · selected system MER / client 105
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className="sap-btn"
              onClick={() => { void refreshLists().catch((e) => setError(errorMessage(e))) }}
              title="Refresh function module and group lists"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            <button
              type="button"
              className="sap-btn sap-btn-primary"
              onClick={() => setCreateFmOpen(true)}
              disabled={editableGroups.length === 0}
              title={editableGroups.length === 0 ? 'Create a private function group first' : 'Create a function module'}
            >
              <Plus className="h-3.5 w-3.5" /> Create function module
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
          <div className="relative">
            <label htmlFor="se37-fm-name" className="mb-0.5 block text-[10.5px] font-bold uppercase tracking-wide text-[#4c6b8a]">
              Function module
            </label>
            <div className="flex">
              <input
                id="se37-fm-name"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  if (filter.trim() || highlighted) runPrimary()
                  else setValueHelpOpen(true)
                }}
                placeholder="Enter a function module…"
                className="sap-field h-[26px] w-[230px] max-w-full font-mono text-[12px]"
                aria-label="Function module"
                autoComplete="off"
              />
              <button
                type="button"
                className="sap-btn ml-[2px] h-[26px] px-2"
                onClick={() => setValueHelpOpen((open) => !open)}
                aria-label="F4 value help"
                aria-expanded={valueHelpOpen}
                title="F4 value help — search function modules"
              >
                <Search className="h-3.5 w-3.5" /> F4
              </button>
            </div>
            {valueHelpOpen && (
              <div
                className="absolute left-0 top-full z-30 mt-1 max-h-[240px] w-[340px] overflow-auto rounded-[2px] border border-[#8296ac] bg-white shadow-[0_8px_24px_rgba(9,30,60,0.25)]"
                role="listbox"
                aria-label="Function module value help"
              >
                {visible.length === 0 && (
                  <p className="px-2 py-2 text-[11.5px] italic text-[#55677a]">No matching function modules.</p>
                )}
                {visible.map((fm) => (
                  <button
                    key={fm.name}
                    type="button"
                    role="option"
                    aria-selected={highlighted === fm.name}
                    className={`flex w-full items-center gap-2 px-2 py-[3px] text-left text-[11.5px] hover:bg-[#dbe8f8] ${highlighted === fm.name ? 'bg-[#cfe4ff]' : ''}`}
                    onClick={() => { setHighlighted(fm.name); setFilter(fm.name); setValueHelpOpen(false) }}
                  >
                    <span className="font-mono text-[#0a4f8f]">{fm.name}</span>
                    <span className="truncate text-[#55677a]">{fm.title || '—'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <fieldset className="flex items-center gap-2 pb-[3px]" aria-label="Function module mode">
            <legend className="sr-only">Function module mode</legend>
            <span className="text-[10.5px] font-bold uppercase tracking-wide text-[#4c6b8a]">Mode</span>
            {(['display', 'change', 'create'] as const).map((choice) => (
              <label key={choice} className="flex items-center gap-1 text-[11.5px] capitalize text-[#1d3a5f]">
                <input
                  type="radio"
                  name="se37-mode"
                  value={choice}
                  checked={startMode === choice}
                  onChange={() => setStartMode(choice)}
                  className="h-3 w-3 accent-[#0a6dd1]"
                />
                {choice}
              </label>
            ))}
          </fieldset>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className="sap-btn"
              onClick={() => {
                if (!primaryTarget) { setNotice({ kind: 'I', text: 'Select a function module first.' }); return }
                openFm(primaryTarget, 'display')
              }}
            >
              Display
            </button>
            <button
              type="button"
              className="sap-btn"
              onClick={() => {
                if (!primaryTarget) { setNotice({ kind: 'I', text: 'Select a function module first.' }); return }
                openFm(primaryTarget, 'change')
              }}
              disabled={!!primaryTarget && !!fms.find((fm) => fm.name === primaryTarget)?.isExample}
            >
              Change
            </button>
            <button
              type="button"
              className="sap-btn"
              onClick={() => setCreateFmOpen(true)}
              disabled={editableGroups.length === 0}
              title={editableGroups.length === 0 ? 'Create a private function group first' : undefined}
            >
              Create
            </button>
            <button type="button" className="sap-btn sap-btn-default" onClick={() => openTest()} aria-label="Test function module">
              <Play className="h-3.5 w-3.5" /> Test
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#4c6b8a]">Function groups</span>
          {groups.map((group) => (
            <span key={group.name} className="inline-flex items-center">
              <button
                type="button"
                onClick={() => setFilter(group.name)}
                className={`flex h-[24px] items-center rounded-[2px] border px-2 font-mono text-[11px] hover:bg-[#e7f0fa] ${
                  filter === group.name ? 'border-[#0a6dd1] bg-[#dbe8f8] text-[#0a4f8f]' : 'border-[#8296ac] bg-white text-[#0a6dd1]'
                }`}
                title={`${group.shortText || group.name} — ${group.moduleCount} module(s); click to filter`}
              >
                {group.name} ({group.moduleCount})
                {group.isExample ? <Lock className="ml-1 inline h-2.5 w-2.5" aria-label="shared example" /> : null}
              </button>
              {!group.isExample && (
                <button
                  type="button"
                  onClick={() => void deleteGroup(group)}
                  className="ml-0.5 flex h-[24px] w-[24px] items-center justify-center rounded-[2px] text-[#8a2b2b] hover:bg-[#f5dddd]"
                  aria-label={`Delete function group ${group.name}`}
                  title={`Delete function group ${group.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          <button
            type="button"
            onClick={() => setCreateGroupOpen(true)}
            className="flex h-[24px] items-center gap-1 rounded-[2px] border border-dashed border-[#7a91aa] bg-[#f7f9fc] px-2 text-[11px] font-semibold text-[#2f5c8a] hover:bg-[#e7f0fa]"
          >
            <Plus className="h-3 w-3" /> Create group
          </button>
          {groups.length === 0 && <span className="text-[11.5px] italic text-[#55677a]">No function groups yet.</span>}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {error && (
          <div className="m-3 flex items-start gap-2 rounded-[3px] border border-[#e4b6b3] bg-[#fbf0ef] px-3 py-2 text-[12px] text-[#6b2a26]" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
            <button type="button" className="ml-auto flex h-[24px] w-[24px] items-center justify-center text-[#8a2b2b]" onClick={() => setError('')} aria-label="Dismiss error">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {notice && (
          <div
            className={`mx-3 mt-3 flex items-start gap-2 rounded-[3px] border px-3 py-2 text-[12px] ${
              notice.kind === 'E'
                ? 'border-[#e4b6b3] bg-[#fbf0ef] text-[#6b2a26]'
                : notice.kind === 'W'
                  ? 'border-[#e4c98a] bg-[#fbf6e3] text-[#6b5a21]'
                  : notice.kind === 'S'
                    ? 'border-[#b8d9b3] bg-[#eef8ec] text-[#285f2d]'
                    : 'border-[#b9c8db] bg-[#edf2f8] text-[#12263a]'
            }`}
            role="status"
          >
            {notice.kind === 'E' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : null}
            <span>{notice.text}</span>
            <button type="button" className="ml-auto flex h-[24px] w-[24px] items-center justify-center opacity-70 hover:opacity-100" onClick={() => setNotice(null)} aria-label="Dismiss message">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {!record || !draft ? (
          <div className="flex min-h-0 flex-1 flex-col bg-white">
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#c3d0e0] bg-[#eef3f9] px-3 py-1.5">
              <span className="text-[12px] font-bold text-[#1d3a5f]">Function module repository</span>
              <span className="rounded-[2px] border border-[#c4d2e0] bg-white px-1.5 py-[1px] text-[10.5px] text-[#4e6074]">
                {visible.length} of {fms.length} entries
              </span>
              {filter && (
                <button type="button" className="text-[10.5px] text-[#0a6dd1] underline" onClick={() => setFilter('')}>
                  Clear filter
                </button>
              )}
              <span className="ml-auto hidden text-[10.5px] italic text-[#55677a] sm:inline">
                Single-click selects · double-click opens
              </span>
            </div>

            <div className="wb-scroll min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[760px] border-collapse text-[11.5px]">
                <thead className="sticky top-0 z-10 bg-[#dbe6f2]">
                  <tr className="text-left text-[10.5px] font-bold text-[#1d3a5f]">
                    <th className="border-b border-[#b9c8db] px-3 py-1.5">Function Module</th>
                    <th className="border-b border-[#b9c8db] px-3 py-1.5">Short Text</th>
                    <th className="border-b border-[#b9c8db] px-3 py-1.5">Function Group</th>
                    <th className="border-b border-[#b9c8db] px-2 py-1.5">Status</th>
                    <th className="border-b border-[#b9c8db] px-3 py-1.5">Changed By</th>
                    <th className="border-b border-[#b9c8db] px-3 py-1.5">Changed On</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((fm) => {
                    const isHighlighted = highlighted === fm.name || activeName === fm.name
                    return (
                      <tr
                        key={fm.name}
                        tabIndex={0}
                        onClick={() => setHighlighted(fm.name)}
                        onDoubleClick={() => openFm(fm.name, 'display')}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            openFm(fm.name, 'display')
                          } else if (event.key === ' ') {
                            event.preventDefault()
                            setHighlighted(fm.name)
                          }
                        }}
                        title={`${fm.name} — ${fm.title || 'no short text'} · double-click to display`}
                        className={`cursor-pointer border-b border-[#e4ebf3] outline-none focus-visible:bg-[#e2f0ff] ${
                          isHighlighted ? 'bg-[#cfe4ff]' : 'hover:bg-[#eaf2fb]'
                        }`}
                      >
                        <td className="px-3 py-[5px]">
                          <span className="flex items-center gap-1.5">
                            {fm.isExample ? (
                              <Lock className="h-3 w-3 shrink-0 text-[#55677a]" aria-label="shared example" />
                            ) : (
                              <Braces className="h-3 w-3 shrink-0 text-[#5d3a8e]" />
                            )}
                            <span className="font-mono font-semibold text-[#0a4f8f]">{fm.name}</span>
                          </span>
                        </td>
                        <td className="max-w-[280px] truncate px-3 py-[5px] text-[#33475c]">{fm.title || '—'}</td>
                        <td className="px-3 py-[5px] font-mono text-[#33475c]">{fm.groupName}</td>
                        <td className="px-2 py-[5px]">
                          <span className={`inline-block rounded-[2px] px-1.5 py-[1px] text-[9.5px] font-semibold ${fm.active ? 'bg-[#d8efd4] text-[#155f27]' : 'bg-[#fbf0d9] text-[#6f5712]'}`}>
                            {fm.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-3 py-[5px] text-[#33475c]">{fm.changedBy || '—'}</td>
                        <td className="px-3 py-[5px] font-mono text-[11px] text-[#33475c]">{fm.changedOn || '—'}</td>
                      </tr>
                    )
                  })}
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-[12px] italic text-[#55677a]">
                        {fms.length === 0
                          ? 'No function modules yet — create a function group, then add a function module.'
                          : 'No function modules match this filter.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[#c7d8ea] bg-[#eef3f9] px-3 py-1.5 text-[10.5px] text-[#55677a]">
              <span>Double-click a row to display it · F4 in the name field opens value help · Enter opens the selected module.</span>
              <span className="ml-auto font-mono">Selected: {highlighted ?? '—'}</span>
            </div>
          </div>
        ) : (
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#c7d8ea] bg-[#ebf1f7] px-3 py-[6px]">
                <button
                  type="button"
                  className="sap-btn h-[24px]"
                  onClick={backToRepository}
                  title="Back to the function module repository"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Repository
                </button>
                <span className="mx-0.5 h-4 w-px bg-[#c4d2e0]" aria-hidden />
                <span className="text-[11.5px] text-[#4e6074]">Function module</span>
                <span className="font-mono text-[13px] font-bold text-[#12283c]">{record.name}</span>
                <span className="text-[11.5px] text-[#4e6074]">Group</span>
                <span className="font-mono text-[11.5px] text-[#12283c]">{record.groupName}</span>
                <span className={`rounded-[2px] px-1.5 py-[1px] text-[10px] font-semibold ${record.active ? 'bg-[#d8efd4] text-[#155f27]' : 'bg-[#fbf0d9] text-[#6f5712]'}`}>
                  {record.active ? 'Active' : 'Inactive'}
                </span>
                {record.isExample && (
                  <span className="rounded-[2px] bg-[#e8eef6] px-1.5 py-[1px] text-[10px] font-semibold text-[#4c6b8a]">
                    shared example · read-only
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1.5">
                  {!record.isExample && (
                    <button
                      type="button"
                      className="sap-btn"
                      onClick={() => setMode(mode === 'change' ? 'display' : 'change')}
                      disabled={busy}
                    >
                      {mode === 'change' ? <><X className="h-3.5 w-3.5" /> Display</> : <><Pencil className="h-3.5 w-3.5" /> Change</>}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-end gap-[2px] border-b border-[#8296ac] bg-[#d6e1ef] px-2 pt-1">
                {TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`shrink-0 rounded-t-[3px] border border-b-0 px-2.5 py-[3px] text-[11.5px] ${
                      tab === item.id
                        ? 'border-[#8296ac] bg-white font-semibold text-[#12283c]'
                        : 'border-[#a8b8cb] bg-[#e4ebf5] text-[#40556c] hover:bg-[#edf2f8]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-auto bg-[#f7f9fc]">
                {tab === 'attributes' && (
                  <div className="mx-auto w-full max-w-[680px] p-3">
                    <div className="rounded-[3px] border border-[#c4d2e0] bg-white p-4">
                      <h2 className="mb-3 text-[12px] font-bold text-[#1d3a5f]">Attributes</h2>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <label htmlFor="fm-title" className="w-[140px] text-right text-[12px] text-[#44586c]">Short text</label>
                          <input
                            id="fm-title"
                            value={draft.title}
                            readOnly={!editing}
                            onChange={(e) => updateDraft({ title: e.target.value })}
                            className="sap-field w-[360px] max-w-full"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-[140px] text-right text-[12px] text-[#44586c]">Function group</span>
                          {record.isExample ? (
                            <span className="rounded-[2px] border border-[#c4d2e0] bg-[#edf2f8] px-2 py-[2px] font-mono text-[12px]">{record.groupName}</span>
                          ) : (
                            <select
                              value={draft.groupName}
                              disabled={!editing}
                              onChange={(e) => updateDraft({ groupName: e.target.value })}
                              className="sap-field w-[260px] max-w-full"
                              aria-label="Function group"
                            >
                              {editableGroups.map((group) => (
                                <option key={group.name} value={group.name}>{group.name} — {group.shortText || 'private group'}</option>
                              ))}
                              {!editableGroups.some((group) => group.name === draft.groupName) && (
                                <option value={draft.groupName}>{draft.groupName}</option>
                              )}
                            </select>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-[140px] text-right text-[12px] text-[#44586c]">Created by</span>
                          <span className="text-[12px] text-[#12283c]">{record.createdBy || '—'}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-[140px] text-right text-[12px] text-[#44586c]">Changed by</span>
                          <span className="text-[12px] text-[#12283c]">{record.changedBy || '—'}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-[140px] text-right text-[12px] text-[#44586c]">Changed on</span>
                          <span className="text-[12px] text-[#12283c]">{record.changedOn || '—'}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-[140px] text-right text-[12px] text-[#44586c]">Status</span>
                          <span className="text-[12px] text-[#12283c]">{record.active ? 'Active' : 'Inactive (revised)'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {tab !== 'attributes' && tab !== 'source' && tab !== 'test' && tab !== 'exceptions' && (
                  <ParamTable
                    kind={tab}
                    params={draft.params[tab]}
                    readOnly={!editing}
                    onAdd={() => addParam(tab)}
                    onChange={(index, patch) => updateParam(tab, index, patch)}
                    onDelete={(index) => deleteParam(tab, index)}
                  />
                )}

                {tab === 'exceptions' && (
                  <div className="p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-bold text-[#1d3a5f]">Exceptions</span>
                      <span className="text-[11px] text-[#4e6074]">Documented RAISE names; the ABAP engine catches them through EXCEPTIONS.</span>
                      {editing && (
                        <button type="button" className="sap-btn ml-auto" onClick={() => updateDraft({ params: { ...draft.params, exceptions: [...draft.params.exceptions, ''] } })}>
                          <Plus className="h-3.5 w-3.5" /> Add exception
                        </button>
                      )}
                    </div>
                    <div className="overflow-hidden rounded-[3px] border border-[#c4d2e0] bg-white">
                      {draft.params.exceptions.length === 0 && (
                        <p className="px-3 py-4 text-center text-[11.5px] italic text-[#55677a]">No exceptions documented.</p>
                      )}
                      {draft.params.exceptions.map((name, index) => (
                        <div key={index} className="flex items-center gap-2 border-b border-[#e4ebf3] px-2 py-1 last:border-b-0">
                          <input
                            value={name}
                            readOnly={!editing}
                            onChange={(e) => {
                              const exceptions = draft.params.exceptions.map((value, i) => i === index ? e.target.value.toUpperCase() : value)
                              updateDraft({ params: { ...draft.params, exceptions } })
                            }}
                            className="sap-field w-[260px] max-w-full font-mono uppercase"
                            aria-label={`Exception ${index + 1}`}
                          />
                          {editing && (
                            <button
                              type="button"
                              className="flex h-[24px] w-[24px] items-center justify-center text-[#b3261e] hover:text-[#7a1a14]"
                              onClick={() => updateDraft({ params: { ...draft.params, exceptions: draft.params.exceptions.filter((_, i) => i !== index) } })}
                              aria-label={`Delete exception ${index + 1}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tab === 'source' && (
                  <div className="flex min-h-[360px] flex-col">
                    <div className="flex shrink-0 items-center gap-2 border-b border-[#c4d2e0] bg-[#eef2f8] px-3 py-1 text-[11px] text-[#5b6d80]">
                      <span className="font-semibold uppercase tracking-wide">ABAP source</span>
                      <span className="ml-auto">{editing ? 'Change mode' : 'Display mode'}</span>
                    </div>
                    <div className="h-[430px] min-h-[260px]">
                      <AbapEditor
                        value={draft.source}
                        readOnly={!editing}
                        onChange={(value) => updateDraft({ source: value })}
                        fontSize={12.5}
                      />
                    </div>
                  </div>
                )}

                {tab === 'test' && (
                  <div className="p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Play className="h-4 w-4 text-[#b25000]" />
                      <h2 className="text-[12.5px] font-bold text-[#1d3a5f]">Test function module</h2>
                      {!record.active && (
                        <span className="rounded-[2px] bg-[#fbf0d9] px-1.5 py-[1px] text-[10px] font-semibold text-[#6f5712]">inactive — test is allowed, but callers only see active modules</span>
                      )}
                      {dirty && (
                        <span className="rounded-[2px] bg-[#fbf6e3] px-1.5 py-[1px] text-[10px] text-[#6b5a21]">save changes before testing</span>
                      )}
                      <button
                        type="button"
                        className="sap-btn sap-btn-primary ml-auto"
                        onClick={() => void runTest()}
                        disabled={busy || dirty}
                      >
                        <Play className="h-3.5 w-3.5" /> {busy ? 'Running…' : 'Execute'}
                      </button>
                      <button
                        type="button"
                        className="sap-btn"
                        onClick={() => { setTestInputs(defaultsFrom(record)); setTestResult(null); setNotice(null) }}
                      >
                        Reset
                      </button>
                    </div>

                    <div className="rounded-[3px] border border-[#c4d2e0] bg-white p-4">
                      <h3 className="mb-2 text-[11.5px] font-bold text-[#1d3a5f]">Import / Changing parameters</h3>
                      {[...draft.params.import, ...draft.params.changing].length === 0 ? (
                        <p className="text-[11.5px] italic text-[#55677a]">This function module has no input parameters — execute directly.</p>
                      ) : (
                        <div className="grid gap-2 md:grid-cols-2">
                          {[...draft.params.import, ...draft.params.changing].map((p) => (
                            <div key={`${p.name}-${p.type}`} className="flex items-center gap-2">
                              <label htmlFor={`fm-input-${p.name}`} className="w-[150px] shrink-0 truncate text-right font-mono text-[11.5px] text-[#12283c]" title={`${p.name} TYPE ${p.type || 'STRING'}`}>
                                {p.name}
                                <span className="ml-1 font-sans text-[9.5px] text-[#4e6074]">{isStructuredType(p) ? 'structure' : p.type || 'STRING'}</span>
                              </label>
                              <input
                                id={`fm-input-${p.name}`}
                                value={testInputs[p.name] ?? ''}
                                onChange={(e) => setTestInputs((current) => ({ ...current, [p.name]: e.target.value }))}
                                placeholder={isStructuredType(p) ? 'structured input not populated' : 'value'}
                                disabled={isStructuredType(p)}
                                className="sap-field w-full max-w-[240px] font-mono"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {testResult && (
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        <div className="rounded-[3px] border border-[#c4d2e0] bg-white p-3">
                          <h3 className="mb-2 text-[11.5px] font-bold text-[#1d3a5f]">Result values</h3>
                          <table className="w-full border-collapse text-[11.5px]">
                            <thead>
                              <tr className="bg-[#dee7f2] text-left text-[10.5px] font-bold text-[#1d3a5f]">
                                <th className="border border-[#c4d2e0] px-2 py-1">Parameter</th>
                                <th className="border border-[#c4d2e0] px-2 py-1">Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(testResult.outputs).length === 0 && (
                                <tr>
                                  <td colSpan={2} className="px-2 py-3 text-center italic text-[#55677a]">No scalar output values</td>
                                </tr>
                              )}
                              {Object.entries(testResult.outputs).map(([name, value]) => (
                                <tr key={name}>
                                  <td className="border border-[#e4ebf3] px-2 py-1 font-mono">{name}</td>
                                  <td className="border border-[#e4ebf3] px-2 py-1 font-mono font-semibold">{value || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px]">
                            <span className="font-semibold text-[#12283c]">sy-subrc:</span>
                            <span className={`font-mono ${testResult.subrc && testResult.subrc !== 0 ? 'text-[#b3261e]' : 'text-[#155f27]'}`}>
                              {testResult.subrc ?? 0}
                            </span>
                            {testResult.result.error && (
                              <span className="rounded-[2px] bg-[#fbf0ef] px-1.5 py-[1px] text-[10.5px] text-[#6b2a26]">
                                line {testResult.result.error.line}: {testResult.result.error.message}
                              </span>
                            )}
                          </div>
                          {testResult.notes.map((note, index) => (
                            <p key={index} className="mt-2 text-[10.5px] italic text-[#6f5712]">{note}</p>
                          ))}
                        </div>
                        <div className="rounded-[3px] border border-[#c4d2e0] bg-white p-3">
                          <h3 className="mb-2 text-[11.5px] font-bold text-[#1d3a5f]">List output (WRITE)</h3>
                          <pre className="wb-scroll max-h-[260px] overflow-auto whitespace-pre-wrap rounded-[2px] bg-[#0b1e33] p-2 text-[11.5px] leading-[17px] text-[#cfe6ff]">
                            {testResult.lines.length ? testResult.lines.join('\n') : '(no list output)'}
                          </pre>
                          {testResult.result.messages.length > 0 && (
                            <div className="mt-2 rounded-[2px] border border-[#b9c8db] bg-[#edf2f8] px-2 py-1 text-[11px] text-[#12263a]">
                              {testResult.result.messages.map((message, index) => (
                                <div key={index}>[{message.msgType}] {message.text}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {issues && (
                  <div className="border-t border-[#c4d2e0] bg-[#f7f9fc] p-3" data-testid="fm-check-results">
                    <div className="mb-1 flex items-center gap-2">
                      <CircleCheckBig className="h-4 w-4 text-[#3f7b43]" />
                      <span className="text-[11.5px] font-bold text-[#1d3a5f]">Syntax check results</span>
                      <button type="button" className="ml-auto text-[11px] text-[#0a6dd1] underline" onClick={() => setIssues(null)}>Close</button>
                    </div>
                    {issues.length === 0 ? (
                      <p className="text-[11.5px] text-[#285f2d]">No issues found.</p>
                    ) : (
                      <ul className="space-y-0.5">
                        {issues.map((issue, index) => (
                          <li key={index} className={`text-[11.5px] ${issue.kind === 'E' ? 'text-[#b3261e]' : issue.kind === 'W' ? 'text-[#6f5712]' : 'text-[#285f2d]'}`}>
                            [{issue.kind}] line {issue.line || '—'}: {issue.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-[#c7d8ea] bg-[#ebf1f7] px-3 py-2">
                <button type="button" className="sap-btn" onClick={() => void runCheck()} disabled={busy}>
                  <CircleCheckBig className="h-3.5 w-3.5" /> Check
                </button>
                {canEdit && (
                  <>
                    <button type="button" className="sap-btn sap-btn-default" onClick={() => void save(false)} disabled={busy || !dirty}>
                      <Save className="h-3.5 w-3.5" /> Save
                    </button>
                    <button
                      type="button"
                      className="sap-btn"
                      onClick={() => void save(true)}
                      disabled={busy}
                      title="Check, save and activate"
                    >
                      <Power className="h-3.5 w-3.5" /> {record.active && !dirty ? 'Reactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className="sap-btn"
                      onClick={() => void deactivate()}
                      disabled={busy || !record.active || dirty}
                      title={dirty ? 'Save or discard changes before deactivating' : 'Make this module inactive'}
                    >
                      Deactivate
                    </button>
                    <button
                      type="button"
                      className="sap-btn sap-btn-danger"
                      onClick={() => setDeleteFmOpen(true)}
                      disabled={busy}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </>
                )}
                <span className="ml-auto text-[10.5px] italic text-[#55677a]">
                  {record.isExample ? 'shared example — read-only' : dirty ? 'unsaved changes' : 'no changes'}
                </span>
              </div>
            </div>
          </section>
        )}
      </div>

      <CreateGroupDialog
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
        onCreated={async (group) => {
          setCreateGroupOpen(false)
          setNotice({ kind: 'S', text: `Function group ${group.name} created.` })
          addMessage('S', `Function group ${group.name} created`)
          await refreshLists()
        }}
      />
      <CreateFmDialog
        open={createFmOpen}
        onOpenChange={setCreateFmOpen}
        groups={editableGroups}
        onCreated={async (fm) => {
          setCreateFmOpen(false)
          setNotice({ kind: 'S', text: `Function module ${fm.name} created. Review the source and activate it.` })
          addMessage('S', `Function module ${fm.name} created (inactive)`)
          await refreshLists()
          applyRecord(fm, 'change')
          setTab('source')
        }}
      />
      <Dialog open={deleteFmOpen} onOpenChange={setDeleteFmOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Delete function module</DialogTitle>
            <DialogDescription className="text-[12.5px]">
              Delete <span className="font-mono font-semibold">{record?.name}</span>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" className="sap-btn" onClick={() => setDeleteFmOpen(false)}>Cancel</button>
            <button type="button" className="sap-btn sap-btn-danger" onClick={() => void deleteFm()} disabled={busy}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ParamTable({
  kind,
  params,
  readOnly,
  onAdd,
  onChange,
  onDelete,
}: {
  kind: ParamKind
  params: FmParam[]
  readOnly: boolean
  onAdd: () => void
  onChange: (index: number, patch: Partial<FmParam>) => void
  onDelete: (index: number) => void
}) {
  return (
    <div className="p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-bold text-[#1d3a5f]">{PARAM_TITLES[kind]}</span>
        <span className="text-[11px] text-[#4e6074]">{PARAM_HINTS[kind]}</span>
        {!readOnly && (
          <button type="button" className="sap-btn ml-auto" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" /> Add parameter
          </button>
        )}
      </div>
      <div className="overflow-auto rounded-[3px] border border-[#c4d2e0] bg-white">
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="bg-[#dee7f2] text-left text-[10.5px] font-bold text-[#1d3a5f]">
              <th className="border-b border-[#c4d2e0] px-2 py-1.5">Parameter name</th>
              <th className="border-b border-[#c4d2e0] px-2 py-1.5">Type spec</th>
              <th className="border-b border-[#c4d2e0] px-2 py-1.5">Default value</th>
              <th className="w-[70px] border-b border-[#c4d2e0] px-2 py-1.5">Optional</th>
              {!readOnly && <th className="w-[40px] border-b border-[#c4d2e0] px-2 py-1.5" />}
            </tr>
          </thead>
          <tbody>
            {params.map((param, index) => (
              <tr key={`${param.name}-${index}`}>
                <td className="border-b border-[#e4ebf3] px-1 py-[2px]">
                  <input
                    value={param.name ?? ''}
                    readOnly={readOnly}
                    onChange={(e) => onChange(index, { name: e.target.value.toUpperCase() })}
                    className="sap-field w-full font-mono uppercase"
                    aria-label={`Parameter name ${index + 1}`}
                    autoComplete="off"
                  />
                </td>
                <td className="border-b border-[#e4ebf3] px-1 py-[2px]">
                  <input
                    value={param.type ?? ''}
                    readOnly={readOnly}
                    onChange={(e) => onChange(index, { type: e.target.value.toUpperCase() })}
                    className="sap-field w-full font-mono uppercase"
                    aria-label={`Type specification ${index + 1}`}
                    autoComplete="off"
                  />
                </td>
                <td className="border-b border-[#e4ebf3] px-1 py-[2px]">
                  <input
                    value={String(param.default ?? '')}
                    readOnly={readOnly}
                    onChange={(e) => onChange(index, { default: e.target.value })}
                    className="sap-field w-full font-mono"
                    aria-label={`Default value ${index + 1}`}
                    autoComplete="off"
                  />
                </td>
                <td className="border-b border-[#e4ebf3] px-2 py-[2px] text-center">
                  <input
                    type="checkbox"
                    className="sap-checkbox"
                    checked={Boolean(param.optional)}
                    disabled={readOnly}
                    onChange={(e) => onChange(index, { optional: e.target.checked })}
                    aria-label={`Optional ${index + 1}`}
                  />
                </td>
                {!readOnly && (
                  <td className="border-b border-[#e4ebf3] px-2 py-[2px] text-center">
                    <button type="button" className="mx-auto flex h-[24px] w-[24px] items-center justify-center text-[#b3261e] hover:text-[#7a1a14]" onClick={() => onDelete(index)} aria-label={`Delete parameter ${index + 1}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {params.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 4 : 5} className="px-2 py-4 text-center text-[11.5px] italic text-[#55677a]">
                  No {kind} parameters defined.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CreateGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (group: FunctionGroup) => void | Promise<void>
}) {
  const [name, setName] = useState('')
  const [shortText, setShortText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) { setName(''); setShortText(''); setError('') }
  }, [open])

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await api<{ group: FunctionGroup }>('/api/function-groups', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim().toUpperCase(), shortText }),
      })
      await onCreated(res.group)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Create function group</DialogTitle>
          <DialogDescription className="text-[12.5px]">Private function modules are created inside a group you own.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label htmlFor="new-group-name" className="w-[120px] text-right text-[12px] text-[#44586c]">Name</label>
            <input
              id="new-group-name"
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              placeholder="Z_MY_GROUP"
              className="sap-field w-full font-mono uppercase"
              autoComplete="off"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="new-group-text" className="w-[120px] text-right text-[12px] text-[#44586c]">Short text</label>
            <input
              id="new-group-text"
              value={shortText}
              onChange={(e) => setShortText(e.target.value)}
              placeholder="My training function group"
              className="sap-field w-full"
              autoComplete="off"
            />
          </div>
          {error && <p className="text-[11.5px] text-[#b3261e]" role="alert">{error}</p>}
        </div>
        <DialogFooter>
          <button type="button" className="sap-btn" onClick={() => onOpenChange(false)}>Cancel</button>
          <button type="button" className="sap-btn sap-btn-primary" onClick={() => void submit()} disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create group'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateFmDialog({
  open,
  onOpenChange,
  groups,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: FunctionGroup[]
  onCreated: (fm: FunctionModule) => void | Promise<void>
}) {
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [groupName, setGroupName] = useState(groups[0]?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName('')
      setTitle('')
      setGroupName(groups[0]?.name ?? '')
      setError('')
    }
  }, [open, groups])

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await api<{ function: FunctionModule }>('/api/functions', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim().toUpperCase(), title, groupName }),
      })
      await onCreated(res.function)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Create function module</DialogTitle>
          <DialogDescription className="text-[12.5px]">The module starts inactive. Add the source and interface, check, then activate.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label htmlFor="new-fm-name" className="w-[120px] text-right text-[12px] text-[#44586c]">Name</label>
            <input
              id="new-fm-name"
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              placeholder="Z_MY_MODULE"
              className="sap-field w-full font-mono uppercase"
              autoComplete="off"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="new-fm-title" className="w-[120px] text-right text-[12px] text-[#44586c]">Short text</label>
            <input
              id="new-fm-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What the function module does"
              className="sap-field w-full"
              autoComplete="off"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="new-fm-group" className="w-[120px] text-right text-[12px] text-[#44586c]">Function group</label>
            <select
              id="new-fm-group"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="sap-field w-full"
            >
              {groups.map((group) => (
                <option key={group.name} value={group.name}>{group.name} — {group.shortText || 'private group'}</option>
              ))}
            </select>
          </div>
          {groups.length === 0 && <p className="text-[11.5px] text-[#6f5712]">Create a private function group first.</p>}
          {error && <p className="text-[11.5px] text-[#b3261e]" role="alert">{error}</p>}
        </div>
        <DialogFooter>
          <button type="button" className="sap-btn" onClick={() => onOpenChange(false)}>Cancel</button>
          <button type="button" className="sap-btn sap-btn-primary" onClick={() => void submit()} disabled={busy || !name.trim() || !groupName}>
            {busy ? 'Creating…' : 'Create function module'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
