'use client'

// ── ABAP Editor (SE38): initial screen + subobject screens ────────────
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Pencil, Play } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useWorkbench, api } from './use-workbench'
import {
  SE38_SUBOBJECT_LABELS,
  type ProgramListItem,
  type ProgramTabData,
  type Se38Subobject,
} from './types'

const SUBOBJECT_ORDER: Se38Subobject[] = ['source', 'variants', 'attributes', 'text', 'doc']

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

  return (
    <div className="sap-screen h-full overflow-auto">
      <div className="grid w-full max-w-[720px] grid-cols-[110px_minmax(0,1fr)] items-center gap-x-2 gap-y-5 px-4 pt-7">
        {/* Program */}
        <label htmlFor="se38-program" className="text-right text-[12.5px] text-[#1c2b3a]">
          Program:
        </label>
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
            className="sap-field w-full pr-[22px] font-mono uppercase"
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

        {/* Subobjects */}
        <div />
        <fieldset className="w-[310px] border border-[#a9bdd2] bg-[#f7fafd] px-3 pb-3 pt-0.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
          <legend className="px-1 text-[12px] font-semibold text-[#33475c]">Subobjects</legend>
          <div className="space-y-[6px] pt-1">
            {SUBOBJECT_ORDER.map((k) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-[#1c2b3a]">
                <input
                  type="radio"
                  name="se38-subobject"
                  checked={subobject === k}
                  onChange={() => setSubobject(k)}
                  className="h-[13px] w-[13px] accent-[#0a6ed1]"
                />
                {SE38_SUBOBJECT_LABELS[k]}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Buttons */}
        <div />
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="sap-btn inline-flex min-w-[110px] items-center justify-center gap-1.5"
            onClick={() => submit('display')}
          >
            <Play className="h-3.5 w-3.5 text-[#1c7a1c]" /> Display
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
