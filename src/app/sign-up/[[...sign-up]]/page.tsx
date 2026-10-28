import { SignUp } from '@clerk/nextjs'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Suspense } from 'react'
import { AccessHero } from '@/components/auth/access-hero'
import { clerkAppearance } from '@/components/auth/clerk-appearance'
import { ClerkSessionNotice } from '@/components/auth/clerk-session-notice'
import { clerkPublishableConfigured } from '@/lib/auth-config'

export default function SignUpPage() {
  return (
    <main className="mf-authpage">
      <AccessHero
        lead="Join the manifest."
        tail="Keep it validated."
        description="Create a verified Clerk identity. Your ABAP user name is assigned from your verified email and reviewed by the system administrator."
        stamp="New line"
      />

      <section className="mf-logon-side" aria-labelledby="signup-title">
        <div className="mf-login-card">
          <div className="mf-coupon-top">
            <span>Enrolment coupon</span>
            <span>MER · Client 105</span>
          </div>

          <div className="mf-auth-body">
            <h1 id="signup-title" className="mf-login-title">
              SAP — Create User
            </h1>
            <p className="mf-login-sub">
              Create a verified Clerk account. Your SAP user name is assigned from your verified
              email and can be reviewed by the system administrator.
            </p>

            <ClerkSessionNotice />

            <div className="mf-auth-clerk">
              {clerkPublishableConfigured() ? (
                <Suspense
                  fallback={<div className="mf-empty">Loading secure registration…</div>}
                >
                  <SignUp
                    appearance={clerkAppearance}
                    fallbackRedirectUrl="/"
                    signInUrl="/sign-in"
                  />
                </Suspense>
              ) : (
                <div className="mf-auth-fallback">
                  Clerk is not configured on this deployment. Set the Clerk environment variables
                  to enable secure verified-email registration.
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
