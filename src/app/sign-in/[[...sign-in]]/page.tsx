import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Suspense } from 'react'
import { AccessHero } from '@/components/auth/access-hero'
import { clerkAppearance } from '@/components/auth/clerk-appearance'
import { ClerkSessionNotice } from '@/components/auth/clerk-session-notice'
import { clerkPublishableConfigured } from '@/lib/auth-config'

export default function SignInPage() {
  return (
    <main className="mf-authpage">
      <AccessHero
        lead="Verified once."
        tail="Stamped at entry."
        description="Email one-time code or Google. Every entry is validated server-side and recorded against the system manifest."
        stamp="Secure gate"
      />

      <section className="mf-logon-side" aria-labelledby="signin-title">
        <div className="mf-login-card">
          <div className="mf-coupon-top">
            <span>Logon coupon</span>
            <span>MER · Client 105</span>
          </div>

          <div className="mf-auth-body">
            <h1 id="signin-title" className="mf-login-title">
              SAP — Secure Logon
            </h1>
            <p className="mf-login-sub">
              Secure sign-on is managed by Clerk. Use your verified email or Google account.
            </p>

            <ClerkSessionNotice />

            <div className="mf-auth-notice" role="note">
              <p>
                <strong>Google sign-in tip</strong>
              </p>
              <p>
                If Google stops on “Verifying it’s you…” and asks for a passkey, choose{' '}
                <strong>Try another way</strong> → <strong>Enter your password</strong>. If the
                Google page keeps buffering, close it and use the <strong>Email</strong> one-time
                code instead.
              </p>
            </div>

            <div className="mf-auth-clerk">
              {clerkPublishableConfigured() ? (
                <Suspense
                  fallback={<div className="mf-empty">Loading secure logon…</div>}
                >
                  <SignIn
                    appearance={clerkAppearance}
                    fallbackRedirectUrl="/"
                    signUpUrl="/sign-up"
                  />
                </Suspense>
              ) : (
                <div className="mf-auth-fallback">
                  Clerk is not configured on this deployment. Set the Clerk environment variables
                  to enable secure Email OTP and Google sign-in.
                </div>
              )}
            </div>

            <div className="mf-auth-back">
              <Link href="/">
                <ArrowLeft className="h-3 w-3" aria-hidden /> Back to workbench
              </Link>
              <span>System MER · Client 105</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
