'use client'

// ── Ctrl+K quick command palette ──────────────────────────────────────
import { useEffect, useState } from 'react'
import {
  BookOpen, Braces, Command as CommandIcon, Database, FileCode2, FilePlus2,
  FunctionSquare, Home, Play, Search, Table2,
} from 'lucide-react'
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useWorkbench, api } from './use-workbench'
import type { SearchHit } from './types'

export function CommandPalette() {
  const open = useWorkbench((s) => s.commandPaletteOpen)
  const setOpen = useWorkbench((s) => s.setCommandPaletteOpen)
  const navigate = useWorkbench((s) => s.navigate)
  const setSearchQuery = useWorkbench((s) => s.setSearchQuery)
  const openNewDialog = useWorkbench((s) => s.openNewDialog)
  const openProgramById = useWorkbench((s) => s.openProgramById)
  const openBrowserFor = useWorkbench((s) => s.openBrowserFor)
  const setSelectedFunction = useWorkbench((s) => s.setSelectedFunction)
  const openSyllabusTopic = useWorkbench((s) => s.openSyllabusTopic)

  const [term, setTerm] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])

  // debounce search (async — never sets state synchronously in the effect body)
  useEffect(() => {
    if (!open) return
    const q = term.trim()
    const t = setTimeout(
      () => {
        if (!q) {
          setHits([])
          return
        }
        api<{ groups: { hits: SearchHit[] }[] }>(`/api/search?q=${encodeURIComponent(q)}`)
          .then((r) => setHits(r.groups.flatMap((g) => g.hits.slice(0, 5))))
          .catch(() => setHits([]))
      },
      q ? 250 : 0,
    )
    return () => clearTimeout(t)
  }, [term, open])

  const close = () => setOpen(false)

  const openHit = (hit: SearchHit) => {
    close()
    switch (hit.objectType) {
      case 'REPORT':
      case 'CLASS':
      case 'INCLUDE':
      case 'FUNCTION_GROUP': {
        const id = hit.extra?.id as string | undefined
        if (id) void openProgramById(id)
        else void useWorkbench.getState().openProgramByName(hit.name)
        return
      }
      case 'TABLE':
        openBrowserFor(hit.name)
        return
      case 'FM':
        setSelectedFunction(hit.name)
        return
      case 'TOPIC': {
        const tid = (hit.extra?.topicId as number | undefined) ?? (hit.extra?.srNo as number | undefined)
        if (tid) openSyllabusTopic(tid)
        return
      }
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search objects or jump to a tool… (t-codes: SE38, SE11, SE16…)"
        value={term}
        onValueChange={setTerm}
      />
      <CommandList className="wb-scroll">
        <CommandEmpty>
          No results — press Enter to run a full search for &quot;{term}&quot;
        </CommandEmpty>

        {!term && (
          <CommandGroup heading="Quick actions">
            <CommandItem
              onSelect={() => {
                close()
                openNewDialog({ prefillType: 'REPORT' })
              }}
            >
              <FilePlus2 className="h-4 w-4" />
              New program (SE38 style)
            </CommandItem>
            <CommandItem
              onSelect={() => {
                close()
                const q = window.prompt('Search for:')
                if (q) {
                  setSearchQuery(q)
                  navigate('search')
                }
              }}
            >
              <Search className="h-4 w-4" />
              Search all objects
            </CommandItem>
          </CommandGroup>
        )}

        {!term && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tools & transactions">
              <CommandItem onSelect={() => { close(); useWorkbench.setState({ view: 'home' }) }}>
                <Home className="h-4 w-4" /> SAP Easy Access — SE80
              </CommandItem>
              <CommandItem onSelect={() => { close(); openNewDialog({ prefillType: 'REPORT' }) }}>
                <Play className="h-4 w-4" /> ABAP Editor — SE38
              </CommandItem>
              <CommandItem onSelect={() => { close(); navigate('dictionary') }}>
                <Database className="h-4 w-4" /> Data Dictionary — SE11
              </CommandItem>
              <CommandItem onSelect={() => { close(); navigate('browser') }}>
                <Table2 className="h-4 w-4" /> Data Browser — SE16
              </CommandItem>
              <CommandItem onSelect={() => { close(); navigate('classes') }}>
                <Braces className="h-4 w-4" /> Class Builder — SE24
              </CommandItem>
              <CommandItem onSelect={() => { close(); navigate('functions') }}>
                <FunctionSquare className="h-4 w-4" /> Function Builder — SE37
              </CommandItem>
              <CommandItem onSelect={() => { close(); openSyllabusTopic(-1) }}>
                <BookOpen className="h-4 w-4" /> Syllabus &amp; Learning Path
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {hits.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Repository objects">
              {hits.map((hit, i) => (
                <CommandItem
                  key={`${hit.objectType}-${hit.name}-${i}`}
                  value={`${hit.name} ${hit.title} ${hit.objectType}`}
                  onSelect={() => openHit(hit)}
                >
                  <FileCode2 className="h-4 w-4" />
                  <span className="font-mono font-semibold">{hit.name}</span>
                  <span className="ml-2 truncate text-muted-foreground">{hit.title}</span>
                  <span className="ml-auto rounded-sm border border-[#d8e1ec] bg-[#f4f7fa] px-1.5 text-[10px] uppercase text-[#5b6d80]">
                    {hit.objectType}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {term && hits.length === 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Search">
              <CommandItem
                value={`run-full-search-${term}`}
                onSelect={() => {
                  close()
                  setSearchQuery(term)
                  navigate('search')
                }}
              >
                <CommandIcon className="h-4 w-4" />
                Run full search for &quot;{term}&quot;
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
