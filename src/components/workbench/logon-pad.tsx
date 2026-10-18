'use client'

// ── SAP GUI style logon pad (Client / User / Password / Language) ──────
// Real authentication against the system's user master: passwords are
// scrypt-hashed on the server, the session is an HTTP-only cookie.
// New users can register from this screen ("Register").
import { useEffect, useState } from 'react'
import { useWorkbench } from './use-workbench'

function WindowGlyphs() {
  return (
    <span className="ml-auto flex select-none items-center gap-2 text-[13px] leading-none text-white/90">
      <span className="cursor-default px-1 opacity-80 hover:opacity-100" title="Minimize">–</span>
      <span className="cursor-default px-1 opacity-80 hover:opacity-100" title="Maximize">▢</span>
      <span className="sap-titlebar-close cursor-default rounded-[2px] px-1 opacity-90 hover:text-white" title="Close">✕</span>
    </span>
  )
}

type Mode = 'logon' | 'register'

export function LogonPad() {
  const logon = useWorkbench((s) => s.logon)
  const restoreSession = useWorkbench((s) => s.restoreSession)

  const [mode, setMode] = useState<Mode>('logon')
  const [client, setClient] = useState('100')
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [language, setLanguage] = useState('EN')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // session cookie — if this browser already logged on, skip the pad once
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/auth/me')
        const data = (await res.json()) as { user?: { username: string } | null }
        if (!cancelled && data.user?.username) {
          restoreSession({ user: data.user.username, client: '100', language: 'EN', loggedIn: true })
        }
      } catch {
        /* stay on the logon pad */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [restoreSession])

  const enterSystem = (username: string, lang = language) => {
    const c = (client.trim() || '100').padStart(3, '0')
    logon({ user: username, client: c, language: lang })
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
    setPassword('')
    setConfirm('')
  }

  const doLogon = async () => {
    if (busy) return
    const username = user.trim().toUpperCase()
    if (!username) {
      setError('Enter your user name')
      return
    }
    if (!password) {
      setError('Enter your password')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = (await res.json().catch(() => ({}))) as { user?: { username: string }; error?: string }
      if (!res.ok || !data.user) {
        setError(data.error ?? 'Logon failed')
        return
      }
      enterSystem(data.user.username)
    } catch {
      setError('Cannot reach the system — check that the server is running')
    } finally {
      setBusy(false)
    }
  }

  const doRegister = async () => {
    if (busy) return
    const username = user.trim().toUpperCase()
    if (!username) {
      setError('Enter a user name')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = (await res.json().catch(() => ({}))) as { user?: { username: string }; error?: string }
      if (!res.ok || !data.user) {
        setError(data.error ?? 'Registration failed')
        return
      }
      enterSystem(data.user.username)
    } catch {
      setError('Cannot reach the system — check that the server is running')
    } finally {
      setBusy(false)
    }
  }

  const submit = () => {
    void (mode === 'logon' ? doLogon() : doRegister())
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-b from-[#0b2b52] via-[#14507f] to-[#0b2b52] p-4">
      <div className="w-[560px] max-w-full border border-[#0a2745] bg-[#f0f0f0] shadow-[0_20px_70px_rgba(0,0,0,0.65)]">
        {/* window title bar */}
        <div className="sap-titlebar flex h-7 items-center gap-2 px-2 text-white">
          <span className="flex h-4 w-4 items-center justify-center rounded-[2px] bg-white/15 text-[9px] font-black">S</span>
          <span className="text-[12.5px] font-semibold">{mode === 'logon' ? 'SAP' : 'SAP — Create User'}</span>
          <WindowGlyphs />
        </div>

        {/* logon toolbar (classic green check / red cancel) */}
        <div className="sap-toolbar flex h-[28px] items-center gap-1 px-1.5">
          <button
            type="button"
            className="sap-tool-btn"
            title={mode === 'logon' ? 'Log On (Enter)' : 'Create User (Enter)'}
            onClick={submit}
            aria-label={mode === 'logon' ? 'Log on' : 'Create user'}
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
            title={mode === 'logon' ? 'Clear entries' : 'Back to log on'}
            onClick={() => switchMode('logon')}
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
              {mode === 'logon' && (
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
              )}
              <tr>
                <td className="pr-3 text-right text-[12.5px] text-[#1c2b3a]">User</td>
                <td>
                  <input
                    className="sap-field w-[150px] font-mono uppercase"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    onKeyDown={onKeyDown}
                    spellCheck={false}
                    autoFocus
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
              {mode === 'register' && (
                <tr>
                  <td className="pr-3 text-right text-[12.5px] text-[#1c2b3a]">Repeat&nbsp;Password</td>
                  <td>
                    <input
                      type="password"
                      className="sap-field w-[150px] font-mono"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      onKeyDown={onKeyDown}
                      aria-label="Repeat password"
                    />
                  </td>
                </tr>
              )}
              {mode === 'logon' && (
                <>
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
                </>
              )}
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

        {/* messages (like a real SAP error line) */}
        {error && (
          <div className="mx-6 mb-1 border border-[#d9a7a7] bg-[#fbeaea] px-3 py-[6px] text-[12px] text-[#8a1f1f]">
            {error}
          </div>
        )}

        {/* footer */}
        <div className="border-t border-[#cfd6dd] bg-[#e8ebef] px-6 py-3">
          {mode === 'logon' ? (
            <div className="flex items-center gap-3">
              <button type="button" className="sap-btn sap-btn-default" onClick={submit} disabled={busy}>
                {busy ? 'Logging on…' : 'Log On'}
              </button>
              <span className="text-[11.5px] text-[#5b6b7d]">New user?</span>
              <button type="button" className="sap-btn" onClick={() => switchMode('register')}>
                Register
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button type="button" className="sap-btn sap-btn-default" onClick={submit} disabled={busy}>
                {busy ? 'Creating…' : 'Create User'}
              </button>
              <button type="button" className="sap-btn" onClick={() => switchMode('logon')}>
                « Back to Log On
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
