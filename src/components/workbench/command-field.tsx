'use client'

// ── SAP command field (t-code box) ─────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react'
import { useWorkbench } from './use-workbench'
import { api } from './use-workbench'
import type { ProgramListItem } from './types'

const TCODES = [
  'SE38', 'SE80', 'SE11', 'SE12', 'SE16', 'SE16N', 'SE24', 'SE37', 'SE93', 'SLG1', 'ST22', 'SEARCH', 'MODERN',
  'SLG0', 'SM21', 'SM36', 'SM37', 'SM50', 'SQ01', 'SQ02', 'SQ03', 'SE09', 'SE10', 'STMS', 'SCC1',
  'ST05', 'SAT', 'SE30', 'SCI', 'SLIN', 'SM12', 'SM13', 'SU53', 'SU20', 'SU21',
  'SA38', 'SE91', 'SNRO', 'AL11', 'SM59', 'SM30', 'SM31', 'SE84', 'SE15', 'ABAPDOCU', 'SE14',
  'SE32', 'SE36', 'SE39', 'SE35', 'SE41', 'SE43', 'SE51', 'SE54', 'SM34',
  'SE71', 'SE72', 'SE73', 'SE78', 'SO10', 'SMARTFORMS', 'SMARTSTYLES', 'NACE', 'SP01', 'SPAD',
  'SHDB', 'SM35', 'LSMW', 'CG3Y', 'CG3Z', 'FILE', 'BAPI',
  'WE31', 'WE30', 'WE81', 'WE82', 'WE21', 'WE20', 'BD64', 'WE19', 'WE02', 'WE05', 'BD87',
  'CMOD', 'SMOD', 'SE18', 'SE19', 'FIBF', 'SPAU', 'SPDD',
]
// transactions with real screens in this workbench
const BOUNDARY_TCODES = new Set([
  'ST05', 'SAT', 'SE30', 'SM12', 'SM13', 'SU53', 'SU20', 'SU21', 'SCC1', 'SQ03', 'SLG0',
  'SE14', 'SE32', 'SE36', 'SE39', 'SE35', 'SE41', 'SE43', 'SE51', 'SE54', 'SM34',
  'SE71', 'SE72', 'SE73', 'SE78', 'SO10', 'SMARTFORMS', 'SMARTSTYLES', 'NACE', 'SP01', 'SPAD',
  'SHDB', 'SM35', 'LSMW', 'CG3Y', 'CG3Z', 'FILE', 'BAPI',
  'WE31', 'WE30', 'WE81', 'WE82', 'WE21', 'WE20', 'BD64', 'WE19', 'WE02', 'WE05', 'BD87',
  'CMOD', 'SMOD', 'SE18', 'SE19', 'FIBF', 'SPAU', 'SPDD',
])

export function CommandField() {
  const [value, setValue] = useState('')
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

  const handleCommand = useCallback(
    async (raw: string) => {
      let v = raw.trim()
      if (!v) return
      const st = () => useWorkbench.getState()

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
        st().addMessage('I', 'Session list: MER (1) — this is session 1')
        return
      }
      if (lower === '/h') {
        st().setDebugArmed(true)
        st().addMessage('S', 'Debugging switched on — the next execution (F8) stops in the ABAP Debugger')
        return
      }
      if (lower === '/hx' || lower === '/hoff') {
        st().setDebugArmed(false)
        st().addMessage('S', 'Debugging switched off')
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
            addMessage('I', 'Transaction SE38 started - ABAP Editor')
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
            addMessage('I', 'Transaction SE37 started - Function Builder')
            return
          case 'SE93':
            setTcodeDialogOpen(true)
            addMessage('S', 'Transaction registry (SE93)')
            return
          case 'SLG1':
            useWorkbench.setState({ view: 'home' })
            addMessage('S', 'Application log (SLG1) is not part of this training system')
            return
          case 'ST22':
            useWorkbench.setState({ lastTcode: 'ST22' })
            navigate('dumps')
            addMessage('S', 'ABAP Dump Analysis (ST22)')
            return
          case 'ADMIN':
            if (!useWorkbench.getState().session.owner) {
              addMessage('E', 'Administration is restricted to the designated owner account')
              return
            }
            window.location.assign('/admin')
            return
          case 'SEARCH': {
            if (!arg) {
              addMessage('W', 'SEARCH: enter a search term (SEARCH <text>)')
              return
            }
            useWorkbench.setState({ lastTcode: 'SEARCH', searchQuery: arg, view: 'search' })
            return
          }
          case 'MODERN':
            useWorkbench.setState({ lastTcode: 'MODERN' })
            navigate('modern')
            addMessage('S', 'Modern ABAP Workspace (7.40, CDS, RAP, AMDP)')
            return
          case 'SE91':
            useWorkbench.setState({ lastTcode: 'SE91' })
            navigate('messages')
            addMessage('S', 'Message Class Maintenance (SE91)')
            return
          case 'SE93':
            useWorkbench.setState({ lastTcode: 'SE93' })
            navigate('transactions')
            addMessage('S', 'Transaction Code Registry (SE93)')
            return
          case 'SNRO':
            useWorkbench.setState({ lastTcode: 'SNRO' })
            navigate('number-ranges')
            addMessage('S', 'Number Range Objects (SNRO)')
            return
          case 'AL11':
            useWorkbench.setState({ lastTcode: 'AL11' })
            navigate('al11')
            addMessage('S', 'Application Server Directory (AL11)')
            return
          case 'SM59':
            useWorkbench.setState({ lastTcode: 'SM59' })
            navigate('rfc')
            addMessage('S', 'RFC Destinations (SM59)')
            return
          case 'SM30': case 'SM31': {
            useWorkbench.setState({ lastTcode: 'SM30' })
            navigate('dictionary')
            addMessage('I', `Table maintenance (SM30) — open a table in SE11 and maintain its entries${arg ? `: ${arg.toUpperCase()}` : ''}`)
            return
          }
          case 'SE54':
            useWorkbench.setState({ lastTcode: 'SE54' })
            navigate('dictionary')
            addMessage('I', 'SE54 maintenance dialogs are covered by direct entry maintenance — use SM30 in SE11')
            return
          case 'SE12':
            useWorkbench.setState({ lastTcode: 'SE12' })
            navigate('dictionary')
            addMessage('S', 'ABAP Dictionary display (SE12) — same object list as SE11')
            return
          case 'SA38': {
            useWorkbench.setState({ lastTcode: 'SA38' })
            if (arg && /^[A-Za-z_\/][A-Za-z0-9_\/%$#]*$/.test(arg)) {
              await openProgramByName(arg)
              addMessage('S', `ABAP Program Execution (SA38) — ${arg.toUpperCase()}`)
              return
            }
            st().openSe38Initial()
            addMessage('I', 'ABAP Program Execution (SA38) — enter a report name')
            return
          }
          case 'SE84': case 'SE15':
            useWorkbench.setState({ lastTcode: first })
            navigate('search')
            addMessage('S', `Repository Information System (${first})`)
            return
          case 'SCI': case 'SLIN':
            useWorkbench.setState({ lastTcode: first })
            navigate('inspector')
            addMessage('S', `Code Inspector (${first}) — static checks and metrics`)
            return
          case 'SLG1':
            useWorkbench.setState({ lastTcode: 'SLG1' })
            navigate('slg1')
            addMessage('S', 'Application Log (SLG1)')
            return
          case 'SLG0':
            useWorkbench.setState({ lastTcode: 'SLG0', boundaryTcode: 'SLG0', view: 'boundary' })
            return
          case 'SM21':
            useWorkbench.setState({ lastTcode: 'SM21' })
            navigate('sm21')
            addMessage('S', 'System Log (SM21)')
            return
          case 'SM36': case 'SM37':
            useWorkbench.setState({ lastTcode: first })
            navigate('jobs')
            addMessage('S', first === 'SM36' ? 'Background Jobs — schedule (SM36)' : 'Background Jobs — monitor (SM37)')
            return
          case 'SM50':
            useWorkbench.setState({ lastTcode: 'SM50' })
            navigate('sm50')
            addMessage('S', 'Work Process Monitor (SM50) — simulated activity snapshot')
            return
          case 'SQ01': case 'SQ02':
            useWorkbench.setState({ lastTcode: first })
            navigate('query')
            addMessage('S', first === 'SQ01' ? 'ABAP Query — run queries (SQ01)' : 'ABAP Query — infosets (SQ02)')
            return
          case 'SE09': case 'SE10':
            useWorkbench.setState({ lastTcode: first })
            navigate('transports')
            addMessage('S', `Transport Organizer (${first})`)
            return
          case 'STMS':
            useWorkbench.setState({ lastTcode: 'STMS' })
            navigate('transports')
            addMessage('S', 'Transport Management System — import queue (STMS)')
            return
          case 'ABAPDOCU':
            useWorkbench.setState({ lastTcode: 'ABAPDOCU' })
            navigate('syllabus')
            addMessage('S', 'ABAP Keyword Documentation — the training syllabus with runnable examples')
            return
          default: {
            if (BOUNDARY_TCODES.has(first)) {
              useWorkbench.setState({ lastTcode: first, boundaryTcode: first, view: 'boundary' })
              addMessage('W', `Transaction ${first} — see the simulation boundary`)
              return
            }
          }
        }
      }

      // customer transactions registered in SE93
      if (/^[A-Z]/.test(upper)) {
        try {
          const { transactions } = await api<{ transactions: { code: string; program: string }[] }>('/api/transactions')
          const tx = transactions.find((t) => t.code === upper)
          if (tx) {
            useWorkbench.setState({ lastTcode: tx.code })
            await st().openProgramByName(tx.program)
            addMessage('S', `Transaction ${tx.code} — report ${tx.program}`)
            setValue('')
            return
          }
        } catch {
          /* fall through */
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
    [addMessage, setConfirmCreate, setTcodeDialogOpen],
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void handleCommand(value)
      setValue('')
    } else if (e.key === 'Escape') {
      setValue('')
    }
  }

  // boundary screens suggest an alternative transaction — dispatch via window event
  useEffect(() => {
    const handler = (e: Event) => {
      const cmd = (e as CustomEvent<string>).detail
      if (typeof cmd === 'string' && cmd) void handleCommand(cmd)
    }
    window.addEventListener('abap-command', handler)
    return () => window.removeEventListener('abap-command', handler)
  }, [handleCommand])

  return (
    <div className="flex items-stretch" role="search" aria-label="Command field">
      <div className="flex h-[24px] items-stretch overflow-hidden rounded-[2px] border border-[#7F9BB9] bg-white shadow-[inset_1px_1px_1px_rgba(0,0,0,0.07)]">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Command field"
          title="Command field (Ctrl+L) — t-codes: SE38, SE80, SE11, SE16, SE24, SE37, SE93, ST22, ADMIN · /n, /o, /i, /nend, /nex, /h · or object name · or SEARCH <text>"
          placeholder="OK code (SE38…)"
          className="w-[128px] bg-transparent px-1.5 font-mono text-[11px] uppercase text-[#12263A] outline-none placeholder:font-sans placeholder:normal-case placeholder:text-[#9AA7B4] md:w-[150px]"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="button"
          aria-label="Run OK-code"
          title="Execute command (Enter)"
          onClick={() => {
            void handleCommand(value)
            setValue('')
          }}
          className="flex w-[24px] items-center justify-center bg-gradient-to-b from-[#5F7FA6] to-[#3D5C82] text-white hover:from-[#6d8cb2] hover:to-[#47688f]"
        >
          <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M1 5 H8 M5.5 1.5 L9 5 L5.5 8.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
          </svg>
        </button>
      </div>
    </div>
  )
}
