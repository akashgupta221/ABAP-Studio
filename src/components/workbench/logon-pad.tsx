'use client'

// ── SAP GUI style logon pad ───────────────────────────────────────────
// Clerk provides the primary secure sign-on (Email OTP + Google). The legacy
// SAP user master stays available only as a clearly marked fallback while the
// owner's existing accounts are linked by verified email.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClerkSessionNotice } from '@/components/auth/clerk-session-notice'
import { clerkPublishableConfigured, legacyAuthVisibleInUi } from '@/lib/auth-mode'
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

export function LogonPad() {
  const logon = useWorkbench((s) => s.logon)
  const restoreSession = useWorkbench((s) => s.restoreSession)

  const [client, setClient] = useState('105')
  const [language, setLanguage] = useState('EN')
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [legacyOpen, setLegacyOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A Clerk or legacy session may already exist in this browser.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/auth/me')
        const data = (await res.json()) as {
          user?: { username: string; role?: string; owner?: boolean } | null
        }
        if (!cancelled && data.user?.username) {
          restoreSession({
            user: data.user.username,
            client: '105',
            language: 'EN',
            loggedIn: true,
            role: data.user.role,
            owner: data.user.owner,
          })
        }
      } catch {
        /* stay on the logon pad */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [restoreSession])

  const enterSystem = (username: string, role?: string, owner?: boolean, lang = language) => {
    const c = (client.trim() || '105').padStart(3, '0')
    logon({ user: username, client: c, language: lang, role, owner })
  }

  const doLegacyLogon = async () => {
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
      const data = (await res.json().catch(() => ({}))) as {
        user?: { username: string; role?: string; owner?: boolean }
        error?: string
      }
      if (!res.ok || !data.user) {
        setError(data.error ?? 'Logon failed')
        return
      }
      enterSystem(data.user.username, data.user.role, data.user.owner)
    } catch {
      setError('Cannot reach the system — check that the server is running')
    } finally {
      setBusy(false)
    }
  }

  const doLegacyRegister = async () => {
    if (busy) return
    const username = user.trim().toUpperCase()
    if (!username) {
      setError('Enter a user name')
      return
    }
    if (password.length < 8) {
      setError('Local test users need a password of at least 8 characters')
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
      const data = (await res.json().catch(() => ({}))) as {
        user?: { username: string; role?: string; owner?: boolean }
        error?: string
      }
      if (!res.ok || !data.user) {
        setError(data.error ?? 'Registration failed')
        return
      }
      enterSystem(data.user.username, data.user.role, data.user.owner)
    } catch {
      setError('Cannot reach the system — check that the server is running')
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void doLegacyLogon()
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-b from-[#0b2b52] via-[#14507f] to-[#0b2b52] p-4">
      <div className="w-[600px] max-w-full border border-[#0a2745] bg-[#f0f0f0] shadow-[0_20px_70px_rgba(0,0,0,0.65)]">
        {/* window title bar */}
        <div className="sap-titlebar flex h-7 items-center gap-2 px-2 text-white">
          <span className="flex h-4 w-4 items-center justify-center rounded-[2px] bg-white/15 text-[9px] font-black">S</span>
          <span className="text-[12.5px] font-semibold">SAP — Secure Logon</span>
          <WindowGlyphs />
        </div>

        {/* logon toolbar */}
        <div className="sap-toolbar flex h-[28px] items-center gap-1 px-1.5">
          <Link
            href="/sign-in"
            className="sap-tool-btn"
            title="Secure Log On"
            aria-label="Secure log on"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
              <circle cx="8" cy="8" r="7" fill="#2ea52e" stroke="#1c7a1c" />
              <path d="M4.4 8.3l2.3 2.3 4.8-5" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <span className="sap-toolbar-sep" aria-hidden />
          <button
            type="button"
            className="sap-tool-btn"
            title="Clear entries"
            aria-label="Clear entries"
            onClick={() => {
              setUser('')
              setPassword('')
              setError(null)
            }}
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* logon screen body */}
        <div className="flex gap-6 px-6 py-6">
          <div className="min-w-0 flex-1">
            <table className="border-separate border-spacing-y-[7px]">
              <tbody>
                <tr>
                  <td className="pr-3 text-right align-middle text-[12.5px] text-[#1c2b3a]">Client</td>
                  <td>
                    <input
                      className="sap-field w-[150px] font-mono"
                      value={client}
                      onChange={(e) => setClient(e.target.value)}
                      maxLength={3}
                      aria-label="Client"
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
                      maxLength={2}
                      aria-label="Language"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="pr-3 text-right align-top text-[12.5px] text-[#1c2b3a]">System</td>
                  <td className="pt-[3px] text-[12.5px] text-[#1c2b3a]">
                    <span className="font-mono">MER</span>
                    <span className="pl-2 text-[#44586c]">SAP NetWeaver AS ABAP — Training Edition</span>
                  </td>
                </tr>
              </tbody>
            </table>

            <ClerkSessionNotice />

            <div className="mt-5 border border-[#b9c9da] bg-white/70 p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0a6ed1] text-[10px] font-bold text-white">
                  ✓
                </span>
                <span className="text-[12.5px] font-semibold text-[#1c2b3a]">Clerk secure sign-on</span>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#44586c]">
                Use a verified email one-time code or Google. No application password is stored by
                ABAP-Studio.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link href="/sign-in" className="sap-btn sap-btn-primary inline-flex items-center">
                  Log On with Email / Google
                </Link>
                {clerkPublishableConfigured() ? (
                  <Link href="/sign-up" className="sap-btn inline-flex items-center">
                    Create User
                  </Link>
                ) : null}
              </div>
            </div>

            {legacyAuthVisibleInUi() && (
              <div className="mt-3">
                <button
                  type="button"
                  className="text-[11px] text-[#315f8f] underline decoration-dotted underline-offset-2 hover:text-[#0a4c8a]"
                  onClick={() => {
                    setLegacyOpen((open) => !open)
                    setError(null)
                  }}
                >
                  {legacyOpen ? 'Hide legacy SAP user master' : 'Legacy SAP user master (temporary)'}
                </button>

                {legacyOpen && (
                  <div className="mt-2 border border-[#d0d8e1] bg-[#f8fafc] p-3">
                    <div className="mb-2 text-[10.5px] text-[#5b6d80]">
                      Fallback only while existing accounts are linked by verified email.
                    </div>
                    <table className="border-separate border-spacing-y-[7px]">
                      <tbody>
                        <tr>
                          <td className="pr-3 text-right text-[12.5px] text-[#1c2b3a]">User</td>
                          <td>
                            <input
                              className="sap-field w-[150px] font-mono uppercase"
                              value={user}
                              onChange={(e) => setUser(e.target.value)}
                              onKeyDown={onKeyDown}
                              spellCheck={false}
                              aria-label="Legacy user"
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
                              aria-label="Legacy password"
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="sap-btn sap-btn-default"
                        onClick={() => void doLegacyLogon()}
                        disabled={busy}
                      >
                        {busy ? 'Logging on…' : 'Legacy Log On'}
                      </button>
                      {!clerkPublishableConfigured() && process.env.NODE_ENV !== 'production' ? (
                        <button
                          type="button"
                          className="sap-btn"
                          onClick={() => void doLegacyRegister()}
                          disabled={busy}
                        >
                          Create local test user
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SAP logon logo */}
          <div className="flex flex-col items-end justify-start gap-2 pt-2">
            <div className="flex h-[74px] w-[74px] items-center justify-center bg-gradient-to-br from-[#3fa0e8] via-[#0a6ed1] to-[#0b3d78] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_6px_rgba(0,0,0,0.25)]">
              <span className="text-[26px] font-black tracking-tight text-white">SAP</span>
            </div>
            <span className="text-[10.5px] text-[#62748a]">MER (105)</span>
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
          <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-[#5b6b7d]">
            <span>Secure identity by Clerk</span>
            <span className="text-[#a0aab5]">·</span>
            <span>Email OTP and Google</span>
            <span className="ml-auto text-[10.5px] text-[#6a7a8b]">System MER · Client 105</span>
          </div>
        </div>
      </div>
    </div>
  )
}
