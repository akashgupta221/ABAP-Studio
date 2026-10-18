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
  Se38Subobject,
  SearchGroup,
  SearchHit,
  SelectionScreenItem,
  SystemMessage,
  TabItem,
  ViewKind,
} from './types'
import { SE38_SUBOBJECT_LABELS } from './types'

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

export interface SapSession {
  user: string
  client: string
  language: string
  loggedIn: boolean
}

export interface WhereUsedState {
  program: string
  open: boolean
  loading: boolean
  hits: SearchHit[]
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
  commandPaletteOpen: boolean
  searchQuery: string
  browserTable: string | null
  syllabusTopicId: number | null
  selectedFunction: string | null
  // SE38 (ABAP Editor) initial screen + subobjects
  se38Program: string
  se38Subobject: Se38Subobject
  se38ShowSubobject: boolean
  lastTcode: string
  // dialogs
  pendingSelection: PendingSelection | null
  selectionBusy: boolean
  newDialog: NewDialogState
  confirmCreate: { name: string } | null
  aboutOpen: boolean
  tcodeDialogOpen: boolean
  favorites: Favorite[]

  // ── SAP session / logon pad ─────────────────────────────────────────
  session: SapSession
  logon: (p: { user: string; client: string; language: string }) => void
  restoreSession: (s: SapSession) => void
  logoff: () => void
  insertMode: 'INS' | 'OVR'
  toggleInsertMode: () => void
  systemInfoVisible: boolean
  toggleSystemInfo: () => void
  editorFontSize: number
  setEditorFontSize: (n: number) => void

  // ── SAP popups ──────────────────────────────────────────────────────
  systemStatusOpen: boolean
  setSystemStatusOpen: (v: boolean) => void
  logoffConfirm: boolean
  setLogoffConfirm: (v: boolean) => void
  confirmDelete: { name: string } | null
  setConfirmDelete: (v: { name: string } | null) => void

  // ── where-used list ─────────────────────────────────────────────────
  whereUsed: WhereUsedState
  showWhereUsed: (name: string) => Promise<void>
  closeWhereUsed: () => void

  // ── find in editor ──────────────────────────────────────────────────
  findOpen: boolean
  setFindOpen: (v: boolean) => void
  findQuery: string
  setFindQuery: (v: string) => void
  findNonce: number
  runFindNext: () => void

  // ── editor history / statement patterns (toolbar-driven) ────────────
  undoNonce: number
  redoNonce: number
  insertRequest: { text: string; nonce: number } | null
  requestUndo: () => void
  requestRedo: () => void
  requestInsert: (text: string) => void

  // actions
  navigate: (view: ViewKind) => void
  setCommandPaletteOpen: (open: boolean) => void
  setSearchQuery: (q: string) => void
  openBrowserFor: (table: string) => void
  openSyllabusTopic: (id: number) => void
  setSelectedFunction: (name: string | null) => void
  openSe38Initial: (program?: string) => void
  setSe38Program: (name: string) => void
  setSe38Subobject: (subobject: Se38Subobject) => void
  setSe38ShowSubobject: (v: boolean) => void
  se38Display: (mode?: 'display' | 'change') => Promise<void>
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
  setProgramActive: (name: string, active: boolean) => void

  openNewDialog: (prefill?: Partial<NewDialogState>) => void
  closeNewDialog: () => void
  setConfirmCreate: (v: { name: string } | null) => void
  setAboutOpen: (v: boolean) => void
  setTcodeDialogOpen: (v: boolean) => void

  refreshFavorites: () => Promise<void>
  toggleFavorite: (objectType: string, objectName: string, label?: string) => Promise<void>
  isFavorite: (objectType: string, objectName: string) => boolean
}

let msgId = 1

function tabOf(kind: 'program' | 'output', name: string): TabItem {
  return { key: `${kind}:${name}`, kind, programName: name }
}

// stale-run guard: bump on every new run / cancel / submit so late
// execute responses (e.g. REQUIRES_INPUT) can never resurface old screens
let runSeq = 0

export const useWorkbench = create<WorkbenchState>((set, get) => ({
  view: 'home',
  tabs: [],
  activeTabKey: null,
  programs: {},
  outputs: {},
  checkResults: {},
  messages: [],
  commandPaletteOpen: false,
  searchQuery: '',
  browserTable: null,
  syllabusTopicId: null,
  selectedFunction: null,
  se38Program: '',
  se38Subobject: 'source',
  se38ShowSubobject: false,
  lastTcode: 'SESSION_MANAGER',
  pendingSelection: null,
  selectionBusy: false,
  newDialog: { open: false },
  confirmCreate: null,
  aboutOpen: false,
  tcodeDialogOpen: false,
  favorites: [],

  session: { user: 'DEVELOPER', client: '100', language: 'EN', loggedIn: false },
  insertMode: 'INS',
  systemInfoVisible: true,
  editorFontSize: 13,
  systemStatusOpen: false,
  logoffConfirm: false,
  confirmDelete: null,
  whereUsed: { program: '', open: false, loading: false, hits: [] },
  findOpen: false,
  findQuery: '',
  findNonce: 0,
  undoNonce: 0,
  redoNonce: 0,
  insertRequest: null,

  navigate: (view) => {
    if (view !== 'tab') set({ view })
  },

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  openBrowserFor: (table) => set({ view: 'browser', browserTable: table.toUpperCase(), lastTcode: 'SE16' }),

  openSyllabusTopic: (id) => set({ view: 'syllabus', syllabusTopicId: id, lastTcode: 'TRAINING' }),

  setSelectedFunction: (name) => set({ view: 'functions', selectedFunction: name, lastTcode: 'SE37' }),

  // ── SE38 (ABAP Editor): initial screen + subobjects ──
  openSe38Initial: (program) => {
    const s = get()
    const activeProg = s.tabs.find((t) => t.key === s.activeTabKey)?.programName ?? ''
    const fallback = s.se38Program || activeProg
    set({
      view: 'se38',
      lastTcode: 'SE38',
      se38ShowSubobject: false,
      se38Program: (program ?? fallback).toUpperCase(),
    })
  },
  setSe38Program: (name) => set({ se38Program: name.toUpperCase() }),
  setSe38Subobject: (subobject) => set({ se38Subobject: subobject }),
  setSe38ShowSubobject: (v) => set({ se38ShowSubobject: v }),

  se38Display: async (mode = 'display') => {
    const s = get()
    const name = s.se38Program.trim().toUpperCase()
    if (!name) {
      s.addMessage('E', 'Enter a program name')
      return
    }
    set({ se38Program: name })
    try {
      const { programs } = await api<{ programs: ProgramListItem[] }>(
        `/api/programs?q=${encodeURIComponent(name)}`,
      )
      const hit = programs.find((p) => p.name === name)
      if (!hit) {
        // classic SE38: Change on an unknown Z/Y name offers to create it
        if (mode === 'change' && /^[ZY]/.test(name)) {
          set({ confirmCreate: { name } })
          return
        }
        get().addMessage('E', `Program ${name} does not exist`)
        return
      }
      if (s.se38Subobject === 'source') {
        await get().openProgramByName(name)
        get().addMessage('S', `ABAP Editor: ${name}`)
        return
      }
      set({ se38ShowSubobject: true })
      get().addMessage('S', `ABAP Editor: ${name} — ${SE38_SUBOBJECT_LABELS[s.se38Subobject]}`)
    } catch {
      get().addMessage('E', `Program ${name} does not exist`)
    }
  },

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
    const seq = ++runSeq
    set((s) => ({ programs: { ...s.programs, [name]: { ...prog, running: true } } }))
    try {
      const result = await api<RunResult>('/api/execute', {
        method: 'POST',
        body: JSON.stringify({ name, source: prog.source }),
      })
      if (seq !== runSeq) return // a newer run / cancel superseded this response
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
    runSeq++ // supersede any in-flight run response
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
    runSeq++ // ignore late REQUIRES_INPUT responses from the cancelled run
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
          [name]: { ...s.programs[name], dirty: false, active: false, version: program.version },
        },
      }))
      get().addMessage('S', `${name} saved (version ${program.version})`)
      toast.success('Saved', { description: `${name} · version ${program.version}` })
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
    } catch (e) {
      toast.error((e as Error).message)
      get().addMessage('E', (e as Error).message)
    }
  },

  setProgramActive: (name, active) =>
    set((s) =>
      s.programs[name]
        ? { programs: { ...s.programs, [name]: { ...s.programs[name], active } } }
        : {},
    ),

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

  // ── SAP session ─────────────────────────────────────────────────────
  logon: ({ user, client, language }) => {
    const session: SapSession = {
      user: user.trim().toUpperCase() || 'DEVELOPER',
      client: client.trim() || '100',
      language: (language.trim() || 'EN').toUpperCase(),
      loggedIn: true,
    }
    set({ session })
    try {
      window.localStorage.setItem('sap.session', JSON.stringify(session))
    } catch {
      /* private mode */
    }
    get().addMessage('S', `Logon to system NPL (client ${session.client}) successful`)
  },

  restoreSession: (session) => set({ session: { ...session, loggedIn: true } }),

  logoff: () => {
    // forget the remembered session so the logon pad stays visible
    try {
      window.localStorage.removeItem('sap.session')
    } catch {
      /* private mode */
    }
    set({
      session: { ...get().session, loggedIn: false },
      tabs: [],
      activeTabKey: null,
      programs: {},
      outputs: {},
      checkResults: {},
      messages: [],
      view: 'home',
      se38Program: '',
      se38Subobject: 'source',
      se38ShowSubobject: false,
      pendingSelection: null,
      findOpen: false,
      systemStatusOpen: false,
      confirmDelete: null,
      whereUsed: { program: '', open: false, loading: false, hits: [] },
    })
  },

  toggleInsertMode: () => set((s) => ({ insertMode: s.insertMode === 'INS' ? 'OVR' : 'INS' })),
  toggleSystemInfo: () => set((s) => ({ systemInfoVisible: !s.systemInfoVisible })),
  setEditorFontSize: (n) => set({ editorFontSize: n }),
  setSystemStatusOpen: (v) => set({ systemStatusOpen: v }),
  setLogoffConfirm: (v) => set({ logoffConfirm: v }),
  setConfirmDelete: (v) => set({ confirmDelete: v }),
  setFindOpen: (v) => set({ findOpen: v }),
  setFindQuery: (v) => set({ findQuery: v }),
  runFindNext: () => set((s) => ({ findNonce: s.findNonce + 1 })),

  requestUndo: () => set((s) => ({ undoNonce: s.undoNonce + 1 })),
  requestRedo: () => set((s) => ({ redoNonce: s.redoNonce + 1 })),
  requestInsert: (text) =>
    set((s) => ({ insertRequest: { text, nonce: (s.insertRequest?.nonce ?? 0) + 1 } })),

  showWhereUsed: async (name) => {
    set({ whereUsed: { program: name, open: true, loading: true, hits: [] } })
    try {
      const { groups } = await api<{ groups: SearchGroup[] }>(`/api/search?q=${encodeURIComponent(name)}`)
      const hits = (groups ?? [])
        .flatMap((g) => g.hits)
        .filter((h) => !(h.objectType === 'PROGRAM' && h.name === name))
        .slice(0, 200)
      set((s) => ({ whereUsed: { ...s.whereUsed, loading: false, hits } }))
      get().addMessage('S', `Where-used list for ${name}: ${hits.length} hit(s)`)
    } catch (e) {
      set((s) => ({ whereUsed: { ...s.whereUsed, loading: false } }))
      get().addMessage('E', `Where-used list failed: ${(e as Error).message}`)
    }
  },

  closeWhereUsed: () => set((s) => ({ whereUsed: { ...s.whereUsed, open: false } })),
}))
