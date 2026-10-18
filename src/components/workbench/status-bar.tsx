'use client'

// ── SAP GUI status bar (message area + system information panes) ───────
import { useEffect, useState } from 'react'
import { useWorkbench } from './use-workbench'
import type { MessageType } from './types'

function MsgIcon({ type }: { type: MessageType }) {
  switch (type) {
    case 'S':
      return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden>
          <circle cx="8" cy="8" r="7" fill="#2ea52e" stroke="#1c7a1c" />
          <path d="M4.4 8.3l2.3 2.3 4.8-5" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'W':
      return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden>
          <path d="M8 1.6L15 14H1z" fill="#f2c200" stroke="#9c7d00" strokeLinejoin="round" />
          <path d="M8 6v4" stroke="#3b2f00" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="8" cy="12" r="0.9" fill="#3b2f00" />
        </svg>
      )
    case 'E':
      return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden>
          <circle cx="8" cy="8" r="7" fill="#d92c2c" stroke="#a01f1f" />
          <path d="M5.2 5.2l5.6 5.6M10.8 5.2l-5.6 5.6" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      )
    case 'A':
      return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden>
          <path d="M5 1.5h6L14.5 5v6L11 14.5H5L1.5 11V5z" fill="#d92c2c" stroke="#8f1b1b" strokeLinejoin="round" />
          <path d="M4.5 8h7" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden>
          <circle cx="8" cy="8" r="7" fill="#1f6fc4" stroke="#134f92" />
          <path d="M8 4.4v0.2" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" />
          <path d="M8 7v4.4" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      )
  }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function StatusBar() {
  const messages = useWorkbench((s) => s.messages)
  const lastTcode = useWorkbench((s) => s.lastTcode)
  const running = useWorkbench((s) => Object.values(s.programs).some((p) => p.running))
  const session = useWorkbench((s) => s.session)
  const insertMode = useWorkbench((s) => s.insertMode)
  const toggleInsertMode = useWorkbench((s) => s.toggleInsertMode)
  const systemInfoVisible = useWorkbench((s) => s.systemInfoVisible)
  const toggleSystemInfo = useWorkbench((s) => s.toggleSystemInfo)
  const setSystemStatusOpen = useWorkbench((s) => s.setSystemStatusOpen)

  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const last = messages[messages.length - 1]
  const dateStr = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

  const msgColor =
    last?.msgType === 'E' || last?.msgType === 'A'
      ? 'text-[#a01f1f]'
      : last?.msgType === 'W'
        ? 'text-[#8a6d1a]'
        : 'text-[#1c2b3a]'

  return (
    <footer className="sap-statusbar flex h-[24px] shrink-0 items-stretch text-[11.5px] text-[#1c2b3a]" role="status" aria-label="Status bar">
      {/* message area */}
      <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
        {running ? (
          <span className="flex items-center gap-2 text-[#0a4f9c]">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 animate-spin" aria-hidden>
              <circle cx="8" cy="8" r="6.4" fill="none" stroke="#9db8d6" strokeWidth="2.2" />
              <path d="M8 1.6a6.4 6.4 0 016.4 6.4" fill="none" stroke="#0a6ed1" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            Processing…
          </span>
        ) : last ? (
          <>
            <MsgIcon type={last.msgType} />
            <span className={`truncate ${msgColor}`} title={last.text}>
              {last.text}
            </span>
          </>
        ) : (
          <span className="truncate text-[#5b6d80]">&nbsp;</span>
        )}
      </div>

      {/* system information panes (right) */}
      <div className="flex shrink-0 items-stretch">
        <button
          type="button"
          className="flex w-4 cursor-pointer items-center justify-center text-[#607589] hover:bg-[#d7e6f7]"
          title={systemInfoVisible ? 'Hide system information' : 'Show system information'}
          onClick={toggleSystemInfo}
        >
          {systemInfoVisible ? '❮' : '❯'}
        </button>
        {systemInfoVisible && (
          <>
            <span className="sap-status-seg font-mono" title="Current transaction">
              {lastTcode}
            </span>
            <button
              type="button"
              className="sap-status-seg hover:bg-[#d7e6f7]"
              title="System information — click for System Status"
              onClick={() => setSystemStatusOpen(true)}
            >
              NPL (1) (750)
            </button>
            <span className="sap-status-seg" title="User">
              {session.user}
            </span>
            <span className="sap-status-seg" title="Date">
              {dateStr}
            </span>
            <span className="sap-status-seg font-mono" title="Time">
              {timeStr}
            </span>
            <button
              type="button"
              className="sap-status-seg w-[46px] justify-center font-semibold uppercase hover:bg-[#d7e6f7]"
              title="Data entry mode — click to toggle Insert/Overwrite"
              onClick={toggleInsertMode}
            >
              {insertMode}
            </button>
          </>
        )}
      </div>
    </footer>
  )
}
