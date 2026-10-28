'use client'

// ── Secure logon coupon ───────────────────────────────────────────────
// Clerk (Email OTP + Google) is the only interactive sign-in path. The pad
// restores an existing Clerk session, then hands the browser to /sign-in.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { AccessHero } from '@/components/auth/access-hero'
import { ClerkSessionNotice } from '@/components/auth/clerk-session-notice'
import { clerkPublishableConfigured } from '@/lib/auth-config'
import { useWorkbench } from './use-workbench'

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
    <main className="mf-logon" data-testid="logon-pad">
      <AccessHero
        lead="One gate."
        tail="Every record."
        description="The same manifest opens for owners and trainees: verify with Clerk, then enter the ABAP workbench at client 105."
      />

      <section className="mf-logon-side" aria-labelledby="logon-title">
        <div className="mf-login-card">
          <div className="mf-coupon-top">
            <span>Access coupon</span>
            <span>MER · Client 105</span>
          </div>

          <div className="mf-login-body">
            <h1 id="logon-title" className="mf-login-title">
              SAP — Secure Logon
            </h1>
            <p className="mf-login-sub">
              One verified identity opens the workbench. ABAP-Studio never stores an application
              password.
            </p>

            <div className="mf-fields">
              <div className="mf-field">
                <label htmlFor="logon-client">Client</label>
                <input
                  id="logon-client"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  maxLength={3}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </div>
              <div className="mf-field">
                <label htmlFor="logon-language">Language</label>
                <input
                  id="logon-language"
                  className="uppercase"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  maxLength={2}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="mf-system-line">
              <span>System</span>
              <b>MER</b>
              <span>SAP NetWeaver AS ABAP — Training Edition</span>
            </div>

            <ClerkSessionNotice />

            <div className="mf-login-box">
              <div className="mf-login-box-head">
                <span className="mf-check" aria-hidden>
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <h2>Clerk secure sign-on</h2>
              </div>
              <p>Use a verified email one-time code or Google. No application password is stored.</p>
              <p className="mf-tip">
                <strong>Google passkey tip:</strong> choose <strong>Try another way</strong> →{' '}
                <strong>Enter your password</strong>, or use the email one-time code.
              </p>
              <div className="mf-login-actions">
                <Link href="/sign-in" className="mf-login-primary">
                  Log On with Email / Google
                </Link>
                {clerkPublishableConfigured() ? (
                  <Link href="/sign-up" className="mf-login-secondary">
                    Create user
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="mf-login-foot">
              <span>Secure identity by Clerk</span>
              <span>Email OTP + Google</span>
              <span>MER · 105</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
