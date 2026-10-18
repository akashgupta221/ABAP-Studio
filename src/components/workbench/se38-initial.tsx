'use client'

// ── ABAP Editor (SE38): initial screen + subobject screens ────────────
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bug, ChevronDown, Copy, FileCheck2, FilePlus2, Files, Glasses, Info, Monitor, Pencil, Play,
  Search, Trash2,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useWorkbench, api } from './use-workbench'
import {
  SE38_SUBOBJECT_LABELS,
  type ProgramListItem,
  type ProgramTabData,
  type Se38Subobject,
} from './types'

const SUBOBJECT_ORDER: Se38Subobject[] = ['source', 'variants', 'attributes', 'doc', 'text']

const READONLY_FIELD =
  'flex h-[20px] w-full items-center border border-[#c6d3e2] bg-[#eef2f6] px-1.5 font-mono text-[12px] text-[#1c2b3a] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.05)]'

const TYPE_LABELS: Record<string, string> = {
  REPORT: 'Executable program',
  CLASS: 'Class pool / ABAP class',
  INCLUDE: 'Include',
  FUNCTION_GROUP: 'Function group (main program)',
}

function formatDate(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}

// ── entry: initial screen → subobject screen (SAP subobject flow) ─────
export function Se38Initial() {
  const showSubobject = useWorkbench((s) => s.se38ShowSubobject)
  return showSubobject ? <SubobjectScreen /> : <InitialScreen />
}

// ── SE38 initial screen (Program + Subobjects + Display/Change) ───────
function Se38ToolBtn({
  icon, title, onClick,
}: {
  icon: React.ReactNode
  title: string
  onClick: () => void
}) {
  return (
    <button type="button" className="sap-tool-btn" title={title} aria-label={title} onClick={onClick}>
      {icon}
    </button>
  )
}

function Se38TextBtn({
  icon, label, title, onClick,
}: {
  icon: React.ReactNode
  label: string
  title?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="sap-tool-textbtn"
      title={title ?? label}
      aria-label={title ?? label}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function InitialScreen() {
  const storedProgram = useWorkbench((s) => s.se38Program)
  const subobject = useWorkbench((s) => s.se38Subobject)
  const setSubobject = useWorkbench((s) => s.setSe38Subobject)
  const setStoredProgram = useWorkbench((s) => s.setSe38Program)
  const se38Display = useWorkbench((s) => s.se38Display)

  const [value, setValue] = useState(storedProgram)
  const [f4Open, setF4Open] = useState(false)
  const [progList, setProgList] = useState<ProgramListItem[] | null>(null)
  const [f4Filter, setF4Filter] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
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
    setStoredProgram(value)
    useWorkbench.getState().openNewDialog({ prefillType: 'REPORT' })
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

  const execute = async () => {
    const n = await ensureLoaded()
    if (n) void useWorkbench.getState().runProgram(n)
  }

  const whereUsed = async () => {
    const n = await ensureLoaded()
    if (n) void useWorkbench.getState().showWhereUsed(n)
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

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* application toolbar (like the real SE38 initial screen) */}
      <div className="sap-apptoolbar flex h-[26px] shrink-0 items-center gap-0.5 overflow-x-auto px-1.5">
        <Se38ToolBtn icon={<FilePlus2 className="h-4 w-4 text-[#1c7a1c]" />} title="Create (F5)" onClick={openCreate} />
        <Se38ToolBtn icon={<Monitor className="h-4 w-4 text-[#2e5b8a]" />} title="Display (F7)" onClick={() => submit('display')} />
        <Se38ToolBtn icon={<Pencil className="h-4 w-4 text-[#2e5b8a]" />} title="Change (F6)" onClick={() => submit('change')} />
        <Se38ToolBtn icon={<Glasses className="h-4 w-4 text-[#2e5b8a]" />} title="Check (Ctrl+F2)" onClick={() => void checkSyntax()} />
        <Se38ToolBtn icon={<Play className="h-4 w-4 text-[#1c7a1c]" />} title="Execute (F8)" onClick={() => void execute()} />
        <span className="sap-toolbar-sep" aria-hidden />
        <Se38ToolBtn icon={<Search className="h-4 w-4 text-[#2e5b8a]" />} title="Where-Used List" onClick={() => void whereUsed()} />
        <Se38ToolBtn icon={<Info className="h-4 w-4 text-[#2e5b8a]" />} title="Information — program attributes" onClick={information} />
        <Se38ToolBtn icon={<Copy className="h-4 w-4 text-[#2e5b8a]" />} title="Copy — save the program under a new name" onClick={copyProgram} />
        <Se38ToolBtn icon={<Trash2 className="h-4 w-4 text-[#a01f1f]" />} title="Delete" onClick={deleteObject} />
        <span className="sap-toolbar-sep" aria-hidden />
        <Se38TextBtn icon={<Bug className="h-3.5 w-3.5 text-[#8a6d1a]" />} label="Debugging" title="Debugging" onClick={debugging} />
        <Se38TextBtn icon={<FileCheck2 className="h-3.5 w-3.5 text-[#2e5b8a]" />} label="With Variant" title="Start the program with a variant" onClick={withVariant} />
        <Se38TextBtn icon={<Files className="h-3.5 w-3.5 text-[#2e5b8a]" />} label="Variants" title="Maintain variants" onClick={variants} />
      </div>
      <div className="sap-screen min-h-0 flex-1 overflow-auto">
        <div className="grid w-full max-w-[760px] grid-cols-[110px_minmax(0,1fr)] items-center gap-x-2 gap-y-5 px-4 pt-7">
        {/* Program */}
        <label htmlFor="se38-program" className="text-[12.5px] text-[#1c2b3a]">
          Program
        </label>
        <div className="flex items-center gap-2">
          <div className="relative w-[240px]">
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
            className="sap-field sap-field-req w-full pr-[22px] font-mono uppercase"
            spellCheck={false}
            autoComplete="off"
          />
          <Popover open={f4Open} onOpenChange={setF4Open}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="absolute right-0 top-0 flex h-full w-[20px] items-center justify-center border-l border-[#c6d3e2] bg-[#eef3f9] text-[#33475c] hover:bg-[#dbe8f8]"
                aria-label="Possible entries (F4)"
                title="Possible entries (F4)"
                onClick={openF4}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={2}
              className="w-[420px] rounded-none border border-[#8fa7bf] bg-white p-0 shadow-[0_4px_16px_rgba(10,30,60,0.35)]"
            >
              <div className="flex items-center gap-1 border-b border-[#c3cfdc] bg-[#eef3f9] px-2 py-1">
                <span className="text-[11.5px] font-semibold text-[#3f5468]">Program</span>
                <span className="ml-auto text-[10.5px] text-[#7b8a9c]">F4 — possible entries</span>
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
                  className="sap-field w-full font-mono"
                  placeholder="Restrict value range…"
                  aria-label="Filter programs"
                />
              </div>
              <div className="wb-scroll max-h-[260px] overflow-auto">
                {f4Matches === null && (
                  <div className="px-2 py-1.5 text-[12px] text-[#7b8a9c]">Loading programs…</div>
                )}
                {f4Matches?.length === 0 && (
                  <div className="px-2 py-1.5 text-[12px] text-[#7b8a9c]">No programs found</div>
                )}
                {f4Matches?.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full items-baseline gap-2 px-2 py-[3px] text-left hover:bg-[#bcd6f2]"
                    onClick={() => choose(p.name)}
                  >
                    <span className="shrink-0 font-mono text-[12px] text-[#0b4fa8]">{p.name}</span>
                    <span className="truncate text-[11.5px] text-[#5b6d80]">{p.title}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          </div>
          <button
            type="button"
            className="sap-btn inline-flex items-center gap-1.5 px-2.5"
            title="Create program"
            onClick={openCreate}
          >
            <FilePlus2 className="h-3.5 w-3.5 text-[#1c7a1c]" />
            Create
          </button>
        </div>

        {/* Subobjects */}
        <div />
        <div className="w-[310px] border border-[#a9bdd2] bg-[#f4f8fc] shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
          <div className="border-b border-[#a9bdd2] bg-[linear-gradient(180deg,#e9f1fa_0%,#d4e4f4_100%)] px-2 py-[2px] text-[12px] font-semibold text-[#22364b]">
            Subobjects
          </div>
          <div className="space-y-[6px] px-3 py-2.5">
            {SUBOBJECT_ORDER.map((k) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-[#1c2b3a]">
                <input
                  type="radio"
                  name="se38-subobject"
                  checked={subobject === k}
                  onChange={() => setSubobject(k)}
                  className="sap-radio"
                />
                {SE38_SUBOBJECT_LABELS[k]}
              </label>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div />
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="sap-btn inline-flex min-w-[110px] items-center justify-center gap-1.5"
            onClick={() => submit('display')}
          >
            <Monitor className="h-3.5 w-3.5 text-[#2e5b8a]" /> Display
          </button>
          <button
            type="button"
            className="sap-btn inline-flex min-w-[110px] items-center justify-center gap-1.5"
            onClick={() => submit('change')}
          >
            <Pencil className="h-3.5 w-3.5 text-[#33475c]" /> Change
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}

// ── subobject screens (attributes / variants / text elements / doc) ───
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
      <div className="flex items-center gap-3 border-b border-[#c5d2e2] bg-[#f7fafd] px-3 py-[3px] text-[12.5px]">
        <span className="font-mono font-bold text-[#12283c]">{name}</span>
        <span className="text-[#44586c]">{SE38_SUBOBJECT_LABELS[subobject]}</span>
        {detail?.title && <span className="max-w-[360px] truncate text-[#7b8a9c]">{detail.title}</span>}
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
        {subobject === 'attributes' && <AttributesScreen detail={detail} storeProg={storeProg} />}
        {subobject === 'variants' && <VariantsScreen name={name} />}
        {subobject === 'text' && <TextElementsScreen name={name} source={storeProg?.source} detail={detail} />}
        {subobject === 'doc' && <DocumentationScreen name={name} detail={detail} />}
      </div>
    </div>
  )
}

function AttributesScreen({ detail, storeProg }: { detail: ProgramListItem | null; storeProg?: ProgramTabData }) {
  const name = useWorkbench((s) => s.se38Program)
  const status = storeProg?.dirty ? 'Inactive (revised)' : 'Active'
  const rows: [string, string][] = [
    ['Program', name],
    ['Title', detail?.title || storeProg?.title || '—'],
    ['Type', TYPE_LABELS[detail?.type ?? storeProg?.type ?? 'REPORT'] ?? 'Executable program'],
    ['Status', status],
    ['Paradigm', detail?.paradigm ?? storeProg?.paradigm ?? '—'],
    ['Package', '$TMP'],
    ['Application', 'ABAP Workbench (training system)'],
    ['Authorization Group', '—'],
    ['Original Language', 'EN'],
    ['Last Changed', formatDate(detail?.updatedAt)],
    ['Executions', String(detail?.executions ?? storeProg?.executions ?? 0)],
  ]

  return (
    <div className="mx-auto w-full max-w-[640px] px-6 py-5">
      <div className="grid grid-cols-[180px_minmax(0,1fr)] items-center gap-x-3 gap-y-[7px]">
        {rows.map(([k, v]) => (
          <Fragment key={k}>
            <span className="text-right text-[12.5px] text-[#1c2b3a]">{k}:</span>
            <span className={READONLY_FIELD}>{v}</span>
          </Fragment>
        ))}
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
          <span className="text-right text-[12.5px] text-[#1c2b3a]">List heading 1:</span>
          <span className={READONLY_FIELD}>{detail?.title || name}</span>
          <span className="text-right text-[12.5px] text-[#1c2b3a]">List heading 2:</span>
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
          <p className="whitespace-pre-wrap text-[12.5px] leading-[1.5] text-[#1c2b3a]">{text}</p>
        ) : (
          <p className="text-[12.5px] italic text-[#8395a8]">
            No documentation maintained for program {name}.
          </p>
        )}
      </div>
      {detail?.topicTitle && (
        <p className="mt-2 text-[11.5px] text-[#7b8a9c]">Training topic: {detail.topicTitle}</p>
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
              className="border border-[#c3cfdc] bg-[#eef3f9] px-2 py-[3px] text-left font-semibold text-[#3f5468]"
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
              className="border border-[#c3cfdc] bg-white px-2 py-[5px] text-[12px] text-[#44586c]"
            >
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="border border-[#c3cfdc] bg-white px-2 py-[3px] font-mono">
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
