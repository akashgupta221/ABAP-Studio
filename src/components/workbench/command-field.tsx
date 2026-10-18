'use client'

// ── SAP command field (t-code box) ─────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
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

  const addMessage = useWorkbench((s) => s.addMessage)
  const setTcodeDialogOpen = useWorkbench((s) => s.setTcodeDialogOpen)
  const setConfirmCreate = useWorkbench((s) => s.setConfirmCreate)

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
      if (!v) return
      const st = () => useWorkbench.getState()
      pushHistory(v)

      // ── SAP command prefixes ───────────────────────────────────────
      const lower = v.toLowerCase()
      if (lower === '/nend') {
        st().setLogoffConfirm(true)
        return
      }
      if (lower === '/nex') {
        st().logoff()
        return
      }
      if (lower === '/n') {
        st().navigate('home')
        st().addMessage('S', 'Current transaction ended')
        return
      }
      if (lower === '/ns000') {
        st().navigate('home')
        st().addMessage('S', 'SAP Easy Access (S000)')
        return
      }
      if (lower === '/i') {
        st().addMessage('I', '/i — the last session cannot be deleted')
        return
      }
      if (lower === '/o') {
        st().addMessage('I', 'Session list: NPL (1) — this is session 1')
        return
      }
      v = v.replace(/^\/(n|o|\*)/i, '').trim()
      if (!v) return

      const upper = v.toUpperCase()
      const [first, ...rest] = upper.split(/\s+/)
      const arg = rest.join(' ')

      // known transaction codes
      if (TCODES.includes(first)) {
        const { navigate, openBrowserFor, openProgramByName } = st()
        switch (first) {
          case 'SE38': {
            useWorkbench.setState({ lastTcode: 'SE38' })
            if (arg && /^[A-Za-z_\/][A-Za-z0-9_\/%$#]*$/.test(arg)) {
              await openProgramByName(arg)
              return
            }
            st().openSe38Initial()
            addMessage('S', 'ABAP Editor (SE38)')
            return
          }
          case 'SE80':
            useWorkbench.setState({ lastTcode: 'SE80' })
            navigate('search')
            addMessage('S', 'Object Navigator (SE80) — repository search')
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
            addMessage('S', 'Recent executions are shown on the SAP Easy Access screen')
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
        try {
          const { programs } = await api<{ programs: ProgramListItem[] }>(
            `/api/programs?q=${encodeURIComponent(upper)}`,
          )
          const hit = programs.find((p) => p.name === upper)
          if (hit) {
            useWorkbench.setState({ lastTcode: 'SE38' })
            await useWorkbench.getState().openProgramByName(upper)
            setValue('')
            return
          }
        } catch {
          /* fall through */
        }
        if (/^[ZY]/.test(upper)) {
          useWorkbench.setState({ lastTcode: 'SE38' })
          setConfirmCreate({ name: upper })
          return
        }
        addMessage('E', `Transaction code ${upper} does not exist`)
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
    <div className="flex items-stretch" role="search" aria-label="Command field">
      <div className="flex items-stretch border border-[#7f9db9] bg-white shadow-[inset_1px_1px_1px_rgba(0,0,0,0.07)]">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Command field"
          title="Command field (Ctrl+L) — t-codes: SE38, SE80, SE11, SE16, SE24, SE37, SE93 · /n, /o, /i, /nend · or object name · or SEARCH <text>"
          className="h-[20px] w-[170px] bg-transparent px-1.5 font-mono text-[12px] uppercase text-[#111827] outline-none md:w-[190px]"
          spellCheck={false}
          autoComplete="off"
        />
        <Popover open={histOpen} onOpenChange={setHistOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex w-[18px] items-center justify-center border-l border-[#d3dde8] text-[#33475c] hover:bg-[#e3edf9]"
              aria-label="Command field history"
              onClick={() => history.length && setHistOpen((o) => !o)}
              tabIndex={history.length ? 0 : -1}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 rounded-none border-[#8fa7bf] p-0.5" align="end" sideOffset={4}>
            <div className="border-b border-[#d6dfe8] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[#5b6d80]">
              Command Field History
            </div>
            {history.length === 0 && (
              <div className="px-2 py-1.5 text-[12px] text-[#8593a5]">No commands yet</div>
            )}
            {history.map((h) => (
              <button
                key={h}
                type="button"
                className="flex w-full items-center gap-2 px-2 py-1 text-left font-mono text-[12px] text-[#12283c] hover:bg-[#bcd6f2]"
                onClick={() => {
                  setValue(h)
                  setHistOpen(false)
                  inputRef.current?.focus()
                }}
              >
                {h}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
