'use client'

// ── Syllabus / learning path view ─────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { Braces, ChevronDown, FileCode2, GraduationCap, Play } from 'lucide-react'
import { useWorkbench, api } from './use-workbench'
import type { Topic } from './types'

const CATEGORY_COLORS: Record<string, { border: string; badge: string; dot: string }> = {
  CORE: { border: '#0a6ed1', badge: 'border-[#bcd8f6] bg-[#e9f2fc] text-[#0a3d73]', dot: 'bg-[#0a6ed1]' },
  REPORTING: { border: '#0a8a8a', badge: 'border-[#b8e0e0] bg-[#e6f6f6] text-[#0a5f5f]', dot: 'bg-[#0a8a8a]' },
  MODERN: { border: '#7a4bbf', badge: 'border-[#ddc9f2] bg-[#f5effc] text-[#5d3a8e]', dot: 'bg-[#7a4bbf]' },
}
const FALLBACK_COLOR = CATEGORY_COLORS.CORE

export function SyllabusView() {
  const topicId = useWorkbench((s) => s.syllabusTopicId)
  const openProgramByName = useWorkbench((s) => s.openProgramByName)
  const runProgram = useWorkbench((s) => s.runProgram)

  const [topics, setTopics] = useState<Topic[] | null>(null)
  const [openIds, setOpenIds] = useState<Set<number>>(new Set())
  const refs = useRef<Record<number, HTMLDivElement | null>>({})

  useEffect(() => {
    api<{ topics: Topic[] }>('/api/topics')
      .then((r) => {
        setTopics(r.topics)
        if (topicId && topicId > 0) {
          setOpenIds(new Set([topicId]))
          // scroll to it after render
          setTimeout(() => {
            refs.current[topicId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 150)
        } else if (r.topics.length > 0) {
          setOpenIds(new Set([r.topics[0].id]))
        }
      })
      .catch(() => setTopics([]))
  }, [topicId])

  const toggle = (id: number) =>
    setOpenIds((old) => {
      const next = new Set(old)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="wb-scroll h-full overflow-auto bg-[#f0f4f9] p-4">
      <div className="mx-auto max-w-[900px]">
        {/* header */}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[4px] border border-[#c3d0e0] bg-white px-4 py-3 shadow-sm">
          <GraduationCap className="h-6 w-6 text-[#0a6e6e]" />
          <div>
            <h1 className="text-[15px] font-bold text-[#12283c]">
              Syllabus & Learning Path
            </h1>
            <p className="text-[12px] text-[#7b8a9c]">
              HCLTech SAP ABAP Training — 10 topics, from basics to CDS views &amp; RAP. Open the
              examples in the editor and run them with F8.
            </p>
          </div>
          <span className="ml-auto rounded-sm border border-[#c5d2e2] bg-[#f4f7fa] px-2 py-1 font-mono text-[11px] text-[#3f5468]">
            {topics?.length ?? '…'} topics
          </span>
        </div>

        {topics === null && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-[4px] bg-[#e2e9f2]" />
            ))}
          </div>
        )}
        {topics !== null && topics.length === 0 && (
          <p className="rounded-[4px] border border-dashed border-[#c3d0e0] bg-white px-4 py-8 text-center text-[13px] text-[#8593a5]">
            No topics found — the training content is being seeded. Check back in a moment.
          </p>
        )}

        <div className="space-y-2.5">
          {topics?.map((t) => {
            const colors = CATEGORY_COLORS[t.category?.toUpperCase()] ?? FALLBACK_COLOR
            const open = openIds.has(t.id)
            return (
              <div
                key={t.id}
                ref={(el) => {
                  refs.current[t.id] = el
                }}
                className="overflow-hidden rounded-[4px] border border-[#c3d0e0] bg-white shadow-sm"
                style={{ borderLeft: `4px solid ${colors.border}` }}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-[#f4f8fc]"
                  onClick={() => toggle(t.id)}
                  aria-expanded={open}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] border border-[#d8e1ec] bg-[#f4f7fa] font-mono text-[13px] font-bold text-[#3f5468]">
                    {t.srNo}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold text-[#12283c]">{t.title}</span>
                    {t.summary && (
                      <span className="mt-0.5 block truncate text-[11.5px] text-[#7b8a9c]">
                        {t.summary}
                      </span>
                    )}
                  </span>
                  <span className={`hidden shrink-0 rounded-sm border px-1.5 py-0.5 text-[10.5px] font-semibold sm:inline ${colors.badge}`}>
                    {t.category}
                  </span>
                  <span className="hidden rounded-sm border border-[#d8e1ec] bg-[#f4f7fa] px-1.5 py-0.5 text-[10.5px] font-medium text-[#5b6d80] md:inline">
                    {t.paradigm}
                  </span>
                  <span className="shrink-0 text-[11px] text-[#8593a5]">
                    {t.exampleCount} ex.
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-[#5b6d80] transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </button>

                {open && (
                  <div className="border-t border-[#e6edf4] bg-[#fbfdff] px-4 pb-4 pt-2">
                    {/* details markdown */}
                    {t.details ? (
                      <div className="wb-markdown text-[#22364b]">
                        <Markdown>{t.details}</Markdown>
                      </div>
                    ) : (
                      t.summary && <p className="text-[13px] text-[#44586c]">{t.summary}</p>
                    )}

                    {/* example chips */}
                    {t.examples.length > 0 && (
                      <div className="mt-3">
                        <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[#8593a5]">
                          Example programs
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {t.examples.map((ex) => (
                            <span
                              key={ex.id}
                              className="inline-flex items-center gap-1.5 rounded-[3px] border border-[#c5d2e2] bg-white pl-2 pr-1 py-1 shadow-sm"
                            >
                              {ex.type === 'CLASS' ? (
                                <Braces className="h-3.5 w-3.5 text-[#0a6e6e]" />
                              ) : (
                                <FileCode2 className="h-3.5 w-3.5 text-[#0a6ed1]" />
                              )}
                              <button
                                type="button"
                                className="font-mono text-[11.5px] font-semibold text-[#1c3a5f] hover:text-[#0a6ed1] hover:underline"
                                onClick={() => void openProgramByName(ex.name)}
                                title={ex.title || ex.name}
                              >
                                {ex.name}
                              </button>
                              <span className="max-w-[220px] truncate text-[11px] text-[#7b8a9c]">
                                {ex.title}
                              </span>
                              <button
                                type="button"
                                className="sap-btn !px-1.5 !py-0.5"
                                title={`Open ${ex.name} in editor`}
                                onClick={() => void openProgramByName(ex.name)}
                              >
                                Open
                              </button>
                              <button
                                type="button"
                                className="sap-btn !px-1.5 !py-0.5"
                                title={`Execute ${ex.name}`}
                                onClick={async () => {
                                  await openProgramByName(ex.name)
                                  runProgram(ex.name)
                                }}
                              >
                                <Play className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
