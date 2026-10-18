'use client'

// ── SAP Easy Access (home view) ────────────────────────────────────────
import { useEffect, useState } from 'react'
import {
  BookOpen, Boxes, Braces, ChevronRight, Clock3, Database, FunctionSquare,
  GraduationCap, History, Layers, ListTree, Play, Search, Sparkles, Star, Table2, Zap,
} from 'lucide-react'
import { useWorkbench, api } from './use-workbench'
import type { RecentExecution, Topic } from './types'

function MenuRow({
  icon, label, hint, onClick,
}: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-2 rounded-[3px] px-2 py-1.5 text-left hover:bg-[#dbe8f8]"
      title={hint}
    >
      {icon}
      <span className="text-[12.5px] text-[#22364b] group-hover:text-[#06355f]">{label}</span>
      <ChevronRight className="ml-auto h-3.5 w-3.5 text-[#b4c4d6] opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

export function EasyAccess() {
  const favorites = useWorkbench((s) => s.favorites)
  const refreshFavorites = useWorkbench((s) => s.refreshFavorites)
  const openProgramByName = useWorkbench((s) => s.openProgramByName)
  const navigate = useWorkbench((s) => s.navigate)
  const openBrowserFor = useWorkbench((s) => s.openBrowserFor)
  const openSyllabusTopic = useWorkbench((s) => s.openSyllabusTopic)
  const openNewDialog = useWorkbench((s) => s.openNewDialog)
  const setSearchQuery = useWorkbench((s) => s.setSearchQuery)

  const [topics, setTopics] = useState<Topic[] | null>(null)
  const [recents, setRecents] = useState<RecentExecution[] | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    void refreshFavorites()
    api<{ topics: Topic[] }>('/api/topics')
      .then((r) => setTopics(r.topics))
      .catch(() => setTopics([]))
    api<{ recents: RecentExecution[] }>('/api/recents')
      .then((r) => setRecents(r.recents))
      .catch(() => setRecents([]))
  }, [refreshFavorites])

  const doSearch = () => {
    const q = search.trim()
    if (q) {
      setSearchQuery(q)
      navigate('search')
    }
  }

  return (
    <div className="wb-scroll h-full overflow-auto bg-[#f0f4f9] p-4">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* left column — SAP menu */}
        <div className="space-y-3">
          <section className="overflow-hidden rounded-[4px] border border-[#c3d0e0] bg-white shadow-sm" aria-label="Favorites and SAP menu">
            <div className="flex items-center gap-2 border-b border-[#d8e1ec] bg-gradient-to-b from-[#eef2f8] to-[#e2e9f2] px-3 py-2">
              <ListTree className="h-4 w-4 text-[#0a3d73]" />
              <h2 className="text-[12.5px] font-bold text-[#1c3a5f]">SAP Easy Access</h2>
            </div>

            {/* favorites */}
            <div className="border-b border-[#eef2f7] px-1 py-1">
              <p className="px-2 pb-0.5 pt-1 text-[10.5px] font-bold uppercase tracking-wide text-[#8593a5]">
                Favorites
              </p>
              {favorites.length === 0 && (
                <p className="px-2.5 py-1 text-[11.5px] italic text-[#9aa8b8]">
                  No favorites yet — star a program in the editor
                </p>
              )}
              {favorites.map((fv) => (
                <button
                  key={fv.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-[3px] px-2 py-1.5 text-left hover:bg-[#dbe8f8]"
                  onClick={() => {
                    if (fv.objectType === 'TABLE') openBrowserFor(fv.objectName)
                    else void openProgramByName(fv.objectName)
                  }}
                >
                  <Star className="h-3.5 w-3.5 shrink-0 fill-[#f0b429] text-[#f0b429]" />
                  <span className="truncate font-mono text-[12px] text-[#22364b]">
                    {fv.label || fv.objectName}
                  </span>
                </button>
              ))}
            </div>

            {/* SAP menu */}
            <div className="px-1 py-1">
              <p className="px-2 pb-0.5 pt-1 text-[10.5px] font-bold uppercase tracking-wide text-[#8593a5]">
                SAP Menu
              </p>
              <div className="flex items-center gap-2 px-2 py-1 text-[12px] font-semibold text-[#1c3a5f]">
                <Boxes className="h-3.5 w-3.5 text-[#0a3d73]" /> Development
              </div>
              <div className="ml-4 border-l border-[#d3dde8] pl-1">
                <MenuRow
                  icon={<Play className="h-3.5 w-3.5 text-[#0a6ed1]" />}
                  label="ABAP Editor (SE38)"
                  hint="Create and execute ABAP reports"
                  onClick={() => openNewDialog({ prefillType: 'REPORT' })}
                />
                <MenuRow
                  icon={<Braces className="h-3.5 w-3.5 text-[#0a6e6e]" />}
                  label="Class Builder (SE24)"
                  hint="ABAP Objects classes"
                  onClick={() => navigate('classes')}
                />
                <MenuRow
                  icon={<FunctionSquare className="h-3.5 w-3.5 text-[#5d3a8e]" />}
                  label="Function Builder (SE37)"
                  hint="Function modules"
                  onClick={() => navigate('functions')}
                />
                <MenuRow
                  icon={<Database className="h-3.5 w-3.5 text-[#8a6d1a]" />}
                  label="Data Dictionary (SE11)"
                  hint="Tables and field catalogs"
                  onClick={() => navigate('dictionary')}
                />
                <MenuRow
                  icon={<Table2 className="h-3.5 w-3.5 text-[#8a6d1a]" />}
                  label="Data Browser (SE16)"
                  hint="Browse table contents"
                  onClick={() => navigate('browser')}
                />
              </div>
              <div className="mt-1 flex items-center gap-2 px-2 py-1 text-[12px] font-semibold text-[#1c3a5f]">
                <GraduationCap className="h-3.5 w-3.5 text-[#0a6e6e]" /> Training
              </div>
              <div className="ml-4 border-l border-[#d3dde8] pl-1">
                <MenuRow
                  icon={<BookOpen className="h-3.5 w-3.5 text-[#0a6e6e]" />}
                  label="Syllabus & Learning Path"
                  hint="10 topics from basics to CDS/RAP"
                  onClick={() => openSyllabusTopic(-1)}
                />
              </div>
            </div>
          </section>

          {/* object search */}
          <section className="rounded-[4px] border border-[#c3d0e0] bg-white p-2 shadow-sm" aria-label="Object search">
            <div className="flex items-center gap-1.5 rounded-[3px] border border-[#7f9db9] bg-white px-2 py-1">
              <Search className="h-3.5 w-3.5 text-[#7f9db9]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                placeholder="Search all objects…"
                className="h-[24px] w-full bg-transparent text-[12px] outline-none placeholder:text-[#9aa8b8]"
                aria-label="Search all objects"
              />
            </div>
          </section>

          {/* recent objects */}
          <section className="overflow-hidden rounded-[4px] border border-[#c3d0e0] bg-white shadow-sm" aria-label="Recent executions">
            <div className="flex items-center gap-2 border-b border-[#d8e1ec] bg-gradient-to-b from-[#eef2f8] to-[#e2e9f2] px-3 py-2">
              <History className="h-4 w-4 text-[#0a3d73]" />
              <h2 className="text-[12.5px] font-bold text-[#1c3a5f]">Recent Executions</h2>
            </div>
            {recents === null && (
              <div className="space-y-1.5 p-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-5 animate-pulse rounded-sm bg-[#eef2f7]" />
                ))}
              </div>
            )}
            {recents !== null && recents.length === 0 && (
              <p className="px-3 py-2.5 text-[11.5px] italic text-[#9aa8b8]">
                No executions yet — press F8 in the editor or on any example.
              </p>
            )}
            <ul className="max-h-72 overflow-y-auto">
              {recents?.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 border-b border-[#f2f5f9] px-3 py-1.5 text-left hover:bg-[#dbe8f8]"
                    onClick={() => void openProgramByName(r.programName)}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        r.status === 'ERROR' ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      title={r.status}
                    />
                    <span className="shrink-0 font-mono text-[11.5px] font-medium text-[#22364b]">
                      {r.programName}
                    </span>
                    <Clock3 className="ml-auto h-3 w-3 shrink-0 text-[#93a9c2]" />
                    <span className="shrink-0 text-[10.5px] text-[#7b8a9c]">{r.durationMs} ms</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* right column */}
        <div className="space-y-4">
          {/* welcome */}
          <section className="overflow-hidden rounded-[4px] border border-[#c3d0e0] bg-white shadow-sm">
            <div className="sap-titlebar flex flex-wrap items-center gap-3 px-4 py-3">
              <Layers className="h-6 w-6 text-white" />
              <div>
                <h1 className="text-[16px] font-bold text-white">
                  ABAPForge — The Modern ABAP Studio
                </h1>
                <p className="text-[12px] text-[#cfe2f5]">
                  Write, run and master SAP ABAP: procedural, object-oriented, ALV reporting and
                  modern 7.40+ syntax — free, right in your browser.
                </p>
              </div>
              <span className="ml-auto hidden rounded-sm border border-white/30 bg-white/10 px-2 py-1 font-mono text-[11px] text-white md:block">
                Free · In-Browser ABAP Runtime
              </span>
            </div>
            <div className="grid grid-cols-2 gap-px bg-[#e2e9f2] sm:grid-cols-4">
              {[
                { label: 'Procedural ABAP', desc: 'FORMs, reports, classic lists', icon: <Play className="h-4 w-4" /> },
                { label: 'ABAP Objects', desc: 'Classes, interfaces, events', icon: <Braces className="h-4 w-4" /> },
                { label: 'ALV Grids', desc: 'cl_salv_table & REUSE framework', icon: <Table2 className="h-4 w-4" /> },
                { label: 'Modern Syntax', desc: 'VALUE, COND, REDUCE, string templates', icon: <Zap className="h-4 w-4" /> },
              ].map((c) => (
                <div key={c.label} className="bg-white px-3 py-2.5">
                  <div className="flex items-center gap-2 text-[#0a6ed1]">
                    {c.icon}
                    <span className="text-[12px] font-semibold text-[#1c3a5f]">{c.label}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#7b8a9c]">{c.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* quick start hint */}
          <section className="flex flex-wrap items-center gap-2 rounded-[4px] border border-[#d8c8ec] bg-[#f5effc] px-3 py-2">
            <Sparkles className="h-4 w-4 shrink-0 text-[#7a4bbf]" />
            <p className="text-[12.5px] text-[#4a3568]">
              Quick start: type <code className="rounded-sm border border-[#ddc9f2] bg-white px-1 font-mono text-[11.5px]">SE38</code> in
              the command field · press <kbd className="rounded-sm border border-[#ddc9f2] bg-white px-1 font-mono text-[10.5px]">F8</kbd> to
              execute · try <button type="button" className="font-mono font-semibold text-[#5d3a8e] underline" onClick={() => void openProgramByName('Z_HELLO_WORLD')}>Z_HELLO_WORLD</button>
            </p>
          </section>

          {/* syllabus topics */}
          <section aria-label="Training syllabus">
            <div className="mb-2 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-[#0a6e6e]" />
              <h2 className="text-[13.5px] font-bold text-[#1c3a5f]">
                Training Syllabus — HCLTech SAP ABAP Program
              </h2>
            </div>
            {topics === null && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-[4px] bg-[#e2e9f2]" />
                ))}
              </div>
            )}
            {topics !== null && topics.length === 0 && (
              <p className="rounded-[4px] border border-dashed border-[#c3d0e0] bg-white px-4 py-6 text-center text-[12.5px] text-[#8593a5]">
                The training content is being seeded — topics will appear here shortly. Refresh or
                reopen this screen in a moment.
              </p>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {topics?.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openSyllabusTopic(t.id)}
                  className="group flex items-start gap-3 rounded-[4px] border border-[#c3d0e0] bg-white px-3 py-2.5 text-left shadow-sm transition-shadow hover:border-[#8fb0d4] hover:shadow"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] border border-[#b8d8e0] bg-[#e9f5f7] font-mono text-[13px] font-bold"
                    style={{ color: '#1f5f6e' }}
                  >
                    {t.srNo}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold text-[#12283c] group-hover:text-[#0a6ed1]">
                      {t.title}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-sm border border-[#d8e1ec] bg-[#f4f7fa] px-1.5 py-0.5 text-[10px] font-medium text-[#5b6d80]">
                        {t.paradigm}
                      </span>
                      <span className="text-[10.5px] text-[#8593a5]">
                        {t.exampleCount} example{t.exampleCount === 1 ? '' : 's'}
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-[#b4c4d6] transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
