'use client'

// ── The iconic SAP command field (t-code box) ─────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, History, Terminal } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useWorkbench } from './use-workbench'
import { api } from './use-workbench'
import type { ProgramListItem } from './types'

const TCODES = ['SE38', 'SE80', 'SE11', 'SE16', 'SE24', 'SE37', 'SE93', 'SLG1', 'SEARCH']

export function CommandField() {
  const [value, setValue] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [histOpen, setHistOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // individual selectors — zustand actions are stable, so this component
  // never re-renders when unrelated state (e.g. editor keystrokes) changes
  const addMessage = useWorkbench((s) => s.addMessage)
  const setTcodeDialogOpen = useWorkbench((s) => s.setTcodeDialogOpen)
  const setConfirmCreate = useWorkbench((s) => s.setConfirmCreate)

  // focus command field on Ctrl+/, a classic-ish shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pushHistory = useCallback((cmd: string) => {
    setHistory((h) => [cmd, ...h.filter((x) => x !== cmd)].slice(0, 12))
  }, [])

  const handleCommand = useCallback(
    async (raw: string) => {
      let v = raw.trim()
      if (!v) {
        // empty: SAP jumps back / focuses content
        const active = useWorkbench.getState().activeTabKey
        if (active) addMessage('S', 'Command field cleared')
        return
      }
      pushHistory(v)

      // strip leading /n (new transaction)
      const nmatch = v.match(/^\/n(.+)$/i)
      if (nmatch) v = nmatch[1].trim()

      const upper = v.toUpperCase()
      const [first, ...rest] = upper.split(/\s+/)
      const arg = rest.join(' ')

      // known transaction codes
      if (TCODES.includes(first)) {
        const { navigate, openProgramByName, openBrowserFor, openNewDialog } =
          useWorkbench.getState()
        switch (first) {
          case 'SE38': {
            useWorkbench.setState({ lastTcode: 'SE38' })
            const st = useWorkbench.getState()
            const progTab = [...st.tabs].reverse().find((t) => t.kind === 'program')
            if (progTab) st.activateTab(progTab.key)
            else openNewDialog({ prefillType: 'REPORT' })
            addMessage('S', 'ABAP Editor (SE38)')
            return
          }
          case 'SE80':
            useWorkbench.setState({ lastTcode: 'SE80', view: 'home', navigatorOpen: true })
            addMessage('S', 'Object Navigator (SE80)')
            return
          case 'SE11':
            useWorkbench.setState({ lastTcode: 'SE11' })
            navigate('dictionary')
            addMessage('S', 'ABAP Dictionary (SE11)')
            return
          case 'SE16': {
            useWorkbench.setState({ lastTcode: 'SE16' })
            if (arg && /^[A-Za-z_\/][A-Za-z0-9_\/%$#]*$/.test(arg)) {
              openBrowserFor(arg)
              addMessage('S', `Data Browser (SE16) — table ${arg.toUpperCase()}`)
            } else {
              navigate('browser')
              addMessage('S', 'Data Browser (SE16) — enter a table name')
            }
            return
          }
          case 'SE24':
            useWorkbench.setState({ lastTcode: 'SE24' })
            navigate('classes')
            addMessage('S', 'Class Builder (SE24)')
            return
          case 'SE37':
            useWorkbench.setState({ lastTcode: 'SE37' })
            navigate('functions')
            addMessage('S', 'Function Builder (SE37)')
            return
          case 'SE93':
            setTcodeDialogOpen(true)
            addMessage('S', 'Transaction registry (SE93)')
            return
          case 'SLG1':
            useWorkbench.setState({ view: 'home' })
            addMessage('S', 'Recent executions are shown on the Easy Access screen')
            return
          case 'SEARCH': {
            if (!arg) {
              addMessage('W', 'SEARCH: enter a search term (SEARCH <text>)')
              return
            }
            useWorkbench.setState({ lastTcode: 'SEARCH', searchQuery: arg, view: 'search' })
            return
          }
        }
      }

      // SEARCH <text> (any case)
      if (upper.startsWith('SEARCH ') || upper.startsWith('SEARCH\t')) {
        const q = v.slice(6).trim()
        if (q) {
          useWorkbench.setState({ searchQuery: q, view: 'search' })
          addMessage('S', `Searching for "${q}"`)
          return
        }
      }

      // looks like a repository object name → open or offer creation
      if (/^[A-Za-z_\/][A-Za-z0-9_\/%$#]*$/.test(upper)) {
        useWorkbench.setState({ lastTcode: 'SE38' })
        try {
          const { programs } = await api<{ programs: ProgramListItem[] }>(
            `/api/programs?q=${encodeURIComponent(upper)}`,
          )
          const hit = programs.find((p) => p.name === upper)
          if (hit) {
            await useWorkbench.getState().openProgramByName(upper)
            setValue('')
            return
          }
        } catch {
          /* fall through to create prompt */
        }
        setConfirmCreate({ name: upper })
        return
      }

      // anything else → global search
      useWorkbench.getState().setSearchQuery(v)
      useWorkbench.getState().navigate('search')
      addMessage('S', `Searching for "${v}"`)
    },
    [addMessage, pushHistory, setConfirmCreate, setTcodeDialogOpen],
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void handleCommand(value)
      setValue('')
      setHistOpen(false)
    } else if (e.key === 'ArrowDown' && history.length && !value) {
      e.preventDefault()
      setHistOpen(true)
    } else if (e.key === 'Escape') {
      setValue('')
      setHistOpen(false)
    }
  }

  return (
    <div className="flex items-stretch gap-1" role="search" aria-label="Command field">
      <div className="flex items-center rounded-[3px] border border-[#7f9db9] bg-white shadow-inner">
        <div className="flex h-[26px] w-[30px] items-center justify-center border-r border-[#d3ddea] bg-[#f0f4f9]" title="Command field — enter transaction code">
          <Check className="h-3.5 w-3.5 text-green-600" strokeWidth={3} />
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Enter transaction, e.g. SE38"
          aria-label="Command field"
          title="Command field (Ctrl+L) — t-codes: SE38, SE80, SE11, SE16, SE24, SE37, SE93 · or object name · or SEARCH text"
          className="h-[26px] w-[150px] bg-transparent px-2 font-mono text-[12px] text-[#111827] placeholder:text-[#9aa8b8] focus:outline-none md:w-[210px]"
          spellCheck={false}
          autoComplete="off"
        />
        <Popover open={histOpen} onOpenChange={setHistOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-[26px] w-[22px] items-center justify-center text-[#33475c] hover:bg-[#e3edf9]"
              aria-label="Command history"
              onClick={() => history.length && setHistOpen((o) => !o)}
              tabIndex={history.length ? 0 : -1}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-1" align="end" sideOffset={6}>
            <div className="mb-1 flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#5b6d80]">
              <History className="h-3 w-3" /> Command history
            </div>
            {history.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-[#8593a5]">No commands yet</div>
            )}
            {history.map((h) => (
              <button
                key={h}
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left font-mono text-xs text-[#22364b] hover:bg-[#dbe8f8]"
                onClick={() => {
                  setValue(h)
                  setHistOpen(false)
                  inputRef.current?.focus()
                }}
              >
                <Terminal className="h-3 w-3 text-[#0a6ed1]" />
                {h}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
