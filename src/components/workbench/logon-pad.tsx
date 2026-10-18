'use client'

// ── SAP GUI style logon pad (Client / User / Password / Language) ──────
import { useEffect, useState } from 'react'
import { useWorkbench, type SapSession } from './use-workbench'

function WindowGlyphs() {
  return (
    <span className="ml-auto flex select-none items-center gap-2 text-[13px] leading-none text-white/90">
      <span className="cursor-default px-1 opacity-80 hover:opacity-100" title="Minimize">–</span>
      <span className="cursor-default px-1 opacity-80 hover:opacity-100" title="Maximize">▢</span>
      <span className="sap-titlebar-close cursor-default rounded-[2px] px-1 opacity-90 hover:text-white" title="Close">✕</span>
    </span>
  )
}

export function LogonPad() {
  const logon = useWorkbench((s) => s.logon)
  const restoreSession = useWorkbench((s) => s.restoreSession)

  const [client, setClient] = useState('100')
  const [user, setUser] = useState('DEVELOPER')
  const [password, setPassword] = useState('welcome')
  const [language, setLanguage] = useState('EN')

  // remember me — restore a previous logon in this browser
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('sap.session')
      if (raw) {
        const s = JSON.parse(raw) as SapSession
        if (s?.loggedIn && s.user) restoreSession(s)
      }
    } catch {
      /* ignore */
    }
  }, [restoreSession])

  const doLogon = () => {
    const c = (client.trim() || '100').padStart(3, '0')
    logon({ user, client: c, language })
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      doLogon()
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-b from-[#0b2b52] via-[#14507f] to-[#0b2b52] p-4">
      <div className="w-[560px] max-w-full border border-[#0a2745] bg-[#f0f0f0] shadow-[0_20px_70px_rgba(0,0,0,0.65)]">
        {/* window title bar */}
        <div className="sap-titlebar flex h-7 items-center gap-2 px-2 text-white">
          <span className="flex h-4 w-4 items-center justify-center rounded-[2px] bg-white/15 text-[9px] font-black">S</span>
          <span className="text-[12.5px] font-semibold">SAP</span>
          <WindowGlyphs />
        </div>

        {/* logon toolbar (classic green check / exit) */}
        <div className="sap-toolbar flex h-[28px] items-center gap-1 px-1.5">
          <button
            type="button"
            className="sap-tool-btn"
            title="Log On (Enter)"
            onClick={doLogon}
            aria-label="Log on"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
              <circle cx="8" cy="8" r="7" fill="#2ea52e" stroke="#1c7a1c" />
              <path d="M4.4 8.3l2.3 2.3 4.8-5" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="sap-toolbar-sep" aria-hidden />
          <button
            type="button"
            className="sap-tool-btn"
            title="Exit"
            aria-label="Exit logon"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* logon screen body */}
        <div className="flex gap-6 px-6 py-6">
          <table className="border-separate border-spacing-y-[7px]">
            <tbody>
              <tr>
                <td className="pr-3 text-right align-middle text-[12.5px] text-[#1c2b3a]">Client</td>
                <td>
                  <input
                    className="sap-field w-[150px] font-mono"
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    onKeyDown={onKeyDown}
                    maxLength={3}
                    aria-label="Client"
                  />
                </td>
              </tr>
              <tr>
                <td className="pr-3 text-right text-[12.5px] text-[#1c2b3a]">User</td>
                <td>
                  <input
                    className="sap-field w-[150px] font-mono uppercase"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    onKeyDown={onKeyDown}
                    spellCheck={false}
                    aria-label="User"
                  />
                </td>
              </tr>
              <tr>
                <td className="pr-3 text-right text-[12.5px] text-[#1c2b3a]">Password</td>
                <td>
                  <input
                    type="password"
                    className="sap-field w-[150px] font-mono"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={onKeyDown}
                    aria-label="Password"
                  />
                </td>
              </tr>
              <tr>
                <td className="pr-3 text-right text-[12.5px] text-[#1c2b3a]">Language</td>
                <td>
                  <input
                    className="sap-field w-[150px] font-mono uppercase"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    onKeyDown={onKeyDown}
                    maxLength={2}
                    aria-label="Language"
                  />
                </td>
              </tr>
              <tr>
                <td className="pr-3 text-right align-top text-[12.5px] text-[#1c2b3a]">System</td>
                <td className="pt-[3px] text-[12.5px] text-[#1c2b3a]">
                  <span className="font-mono">NPL</span>
                  <span className="pl-2 text-[#44586c]">SAP NetWeaver AS ABAP — Training Edition</span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* SAP logon logo */}
          <div className="ml-auto flex flex-col items-end justify-start gap-2 pt-2">
            <div className="flex h-[74px] w-[74px] items-center justify-center bg-gradient-to-br from-[#3fa0e8] via-[#0a6ed1] to-[#0b3d78] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_6px_rgba(0,0,0,0.25)]">
              <span className="text-[26px] font-black tracking-tight text-white">SAP</span>
            </div>
            <span className="text-[10.5px] text-[#62748a]">NPL (1) (750)</span>
          </div>
        </div>

        {/* footer */}
        <div className="border-t border-[#cfd6dd] bg-[#e8ebef] px-6 py-3">
          <div className="flex items-center gap-3">
            <button type="button" className="sap-btn sap-btn-default" onClick={doLogon}>
              Log On
            </button>
            <span className="text-[11px] text-[#5b6b7d]">
              Press Enter to log on · any password is accepted (training system, no data leaves your browser)
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
