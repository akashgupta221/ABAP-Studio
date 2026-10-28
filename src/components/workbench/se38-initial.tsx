'use client'

// ── ABAP Editor (SE38): initial screen + subobject screens/dialogs ────
// Layout and button order follow the classic SAP GUI for HTML screens:
//   SE38 initial screen  → Check · Activate · Execute · Where-Used List ·
//                          Environment Analysis · Online Help · Delete… ·
//                          Copy… · Rename… · Debugging · With Variant ·
//                          Variants · More
//   Program → Attributes → "ABAP: Program Attributes <name> Change"
import { useEffect, useMemo, useRef, useState } from 'react'
import { FileCheck2, Search, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useWorkbench, api } from './use-workbench'
import {
  SE38_SUBOBJECT_LABELS,
  type ProgramListItem,
  type ProgramTabData,
  type ProgramType,
  type Se38Subobject,
} from './types'

const SUBOBJECT_ORDER: Se38Subobject[] = ['source', 'variants', 'attributes', 'text', 'doc']

const READONLY_FIELD =
  'flex h-[22px] w-full items-center border border-[#c6d3e2] bg-[#eef2f6] px-1.5 font-mono text-[12px] text-[#17324a] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.05)]'

const TYPE_LABELS: Record<string, string> = {
  REPORT: 'Executable program',
  CLASS: 'Class pool / ABAP class',
  INCLUDE: 'Include',
  FUNCTION_GROUP: 'Function group (main program)',
}

// Real SE38 Attributes type list (screenshot 6). The training runtime only
// executes REPORT/INCLUDE/CLASS/FUNCTION_GROUP; the other entries are shown
// for fidelity but disabled and rejected by the API.
const REAL_TYPE_OPTIONS: { value: string; label: string; supported: boolean }[] = [
  { value: 'REPORT', label: 'Executable program', supported: true },
  { value: 'INCLUDE', label: 'INCLUDE program', supported: true },
  { value: 'MODULE_POOL', label: 'Module pool', supported: false },
  { value: 'FUNCTION_GROUP', label: 'Function group', supported: true },
  { value: 'SUBROUTINE_POOL', label: 'Subroutine pool', supported: false },
  { value: 'INTERFACE_POOL', label: 'Interface pool', supported: false },
  { value: 'CLASS', label: 'Class pool', supported: true },
  { value: 'TYPE_POOL', label: 'Type pool', supported: false },
  { value: 'TRANSFORMATION', label: 'Transformation (XSLT or ST Program)', supported: false },
]

function formatDate(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}

// ── entry: initial screen → subobject screen / attributes dialog ──────
export function Se38Initial() {
  const showSubobject = useWorkbench((s) => s.se38ShowSubobject)
  const subobject = useWorkbench((s) => s.se38Subobject)

  // Classic SE38 opens Attributes as a popup over the initial screen
  // (screenshots 5–7), not as a full subobject screen.
  if (showSubobject && subobject === 'attributes') {
    return (
      <div className="relative h-full min-h-0">
        <InitialScreen />
        <ProgramAttributesDialog />
      </div>
    )
  }
  return showSubobject ? <SubobjectScreen /> : <InitialScreen />
}

// ── SE38 initial screen (Program + Subobjects + Display/Change) ───────
function InitialScreen() {
  const storedProgram = useWorkbench((s) => s.se38Program)
  const subobject = useWorkbench((s) => s.se38Subobject)
  const setSubobject = useWorkbench((s) => s.setSe38Subobject)
  const setStoredProgram = useWorkbench((s) => s.setSe38Program)
  const se38Display = useWorkbench((s) => s.se38Display)
  const openSyllabusTopic = useWorkbench((s) => s.openSyllabusTopic)

  const [value, setValue] = useState(storedProgram)
  const [f4Open, setF4Open] = useState(false)
  const [progList, setProgList] = useState<ProgramListItem[] | null>(null)
  const [f4Filter, setF4Filter] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const actionsRef = useRef<Record<string, () => void>>({})

  useEffect(() => {
    let alive = true
    api<{ programs: ProgramListItem[] }>('/api/programs')
      .then((r) => { if (alive) setProgList(r.programs) })
      .catch(() => { if (alive) setProgList([]) })
    return () => { alive = false }
  }, [])

  const openF4 = () => {
    setF4Filter('')
    setF4Open(true)
    if (!progList) {
      api<{ programs: ProgramListItem[] }>('/api/programs')
        .then((r) => setProgList(r.programs))
        .catch(() => setProgList([]))
    }
  }

  const f4Matches = useMemo(() => {
    if (!progList) return null
    const q = f4Filter.trim().toUpperCase()
    const list = q
      ? progList.filter((p) => p.name.includes(q) || p.title.toUpperCase().includes(q))
      : progList
    return list.slice(0, 60)
  }, [progList, f4Filter])

  const choose = (name: string) => {
    setValue(name)
    setStoredProgram(name)
    setF4Open(false)
    inputRef.current?.focus()
  }

  const submit = (mode: 'display' | 'change') => {
    setStoredProgram(value)
    void se38Display(mode)
  }

  const programName = () => value.trim().toUpperCase()

  const openCreate = () => {
    const s = useWorkbench.getState()
    const n = programName()
    if (!n) {
      s.addMessage('E', 'Enter a program name')
      return
    }
    if (!/^[ZY]/.test(n)) {
      s.addMessage('E', 'Customer objects must start with Z or Y')
      return
    }
    setStoredProgram(n)
    if (s.programs[n]) {
      s.addMessage('W', `Program ${n} already exists`)
      return
    }
    // classic flow: Create → Program Attributes → Object Directory Entry
    s.beginSe38Create(n)
  }

  const ensureLoaded = async () => {
    const n = programName()
    if (!n) {
      useWorkbench.getState().addMessage('E', 'Enter a program name')
      return null
    }
    const s = useWorkbench.getState()
    if (!s.programs[n]) await s.openProgramByName(n)
    return useWorkbench.getState().programs[n] ? n : null
  }

  const checkSyntax = async () => {
    const n = await ensureLoaded()
    if (n) void useWorkbench.getState().checkProgram(n)
  }

  const activate = async () => {
    const n = await ensureLoaded()
    if (!n) return
    const s = useWorkbench.getState()
    await s.saveProgram(n)
    await s.checkProgram(n)
    const issues = useWorkbench.getState().checkResults[n] ?? []
    if (issues.some((i) => i.kind === 'E')) {
      s.addMessage('E', `Program ${n} could not be activated — correct the syntax errors first`)
      return
    }
    s.setProgramActive(n, true)
    s.addMessage('S', `Program ${n} activated`)
  }

  const execute = async () => {
    const n = await ensureLoaded()
    if (n) void useWorkbench.getState().runProgram(n)
  }

  const whereUsed = async () => {
    const n = await ensureLoaded()
    if (n) void useWorkbench.getState().showWhereUsed(n)
  }

  const environmentAnalysis = () =>
    useWorkbench
      .getState()
      .addMessage('I', 'Environment Analysis: repository dependency analysis is not part of this training system')

  const onlineHelp = () => {
    useWorkbench.getState().addMessage('I', 'Online Help — opening the ABAP training syllabus')
    openSyllabusTopic(-1)
  }

  const information = () => {
    const n = programName()
    if (!n) {
      useWorkbench.getState().addMessage('E', 'Enter a program name')
      return
    }
    setStoredProgram(n)
    setSubobject('attributes')
    void se38Display('display')
  }

  const copyProgram = () => {
    const s = useWorkbench.getState()
    const n = programName()
    const prog = n ? s.programs[n] : undefined
    s.openNewDialog({
      prefillName: n ? `${n}_COPY`.slice(0, 30) : '',
      prefillSource: prog?.source,
      prefillTitle: prog?.title,
      prefillType: prog?.type ?? 'REPORT',
      saveAsFrom: n || undefined,
    })
  }

  const renameProgram = () =>
    useWorkbench
      .getState()
      .addMessage('I', 'Rename is not supported in this training system — use Copy… and Delete… instead')

  const deleteObject = () => {
    const s = useWorkbench.getState()
    const n = programName()
    if (!n) {
      s.addMessage('E', 'Enter a program name')
      return
    }
    if (s.programs[n]?.isExample) {
      s.addMessage('E', `Example program ${n} is read-only and cannot be deleted`)
      return
    }
    setStoredProgram(n)
    s.setConfirmDelete({ name: n })
  }

  const debugging = () =>
    useWorkbench.getState().addMessage(
      'I',
      'Debugging: the classic ABAP Debugger is not part of this training system — inspect values with WRITE statements',
    )

  const withVariant = () =>
    useWorkbench
      .getState()
      .addMessage(
        'I',
        `With Variant: no variants are maintained for ${programName() || 'this program'} — the program starts without a variant`,
      )

  const variants = () => {
    const n = programName()
    if (!n) {
      useWorkbench.getState().addMessage('E', 'Enter a program name')
      return
    }
    setStoredProgram(n)
    setSubobject('variants')
    void se38Display('display')
  }

  const openSubobject = (k: Se38Subobject, mode: 'display' | 'change' = 'display') => {
    const n = programName()
    if (!n) {
      useWorkbench.getState().addMessage('E', 'Enter a program name')
      return
    }
    setStoredProgram(n)
    setSubobject(k)
    void se38Display(mode)
  }

  useEffect(() => {
    actionsRef.current = {
      check: () => void checkSyntax(),
      activate: () => void activate(),
      execute: () => void execute(),
      'where-used': () => void whereUsed(),
      env: environmentAnalysis,
      help: onlineHelp,
      delete: deleteObject,
      copy: copyProgram,
      rename: renameProgram,
      debug: debugging,
      'with-variant': withVariant,
      variants,
      create: openCreate,
      display: () => submit('display'),
      change: () => submit('change'),
      attributes: information,
      text: () => openSubobject('text'),
      doc: () => openSubobject('doc'),
      'attributes-change': () => openSubobject('attributes', 'change'),
    }
  })

  useEffect(() => {
    const onAction = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string; id?: string }>).detail
      if (detail?.target !== 'se38' || !detail.id) return
      actionsRef.current[detail.id]?.()
    }
    window.addEventListener('sap-screen-action', onAction)
    return () => window.removeEventListener('sap-screen-action', onAction)
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#ebf1f7]">
      <div className="min-h-0 flex-1 overflow-auto bg-[#ebf1f7]">
        <h1 className="sr-only">ABAP Editor: Initial Screen</h1>
        <div className="w-full max-w-[784px] px-[32px] py-[24px]">
          {/* program field */}
          <div className="mb-[20px] flex items-center gap-[8px]">
            <label htmlFor="se38-program" className="w-[64px] shrink-0 text-right text-[12px] text-[#17324a]">
              Program:
            </label>
            <div className="flex">
              <input
                id="se38-program"
                ref={inputRef}
                value={value}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase()
                  setValue(v)
                  setStoredProgram(v)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submit('display')
                  } else if (e.key === 'F4') {
                    e.preventDefault()
                    openF4()
                  }
                }}
                className="sap-input sap-input-dashed h-[22px] w-[300px] px-1.5 font-mono uppercase text-[#17324a]"
                spellCheck={false}
                autoComplete="off"
              />
              <Popover open={f4Open} onOpenChange={setF4Open}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-[22px] w-[22px] items-center justify-center border border-l-0 border-[#9aa7b4] bg-[#f4f6f9] text-[#4C6B8A] hover:bg-white"
                    aria-label="Possible entries (F4)"
                    title="Possible entries (F4)"
                    onClick={openF4}
                  >
                    <Search className="h-[13px] w-[13px]" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  sideOffset={2}
                  className="w-[420px] rounded-none border border-[#8fa7bf] bg-white p-0 shadow-[0_4px_16px_rgba(10,30,60,0.35)]"
                >
                  <div className="flex items-center gap-1 border-b border-[#c6d7e6] bg-[#eef3f9] px-2 py-1">
                    <span className="text-[11.5px] font-semibold text-[#3f5468]">Program</span>
                    <span className="ml-auto text-[10.5px] text-[#55677a]">F4 — possible entries</span>
                  </div>
                  <div className="border-b border-[#dbe4ee] p-1.5">
                    <input
                      autoFocus
                      value={f4Filter}
                      onChange={(e) => setF4Filter(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && f4Matches && f4Matches.length > 0) {
                          e.preventDefault()
                          choose(f4Matches[0].name)
                        }
                      }}
                      className="sap-input w-full font-mono"
                      placeholder="Restrict value range…"
                      aria-label="Filter programs"
                    />
                  </div>
                  <div className="wb-scroll max-h-[260px] overflow-auto">
                    {f4Matches === null && (
                      <div className="px-2 py-1.5 text-[12px] text-[#55677a]">Loading programs…</div>
                    )}
                    {f4Matches?.length === 0 && (
                      <div className="px-2 py-1.5 text-[12px] text-[#55677a]">No programs found</div>
                    )}
                    {f4Matches?.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="flex w-full items-baseline gap-2 px-2 py-[3px] text-left hover:bg-[#bcd6f2]"
                        onClick={() => choose(p.name)}
                      >
                        <span className="shrink-0 font-mono text-[12px] text-[#0b4fa8]">{p.name}</span>
                        <span className="truncate text-[11.5px] text-[#55677a]">{p.title}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <button
              type="button"
              className="sap-btn !px-[12px]"
              title="Create program"
              onClick={openCreate}
            >
              Create
            </button>
          </div>

          {/* subobjects */}
          <div className="mb-[20px]">
            <div className="flex items-center gap-[12px]">
              <h3 className="text-[12px] text-[#17324a]">Subobjects</h3>
              <div className="h-px flex-1 bg-[#c7d8ea]" />
            </div>
            <div className="mt-[8px] flex flex-col gap-[7px] py-1" role="radiogroup" aria-label="Subobjects">
              {SUBOBJECT_ORDER.map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-[8px] text-[12px] text-[#17324a]">
                  <input
                    type="radio"
                    name="se38-subobject"
                    checked={subobject === k}
                    onChange={() => setSubobject(k)}
                    className="sap-radio"
                  />
                  <span>{SE38_SUBOBJECT_LABELS[k]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* display / change */}
          <div className="mt-[20px] flex gap-[8px]">
            <button type="button" className="sap-btn !px-[16px]" onClick={() => submit('display')}>
              Display
            </button>
            <button type="button" className="sap-btn !px-[16px]" onClick={() => submit('change')}>
              Change
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Program Attributes dialog (real SE38 popup, screenshots 5–7) ──────
function ProgramAttributesDialog() {
  const name = useWorkbench((s) => s.se38Program)
  const mode = useWorkbench((s) => s.se38Mode)
  const storeProg = useWorkbench((s) => s.programs[name])
  const createDraft = useWorkbench((s) => s.se38Create)
  const sessionUser = useWorkbench((s) => s.session.user)
  const creating = createDraft?.name === name
  const close = () => {
    const s = useWorkbench.getState()
    if (s.se38Create?.name === name) s.setSe38Create(null)
    s.setSe38ShowSubobject(false)
  }

  const [detail, setDetail] = useState<ProgramListItem | null>(null)
  const [title, setTitle] = useState('')
  const [selType, setSelType] = useState<string>('REPORT')
  const [application, setApplication] = useState('')
  const [editorLock, setEditorLock] = useState(false)
  const [busy, setBusy] = useState(false)
  // The details request runs asynchronously; never let its response overwrite
  // fields the user has already edited in the meantime.
  const fieldsTouched = useRef(false)

  useEffect(() => {
    let alive = true
    api<{ programs: ProgramListItem[] }>(`/api/programs?q=${encodeURIComponent(name)}`)
      .then((r) => {
        if (!alive) return
        const hit = r.programs.find((p) => p.name === name) ?? null
        setDetail(hit)
        if (fieldsTouched.current) return
        setTitle(hit?.title ?? createDraft?.title ?? '')
        setSelType(hit?.type ?? createDraft?.type ?? 'REPORT')
      })
      .catch(() => {
        if (alive) setDetail(null)
      })
    return () => {
      alive = false
    }
  }, [name, createDraft?.title, createDraft?.type])

  const isExample = detail?.isExample ?? storeProg?.isExample ?? false
  const editable = (mode === 'change' || creating) && !isExample
  const status = creating ? 'New' : storeProg?.dirty ? 'New(Revised)' : 'Active'
  const createdAt = creating ? '—' : formatDate(detail?.createdAt ?? detail?.updatedAt)
  const changedAt = creating ? '—' : formatDate(detail?.updatedAt)
  const typeSupported = REAL_TYPE_OPTIONS.some((o) => o.value === selType && o.supported)

  const checkEntries = () => {
    const s = useWorkbench.getState()
    if (!title.trim()) {
      s.addMessage('E', 'Attributes: enter a program title')
      return
    }
    if (!typeSupported) {
      s.addMessage('E', `Type ${selType} is not supported by the training runtime`)
      return
    }
    s.addMessage('S', `Attributes for program ${name} checked — entries are consistent`)
  }

  const save = async () => {
    if (!editable) {
      close()
      return
    }
    const s = useWorkbench.getState()
    if (!title.trim()) {
      s.addMessage('E', 'Attributes: enter a program title')
      return
    }
    if (!typeSupported) {
      s.addMessage('E', `Type ${selType} is not supported by the training runtime`)
      return
    }
    if (creating) {
      // Attributes are complete: continue with the object directory entry.
      s.setSe38Create(null)
      s.setSe38ShowSubobject(false)
      s.setObjectDir({ name, title: title.trim(), type: selType as ProgramType })
      s.addMessage('I', `Attributes for program ${name} saved — maintain the object directory entry`)
      return
    }
    setBusy(true)
    try {
      const ok = await useWorkbench.getState().updateProgramAttributes(name, {
        title: title.trim(),
        type: selType as ProgramType,
      })
      if (ok) {
        useWorkbench.getState().addMessage('S', `Attributes for program ${name} saved`)
        close()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent
        showCloseButton={false}
        className="sap-popup max-w-[620px] gap-0 p-0 sm:max-w-[620px]"
        aria-label={`Program attributes ${name}`}
      >
        <div className="sap-popup-title">
          <DialogTitle className="truncate text-[12px] font-bold text-[#17324a]">
            ABAP: Program Attributes {name} {editable ? 'Change' : 'Display'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Attributes of ABAP program {name}
          </DialogDescription>
          <div className="ml-auto flex items-center gap-1">
            <span aria-hidden className="flex h-[16px] w-[16px] items-center justify-center text-[11px] font-bold text-[#4c6b8a]">?</span>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              title="Close"
              className="sap-titlebar-close flex h-[16px] w-[16px] items-center justify-center text-[10px] leading-none text-[#17324a]"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="sap-popup-body">
          <div className="grid grid-cols-[140px_minmax(0,1fr)] items-center gap-x-2 gap-y-[7px]">
            <span className="text-right text-[12.5px] text-[#17324a]">Title</span>
            <input
              value={title}
              onChange={(e) => {
                fieldsTouched.current = true
                setTitle(e.target.value)
              }}
              className="sap-field w-full max-w-[360px]"
              disabled={!editable}
              maxLength={80}
              aria-label="Program title"
            />

            <span className="text-right text-[12.5px] text-[#17324a]">Original Language</span>
            <span className={`${READONLY_FIELD} w-[70px]`}>EN</span>

            <span className="text-right text-[12.5px] text-[#17324a]">Created</span>
            <span className={`${READONLY_FIELD} w-[260px]`}>
              {creating ? '—' : `${sessionUser} ${createdAt}`}
            </span>

            <span className="text-right text-[12.5px] text-[#17324a]">Last Changed</span>
            <span className={`${READONLY_FIELD} w-[260px]`}>
              {creating ? '—' : `${sessionUser} ${changedAt}`}
            </span>

            <span className="text-right text-[12.5px] text-[#17324a]">Status</span>
            <span className={`${READONLY_FIELD} w-[150px]`}>{status}</span>
          </div>

          <div className="my-3 border-t border-[#c6d7e6]" />

          <div className="grid grid-cols-[140px_minmax(0,1fr)] items-center gap-x-2 gap-y-[7px]">
            <span className="text-right text-[12.5px] text-[#17324a]">Type</span>
            <select
              className="sap-field w-[280px]"
              value={selType}
              onChange={(e) => {
                fieldsTouched.current = true
                setSelType(e.target.value)
              }}
              disabled={!editable}
              aria-label="Program type"
            >
              {REAL_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} disabled={!o.supported}>
                  {o.label}{o.supported ? '' : ' — not supported'}
                </option>
              ))}
            </select>

            <span className="text-right text-[12.5px] text-[#17324a]">Status</span>
            <select className="sap-field w-[200px]" defaultValue="unclassified" disabled={!editable} aria-label="Program status">
              <option value="unclassified">Unclassified</option>
              <option value="system">System program</option>
              <option value="test">Test program</option>
            </select>

            <span className="text-right text-[12.5px] text-[#17324a]">Authorization Group</span>
            <input className="sap-field w-[140px]" disabled={!editable} aria-label="Authorization group" />

            <span className="text-right text-[12.5px] text-[#17324a]">Application</span>
            <select
              className="sap-field w-[200px]"
              value={application}
              onChange={(e) => setApplication(e.target.value)}
              disabled={!editable}
              aria-label="Application"
            >
              <option value=""> </option>
              <option value="SAP">SAP Standard</option>
              <option value="CUSTOMER">Customer</option>
            </select>

            <span />
            <label className="flex items-center gap-2 text-[12.5px] text-[#17324a]">
              <input
                type="checkbox"
                className="sap-checkbox"
                checked={editorLock}
                onChange={(e) => setEditorLock(e.target.checked)}
                disabled={!editable}
              />
              Editor lock
            </label>
          </div>

          {isExample && (
            <p className="mt-3 text-[11.5px] italic text-[#7b6a2a]">
              Example program — attributes are read-only. Use Copy… to create your own object.
            </p>
          )}
          {!isExample && !editable && (
            <p className="mt-3 text-[11.5px] italic text-[#55677a]">
              Display mode — choose Change on the initial screen to edit the attributes.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#c6d7e6] bg-[#eef4fa] px-3 py-2">
          <button
            type="button"
            className="sap-btn sap-btn-primary inline-flex items-center gap-1.5"
            onClick={() => void save()}
            disabled={busy || !editable}
            title="Save attributes"
          >
            <FileCheck2 className="h-3.5 w-3.5" /> Save
          </button>
          <button
            type="button"
            className="sap-btn inline-flex items-center gap-1.5"
            onClick={checkEntries}
            title="Check entries"
          >
            <Search className="h-3.5 w-3.5" /> Check
          </button>
          <button type="button" className="sap-btn inline-flex items-center gap-1.5" onClick={close} title="Cancel">
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── subobject screens (variants / text elements / documentation) ──────
function SubobjectScreen() {
  const name = useWorkbench((s) => s.se38Program)
  const subobject = useWorkbench((s) => s.se38Subobject)
  const setShowSubobject = useWorkbench((s) => s.setSe38ShowSubobject)
  const storeProg = useWorkbench((s) => s.programs[name])

  const [detail, setDetail] = useState<ProgramListItem | null>(null)

  useEffect(() => {
    let alive = true
    api<{ programs: ProgramListItem[] }>(`/api/programs?q=${encodeURIComponent(name)}`)
      .then((r) => {
        if (alive) setDetail(r.programs.find((p) => p.name === name) ?? null)
      })
      .catch(() => {
        if (alive) setDetail(null)
      })
    return () => {
      alive = false
    }
  }, [name])

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* subobject info line */}
      <div className="flex items-center gap-3 border-b border-[#c6d7e6] bg-[#f7fafd] px-3 py-[3px] text-[12.5px]">
        <span className="font-mono font-bold text-[#12283c]">{name}</span>
        <span className="text-[#44586c]">{SE38_SUBOBJECT_LABELS[subobject]}</span>
        {detail?.title && <span className="max-w-[360px] truncate text-[#55677a]">{detail.title}</span>}
        <button
          type="button"
          className="sap-btn ml-auto px-2 py-[1px] text-[11.5px]"
          onClick={() => setShowSubobject(false)}
          title="Back (F3)"
        >
          Back (F3)
        </button>
      </div>

      <div className="wb-scroll min-h-0 flex-1 overflow-auto">
        {subobject === 'variants' && <VariantsScreen name={name} />}
        {subobject === 'text' && <TextElementsScreen name={name} source={storeProg?.source} detail={detail} />}
        {subobject === 'doc' && <DocumentationScreen name={name} detail={detail} />}
      </div>
    </div>
  )
}

function VariantsScreen({ name }: { name: string }) {
  return (
    <div className="px-4 py-3">
      <div className="mb-2 text-[12px] text-[#44586c]">
        Variants of program <span className="font-mono font-semibold text-[#12283c]">{name}</span>
      </div>
      <ListTable
        head={['Variant', 'Short text', 'Created by', 'Changed on']}
        rows={[]}
        empty={`No variants exist for program ${name}.`}
      />
    </div>
  )
}

function TextElementsScreen({
  name,
  source,
  detail,
}: {
  name: string
  source?: string
  detail: ProgramListItem | null
}) {
  const textSymbols = useMemo(() => {
    if (!source) return [] as string[]
    const found = new Set<string>()
    const re = /TEXT-(\d{3})/gi
    let m: RegExpExecArray | null = re.exec(source)
    while (m) {
      found.add(`TEXT-${m[1]}`)
      m = re.exec(source)
    }
    return [...found].sort()
  }, [source])

  const selectionTexts = useMemo(() => {
    if (!source) return [] as string[]
    const names = new Set<string>()
    const re = /^[ \t]*(?:PARAMETERS?|SELECT-OPTIONS)[ \t]*:?[ \t]*(.+)$/gim
    let m: RegExpExecArray | null = re.exec(source)
    while (m) {
      for (const token of m[1].split(',')) {
        const id = token.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)/)
        if (id?.[1]) names.add(id[1].toUpperCase())
      }
      m = re.exec(source)
    }
    return [...names].sort()
  }, [source])

  return (
    <div className="space-y-5 px-4 py-3">
      <section>
        <h3 className="mb-1 text-[12px] font-bold text-[#33475c]">Text symbols</h3>
        <ListTable
          head={['Symbol', 'Text']}
          rows={textSymbols.map((s) => [s, '—'])}
          empty={`No text symbols exist for program ${name}.`}
        />
      </section>

      <section>
        <h3 className="mb-1 text-[12px] font-bold text-[#33475c]">Selection texts</h3>
        <ListTable
          head={['Name', 'Text']}
          rows={selectionTexts.map((s) => [s, '—'])}
          empty={`No selection texts exist for program ${name}${source ? '' : ' (open the program once to scan its source)'}.`}
        />
      </section>

      <section>
        <h3 className="mb-1 text-[12px] font-bold text-[#33475c]">List headings</h3>
        <div className="grid w-full max-w-[640px] grid-cols-[150px_minmax(0,1fr)] items-center gap-x-3 gap-y-[7px]">
          <span className="text-right text-[12.5px] text-[#17324a]">List heading 1:</span>
          <span className={READONLY_FIELD}>{detail?.title || name}</span>
          <span className="text-right text-[12.5px] text-[#17324a]">List heading 2:</span>
          <span className={READONLY_FIELD}>—</span>
        </div>
      </section>
    </div>
  )
}

function DocumentationScreen({ name, detail }: { name: string; detail: ProgramListItem | null }) {
  const text = detail?.description?.trim()
  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-3">
      <div className="mb-2 text-[12px] text-[#44586c]">
        Program documentation for <span className="font-mono font-semibold text-[#12283c]">{name}</span>
      </div>
      <div className="wb-scroll min-h-[220px] flex-1 overflow-auto border border-[#c6d3e2] bg-white p-3 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.06)]">
        {text ? (
          <p className="whitespace-pre-wrap text-[12.5px] leading-[1.5] text-[#17324a]">{text}</p>
        ) : (
          <p className="text-[12.5px] italic text-[#55677a]">
            No documentation maintained for program {name}.
          </p>
        )}
      </div>
      {detail?.topicTitle && (
        <p className="mt-2 text-[11.5px] text-[#55677a]">Training topic: {detail.topicTitle}</p>
      )}
    </div>
  )
}

// ── classic SAP list table (head row + optional single message row) ───
function ListTable({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  return (
    <table className="w-full max-w-[760px] border-collapse text-[12px]">
      <thead>
        <tr>
          {head.map((h) => (
            <th
              key={h}
              className="border border-[#c6d7e6] bg-[#eef3f9] px-2 py-[3px] text-left font-semibold text-[#3f5468]"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={head.length}
              className="border border-[#c6d7e6] bg-white px-2 py-[5px] text-[12px] text-[#44586c]"
            >
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="border border-[#c6d7e6] bg-white px-2 py-[3px] font-mono">
                  {c}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}
