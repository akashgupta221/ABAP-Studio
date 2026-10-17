'use client'

// ── Central workbench store (zustand) ─────────────────────────────────
import { create } from 'zustand'
import { toast } from 'sonner'
import type {
  CheckIssue,
  Favorite,
  MessageType,
  Paradigm,
  ProgramFull,
  ProgramListItem,
  ProgramTabData,
  ProgramType,
  RunResult,
  SelectionScreenItem,
  SystemMessage,
  TabItem,
  ViewKind,
} from './types'

// ── tiny fetch helper ─────────────────────────────────────────────────
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  let data: unknown = {}
  try {
    data = await res.json()
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const msg = (data as { error?: string })?.error || `Request failed (${res.status})`
    throw new Error(msg)
  }
  return data as T
}

// ── store types ───────────────────────────────────────────────────────
interface PendingSelection {
  programName: string
  items: SelectionScreenItem[]
}

interface NewDialogState {
  open: boolean
  prefillName?: string
  prefillType?: ProgramType
  prefillSource?: string
  prefillTitle?: string
  saveAsFrom?: string // program name this is a copy of
}

interface WorkbenchState {
  view: ViewKind
  tabs: TabItem[]
  activeTabKey: string | null
  programs: Record<string, ProgramTabData>
  outputs: Record<string, RunResult>
  checkResults: Record<string, CheckIssue[]>
  messages: SystemMessage[]
  // UI
  navigatorOpen: boolean
  commandPaletteOpen: boolean
  searchQuery: string
  browserTable: string | null
  syllabusTopicId: number | null
  selectedFunction: string | null
  lastTcode: string
  repoVersion: number // bump → navigator refreshes
  // dialogs
  pendingSelection: PendingSelection | null
  selectionBusy: boolean
  newDialog: NewDialogState
  confirmCreate: { name: string } | null
  aboutOpen: boolean
  tcodeDialogOpen: boolean
  favorites: Favorite[]

  // actions
  navigate: (view: ViewKind) => void
  setNavigatorOpen: (open: boolean) => void
  setCommandPaletteOpen: (open: boolean) => void
  setSearchQuery: (q: string) => void
  openBrowserFor: (table: string) => void
  openSyllabusTopic: (id: number) => void
  setSelectedFunction: (name: string | null) => void
  addMessage: (msgType: MessageType, text: string) => void

  openProgramByName: (name: string) => Promise<void>
  openProgramById: (id: string) => Promise<void>
  activateTab: (key: string) => void
  closeTab: (key: string) => void
  updateSource: (name: string, source: string) => void
  setOutput: (name: string, result: RunResult) => void

  runProgram: (name: string) => Promise<void>
  submitSelection: (parameters: Record<string, string | string[]>) => Promise<void>
  cancelSelection: () => void
  checkProgram: (name: string) => Promise<void>
  saveProgram: (name: string) => Promise<void>
  createProgram: (input: {
    name: string
    title: string
    type: ProgramType
    paradigm?: Paradigm
    topicId?: number | null
    source?: string
    tags?: string
    description?: string
  }) => Promise<boolean>
  deleteProgram: (name: string) => Promise<void>

  openNewDialog: (prefill?: Partial<NewDialogState>) => void
  closeNewDialog: () => void
  setConfirmCreate: (v: { name: string } | null) => void
  setAboutOpen: (v: boolean) => void
  setTcodeDialogOpen: (v: boolean) => void

  refreshFavorites: () => Promise<void>
  toggleFavorite: (objectType: string, objectName: string, label?: string) => Promise<void>
  isFavorite: (objectType: string, objectName: string) => boolean
  bumpRepo: () => void
}

let msgId = 1

function tabOf(kind: 'program' | 'output', name: string): TabItem {
  return { key: `${kind}:${name}`, kind, programName: name }
}

export const useWorkbench = create<WorkbenchState>((set, get) => ({
  view: 'home',
  tabs: [],
  activeTabKey: null,
  programs: {},
  outputs: {},
  checkResults: {},
  messages: [],
  navigatorOpen: true,
  commandPaletteOpen: false,
  searchQuery: '',
  browserTable: null,
  syllabusTopicId: null,
  selectedFunction: null,
  lastTcode: 'SESSION_MANAGER',
  repoVersion: 0,
  pendingSelection: null,
  selectionBusy: false,
  newDialog: { open: false },
  confirmCreate: null,
  aboutOpen: false,
  tcodeDialogOpen: false,
  favorites: [],

  navigate: (view) => {
    if (view !== 'tab') set({ view })
  },

  setNavigatorOpen: (open) => set({ navigatorOpen: open }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  openBrowserFor: (table) => set({ view: 'browser', browserTable: table.toUpperCase(), lastTcode: 'SE16' }),

  openSyllabusTopic: (id) => set({ view: 'syllabus', syllabusTopicId: id, lastTcode: 'TRAINING' }),

  setSelectedFunction: (name) => set({ view: 'functions', selectedFunction: name, lastTcode: 'SE37' }),

  addMessage: (msgType, text) =>
    set((s) => ({
      messages: [...s.messages.slice(-49), { id: msgId++, msgType, text, createdAt: Date.now() }],
    })),

  // ── open programs ───────────────────────────────────────────────────
  openProgramByName: async (name) => {
    const upper = name.toUpperCase()
    // already open?
    if (get().programs[upper]) {
      const tab = tabOf('program', upper)
      set((s) => ({
        tabs: s.tabs.some((t) => t.key === tab.key) ? s.tabs : [...s.tabs, tab],
        activeTabKey: tab.key,
        view: 'tab',
      }))
      return
    }
    try {
      const { programs } = await api<{ programs: ProgramListItem[] }>(
        `/api/programs?q=${encodeURIComponent(upper)}`,
      )
      const hit = programs.find((p) => p.name === upper)
      if (!hit) {
        toast.error(`Program ${upper} does not exist`)
        get().addMessage('E', `Object ${upper} not found in repository`)
        return
      }
      await get().openProgramById(hit.id)
    } catch (e) {
      toast.error((e as Error).message)
    }
  },

  openProgramById: async (id) => {
    try {
      const { program } = await api<{ program: ProgramFull }>(`/api/programs/${id}`)
      const data: ProgramTabData = {
        id: program.id,
        name: program.name,
        title: program.title,
        type: program.type,
        paradigm: program.paradigm,
        isExample: program.isExample,
        version: program.version,
        executions: program.executions,
        tags: program.tags,
        topicId: program.topicId,
        topicTitle: program.topic?.title ?? program.topicTitle ?? null,
        source: program.source,
        dirty: false,
        running: false,
      }
      const tab = tabOf('program', program.name)
      set((s) => ({
        programs: { ...s.programs, [program.name]: data },
        tabs: s.tabs.some((t) => t.key === tab.key) ? s.tabs : [...s.tabs, tab],
        activeTabKey: tab.key,
        view: 'tab',
        lastTcode: 'SE38',
      }))
    } catch (e) {
      toast.error((e as Error).message)
    }
  },

  activateTab: (key) => set({ activeTabKey: key, view: 'tab' }),

  closeTab: (key) =>
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.key === key)
      const tabs = s.tabs.filter((t) => t.key !== key)
      let activeTabKey = s.activeTabKey
      if (s.activeTabKey === key) {
        activeTabKey = tabs[Math.min(idx, tabs.length - 1)]?.key ?? null
      }
      const view: ViewKind = activeTabKey ? 'tab' : 'home'
      return { tabs, activeTabKey, view }
    }),

  updateSource: (name, source) =>
    set((s) => {
      const p = s.programs[name]
      if (!p || p.source === source) return {}
      return { programs: { ...s.programs, [name]: { ...p, source, dirty: true } } }
    }),

  setOutput: (name, result) => set((s) => ({ outputs: { ...s.outputs, [name]: result } })),

  // ── execute ─────────────────────────────────────────────────────────
  runProgram: async (name) => {
    const prog = get().programs[name]
    if (!prog || prog.running) return
    set((s) => ({ programs: { ...s.programs, [name]: { ...prog, running: true } } }))
    try {
      const result = await api<RunResult>('/api/execute', {
        method: 'POST',
        body: JSON.stringify({ name, source: prog.source }),
      })
      if (result.status === 'REQUIRES_INPUT' && result.selectionScreen?.length) {
        set({ pendingSelection: { programName: name, items: result.selectionScreen } })
        return // running stays true while dialog is open? reset below
      }
      get().setOutput(name, result)
      const outTab = tabOf('output', name)
      set((s) => ({
        tabs: s.tabs.some((t) => t.key === outTab.key) ? s.tabs : [...s.tabs, outTab],
        activeTabKey: outTab.key,
        view: 'tab',
      }))
      if (result.status === 'ERROR') {
        get().addMessage('E', `${name}: ${result.error?.abapType ?? result.error?.kind} — ${result.error?.message ?? ''}`)
      } else {
        get().addMessage('S', `Program ${name} executed (${result.durationMs} ms)`)
      }
    } catch (e) {
      toast.error((e as Error).message)
      get().addMessage('E', (e as Error).message)
    } finally {
      const p = get().programs[name]
      if (p) set((s) => ({ programs: { ...s.programs, [name]: { ...p, running: false } } }))
    }
  },

  submitSelection: async (parameters) => {
    const pending = get().pendingSelection
    if (!pending) return
    const { programName: name } = pending
    const prog = get().programs[name]
    if (prog) set((s) => ({ programs: { ...s.programs, [name]: { ...prog, running: true } } }))
    set({ selectionBusy: true })
    try {
      const result = await api<RunResult>('/api/execute', {
        method: 'POST',
        body: JSON.stringify({ name, source: prog?.source ?? '', parameters }),
      })
      set({ pendingSelection: null })
      get().setOutput(name, result)
      const outTab = tabOf('output', name)
      set((s) => ({
        tabs: s.tabs.some((t) => t.key === outTab.key) ? s.tabs : [...s.tabs, outTab],
        activeTabKey: outTab.key,
        view: 'tab',
      }))
      if (result.status === 'ERROR') {
        get().addMessage('E', `${name}: ${result.error?.abapType ?? result.error?.kind} — ${result.error?.message ?? ''}`)
      } else {
        get().addMessage('S', `Program ${name} executed (${result.durationMs} ms)`)
      }
    } catch (e) {
      toast.error((e as Error).message)
      get().addMessage('E', (e as Error).message)
    } finally {
      set({ selectionBusy: false })
      const p = get().programs[name]
      if (p) set((s) => ({ programs: { ...s.programs, [name]: { ...p, running: false } } }))
    }
  },

  cancelSelection: () => {
    const pending = get().pendingSelection
    set({ pendingSelection: null })
    if (pending) {
      const p = get().programs[pending.programName]
      if (p) set((s) => ({ programs: { ...s.programs, [pending.programName]: { ...p, running: false } } }))
    }
  },

  // ── check ───────────────────────────────────────────────────────────
  checkProgram: async (name) => {
    const prog = get().programs[name]
    if (!prog) return
    try {
      const { issues } = await api<{ issues: CheckIssue[] }>('/api/check', {
        method: 'POST',
        body: JSON.stringify({ source: prog.source }),
      })
      set((s) => ({ checkResults: { ...s.checkResults, [name]: issues } }))
      const errors = issues.filter((i) => i.kind === 'E').length
      const warns = issues.filter((i) => i.kind === 'W').length
      if (errors === 0 && warns === 0) {
        get().addMessage('S', `Syntax check OK — ${name}`)
        toast.success('Syntax check OK', { description: name })
      } else if (errors === 0) {
        get().addMessage('W', `Syntax check: ${warns} warning(s) — ${name}`)
        toast.warning('Syntax check: warnings found', { description: `${warns} warning(s) in ${name}` })
      } else {
        get().addMessage('E', `Syntax errors in ${name}: ${errors} error(s)`)
        toast.error('Syntax errors found', { description: `${errors} error(s), ${warns} warning(s) in ${name}` })
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  },

  // ── save ────────────────────────────────────────────────────────────
  saveProgram: async (name) => {
    const prog = get().programs[name]
    if (!prog) return
    if (prog.isExample) {
      toast.info('Example is read-only — use Save As', {
        description: 'Examples are protected. Create your own copy under a Z-name via Save As.',
        action: {
          label: 'Save As…',
          onClick: () =>
            get().openNewDialog({
              prefillName: `${name}_COPY`,
              prefillSource: prog.source,
              prefillTitle: prog.title,
              prefillType: prog.type,
              saveAsFrom: name,
            }),
        },
      })
      get().addMessage('W', 'Example programs are read-only — use Save As')
      return
    }
    if (!prog.dirty) {
      get().addMessage('S', `${name} — no changes to save`)
      toast.info('Nothing to save', { description: `${name} has no unsaved changes.` })
      return
    }
    try {
      const { program } = await api<{ program: ProgramFull }>(`/api/programs/${prog.id}`, {
        method: 'PUT',
        body: JSON.stringify({ source: prog.source }),
      })
      set((s) => ({
        programs: {
          ...s.programs,
          [name]: { ...s.programs[name], dirty: false, version: program.version },
        },
      }))
      get().addMessage('S', `${name} saved (version ${program.version})`)
      toast.success('Saved', { description: `${name} · version ${program.version}` })
      get().bumpRepo()
    } catch (e) {
      toast.error((e as Error).message)
      get().addMessage('E', (e as Error).message)
    }
  },

  createProgram: async (input) => {
    try {
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409) {
        toast.error((data as { error?: string })?.error ?? 'Object already exists')
        return false
      }
      if (!res.ok) {
        toast.error((data as { error?: string })?.error ?? 'Could not create object')
        return false
      }
      const { program } = data as { program: ProgramFull }
      get().addMessage('S', `Object ${program.name} created`)
      toast.success('Object created', { description: `${program.name} (${program.type})` })
      set((s) => ({ newDialog: { open: false } }))
      get().bumpRepo()
      await get().openProgramById(program.id)
      return true
    } catch (e) {
      toast.error((e as Error).message)
      return false
    }
  },

  deleteProgram: async (name) => {
    const prog = get().programs[name]
    if (!prog) return
    try {
      await api(`/api/programs/${prog.id}`, { method: 'DELETE' })
      get().addMessage('S', `Object ${name} deleted`)
      toast.success('Object deleted', { description: name })
      // close tabs of that program
      set((s) => {
        const tabs = s.tabs.filter((t) => t.programName !== name)
        const activeTabKey = tabs.some((t) => t.key === s.activeTabKey) ? s.activeTabKey : (tabs[0]?.key ?? null)
        const view: ViewKind = activeTabKey ? 'tab' : 'home'
        const programs = { ...s.programs }
        delete programs[name]
        return { tabs, activeTabKey, view, programs }
      })
      get().bumpRepo()
    } catch (e) {
      toast.error((e as Error).message)
      get().addMessage('E', (e as Error).message)
    }
  },

  openNewDialog: (prefill) =>
    set({ newDialog: { open: true, ...prefill } }),
  closeNewDialog: () => set({ newDialog: { open: false } }),
  setConfirmCreate: (v) => set({ confirmCreate: v }),
  setAboutOpen: (v) => set({ aboutOpen: v }),
  setTcodeDialogOpen: (v) => set({ tcodeDialogOpen: v }),

  // ── favorites ───────────────────────────────────────────────────────
  refreshFavorites: async () => {
    try {
      const { favorites } = await api<{ favorites: Favorite[] }>('/api/favorites')
      set({ favorites })
    } catch {
      /* DB may be seeding */
    }
  },

  toggleFavorite: async (objectType, objectName, label) => {
    const upperType = objectType.toUpperCase()
    const upperName = objectName.toUpperCase()
    const exists = get().favorites.some(
      (f) => f.objectType === upperType && f.objectName === upperName,
    )
    try {
      if (exists) {
        await api(
          `/api/favorites?objectType=${upperType}&objectName=${encodeURIComponent(upperName)}`,
          { method: 'DELETE' },
        )
        set((s) => ({
          favorites: s.favorites.filter(
            (f) => !(f.objectType === upperType && f.objectName === upperName),
          ),
        }))
        get().addMessage('S', `${upperName} removed from favorites`)
      } else {
        await api('/api/favorites', {
          method: 'POST',
          body: JSON.stringify({ objectType: upperType, objectName: upperName, label: label ?? '' }),
        })
        await get().refreshFavorites()
        get().addMessage('S', `${upperName} added to favorites`)
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  },

  isFavorite: (objectType, objectName) =>
    get().favorites.some(
      (f) => f.objectType === objectType.toUpperCase() && f.objectName === objectName.toUpperCase(),
    ),

  bumpRepo: () => set((s) => ({ repoVersion: s.repoVersion + 1 })),
}))
