'use client'

// ── SAP GUI style logon pad ───────────────────────────────────────────
// Clerk (Email OTP + Google) is the only interactive sign-in path. The pad
// restores an existing Clerk session, then hands the browser to /sign-in.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClerkSessionNotice } from '@/components/auth/clerk-session-notice'
import { clerkPublishableConfigured } from '@/lib/auth-config'
import { useWorkbench } from './use-workbench'

function WindowGlyphs() {
  return (
    <span
      className="ml-auto flex select-none items-center gap-2 text-[13px] leading-none text-white/90"
      aria-hidden
    >
      <span className="cursor-default px-1 opacity-80 hover:opacity-100" title="Minimize">–</span>
      <span className="cursor-default px-1 opacity-80 hover:opacity-100" title="Maximize">▢</span>
      <span className="sap-titlebar-close cursor-default rounded-[2px] px-1 opacity-90 hover:text-white" title="Close">✕</span>
    </span>
  )
}

export function LogonPad() {
  const restoreSession = useWorkbench((s) => s.restoreSession)

  const [client, setClient] = useState('105')
  const [language, setLanguage] = useState('EN')

  // A Clerk session may already exist in this browser.
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

  return (
    <main
      className="flex h-screen w-full items-center justify-center bg-gradient-to-b from-[#0b2b52] via-[#14507f] to-[#0b2b52] p-4"
      data-testid="logon-pad"
    >
      <section
        aria-labelledby="logon-title"
        className="w-[600px] max-w-full border border-[#0a2745] bg-[#f0f0f0] shadow-[0_20px_70px_rgba(0,0,0,0.65)]"
      >
        {/* window title bar (dark SAP GUI window style for the logon dialog) */}
        <div
          className="flex h-7 items-center gap-2 px-2 text-white"
          style={{
            background: 'linear-gradient(to bottom, #3875bd 0%, #205a9b 45%, #174a80 100%)',
            borderBottom: '1px solid #0e3560',
          }}
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-[2px] bg-white/15 text-[9px] font-black" aria-hidden>S</span>
          <h1 id="logon-title" className="text-[12.5px] font-semibold">SAP — Secure Logon</h1>
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
              setClient('105')
              setLanguage('EN')
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
                  <th scope="row" className="pr-3 text-right align-middle text-[12.5px] font-normal text-[#1c2b3a]">
                    <label htmlFor="logon-client">Client</label>
                  </th>
                  <td>
                    <input
                      id="logon-client"
                      className="sap-field w-[150px] font-mono"
                      value={client}
                      onChange={(e) => setClient(e.target.value)}
                      maxLength={3}
                    />
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="pr-3 text-right text-[12.5px] font-normal text-[#1c2b3a]">
                    <label htmlFor="logon-language">Language</label>
                  </th>
                  <td>
                    <input
                      id="logon-language"
                      className="sap-field w-[150px] font-mono uppercase"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      maxLength={2}
                    />
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="pr-3 text-right align-top text-[12.5px] font-normal text-[#1c2b3a]">
                    System
                  </th>
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
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0a6ed1] text-[10px] font-bold text-white" aria-hidden>
                  ✓
                </span>
                <h2 className="text-[12.5px] font-semibold text-[#1c2b3a]">Clerk secure sign-on</h2>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#44586c]">
                Use a verified email one-time code or Google. ABAP-Studio never stores an
                application password.
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#44586c]">
                Google passkey tip: choose <strong>Try another way</strong> →{' '}
                <strong>Enter your password</strong>, or use the email one-time code.
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
          </div>

          {/* SAP logon logo */}
          <div className="flex flex-col items-end justify-start gap-2 pt-2" aria-hidden>
            <div className="flex h-[74px] w-[74px] items-center justify-center bg-gradient-to-br from-[#3fa0e8] via-[#0a6ed1] to-[#0b3d78] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_6px_rgba(0,0,0,0.25)]">
              <span className="text-[26px] font-black tracking-tight text-white">SAP</span>
            </div>
            <span className="text-[10.5px] text-[#4f6275]">MER (105)</span>
          </div>
        </div>

        {/* footer */}
        <div className="border-t border-[#cfd6dd] bg-[#e8ebef] px-6 py-3">
          <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-[#5b6b7d]">
            <span>Secure identity by Clerk</span>
            <span className="text-[#a0aab5]" aria-hidden>·</span>
            <span>Email OTP and Google</span>
            <span className="ml-auto text-[10.5px] text-[#4d5d6e]">System MER · Client 105</span>
          </div>
        </div>
      </section>
    </main>
  )
}
