'use client'

// ── SAP GUI status bar — dark rounded bar, pixel-matched to App 2 ──────
// Message (icon + colored text) on the left; INS/OVR, transaction, system,
// user, date and clock on the right, like the real WebGUI status bar.
import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheckBig, Info as InfoIcon, TriangleAlert } from 'lucide-react'
import { useWorkbench } from './use-workbench'
import type { MessageType } from './types'

function MsgIcon({ type }: { type: MessageType }) {
  switch (type) {
    case 'S':
      return <CircleCheckBig className="h-[14px] w-[14px] shrink-0 text-[#6ecf7e]" aria-hidden />
    case 'W':
      return <TriangleAlert className="h-[14px] w-[14px] shrink-0 text-[#e5c069]" aria-hidden />
    case 'E':
    case 'A':
      return <CircleAlert className="h-[14px] w-[14px] shrink-0 text-[#e8897f]" aria-hidden />
    default:
      return <InfoIcon className="h-[14px] w-[14px] shrink-0 text-[#9ec5e8]" aria-hidden />
  }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function StatusBar() {
  const messages = useWorkbench((s) => s.messages)
  const running = useWorkbench((s) => Object.values(s.programs).some((p) => p.running))
  const session = useWorkbench((s) => s.session)
  const insertMode = useWorkbench((s) => s.insertMode)
  const toggleInsertMode = useWorkbench((s) => s.toggleInsertMode)
  const systemInfoVisible = useWorkbench((s) => s.systemInfoVisible)
  const toggleSystemInfo = useWorkbench((s) => s.toggleSystemInfo)

  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const last = messages[messages.length - 1]
  const hours12 = now.getHours() % 12 || 12
  const timeStr = `${pad(hours12)}:${pad(now.getMinutes())} ${now.getHours() < 12 ? 'AM' : 'PM'}`

  return (
    <footer className="sap-statusbar shrink-0 px-[14px] pb-[6px] pt-[4px]">
      <div className="flex h-[30px] items-center rounded-[6px] bg-[#333d47] px-3" role="status" aria-label="Status bar">
        {running ? (
          <span className="flex min-w-0 items-center gap-2 text-[12px] text-[#dfe6ee]">
            <svg viewBox="0 0 16 16" className="h-[14px] w-[14px] shrink-0 animate-spin" aria-hidden>
              <circle cx="8" cy="8" r="6.4" fill="none" stroke="#5b6a78" strokeWidth="2.2" />
              <path d="M8 1.6a6.4 6.4 0 016.4 6.4" fill="none" stroke="#9ec5e8" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            Processing…
          </span>
        ) : last ? (
          <span className="flex min-w-0 items-center gap-2">
            <MsgIcon type={last.msgType} />
            <span
              className={`truncate text-[12px] ${
                last.msgType === 'E' || last.msgType === 'A'
                  ? 'text-[#f0b5ad]'
                  : last.msgType === 'W'
                    ? 'text-[#ecd9a0]'
                    : 'text-[#dfe6ee]'
              }`}
              title={last.text}
            >
              {last.text}
            </span>
          </span>
        ) : (
          <span className="min-w-0 truncate text-[12px] text-[#dfe6ee]">&nbsp;</span>
        )}

        <span className="flex-1" />

        {/* right: system information cluster (App 2 order: INS · system · user · time) */}
        {systemInfoVisible && (
          <span className="flex shrink-0 items-center gap-3 text-[11px] text-[#9aa7b6]">
            <button
              type="button"
              title="Data entry mode — click to toggle Insert/Overwrite"
              aria-label={`Data entry mode ${insertMode}`}
              onClick={toggleInsertMode}
              className="flex h-[24px] min-w-[30px] items-center rounded-[2px] px-1 font-mono text-[10px] font-bold text-[#c9d4de] hover:bg-white/10"
            >
              {insertMode}
            </button>
            <span className="hidden font-mono sm:inline" title="System, session and client">
              MER (1) 105
            </span>
            <span className="hidden font-mono md:inline" title={`User ${session.user}`}>
              {session.user}
            </span>
            <span className="hidden font-mono md:inline" title="System time">
              {timeStr}
            </span>
          </span>
        )}
        <button
          type="button"
          className="ml-1 flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[2px] text-[11px] text-[#9aa7b6] hover:bg-white/10"
          title={systemInfoVisible ? 'Hide system information' : 'Show system information'}
          aria-label={systemInfoVisible ? 'Hide system information' : 'Show system information'}
          onClick={toggleSystemInfo}
        >
          {systemInfoVisible ? '❮' : '❯'}
        </button>
      </div>
    </footer>
  )
}
