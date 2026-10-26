import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'
import { Suspense } from 'react'
import { ClerkSessionNotice } from '@/components/auth/clerk-session-notice'
import { clerkPublishableConfigured } from '@/lib/auth-config'

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#0b2b52] via-[#14507f] to-[#0b2b52] p-4">
      <section className="w-[620px] max-w-full border border-[#0a2745] bg-[#f0f0f0] shadow-[0_20px_70px_rgba(0,0,0,0.65)]">
        <div
          className="flex h-7 items-center gap-2 px-2 text-white"
          style={{
            background: 'linear-gradient(to bottom, #3875bd 0%, #205a9b 45%, #174a80 100%)',
            borderBottom: '1px solid #0e3560',
          }}
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-[2px] bg-white/15 text-[9px] font-black">
            S
          </span>
          <h1 className="text-[12.5px] font-semibold">SAP — Secure Logon</h1>
          <span className="ml-auto text-[10.5px] text-white/80">MER · Client 105</span>
        </div>
        <div className="border-b border-[#cfd6dd] bg-[#e8ebef] px-5 py-2 text-[11.5px] text-[#44586c]">
          Secure sign-on is managed by Clerk. Use your verified email or Google account.
          <ClerkSessionNotice />
        </div>
        <div className="flex justify-center px-4 py-6">
          {clerkPublishableConfigured() ? (
            <Suspense fallback={<div className="text-[12.5px] text-[#5b6d80]">Loading secure logon…</div>}>
              <SignIn fallbackRedirectUrl="/" signUpUrl="/sign-up" />
            </Suspense>
          ) : (
            <div className="max-w-[420px] text-[12.5px] text-[#8a1f1f]">
              Clerk is not configured on this deployment. Set the Clerk environment variables to
              enable secure Email OTP and Google sign-in.
            </div>
          )}
        </div>
        <div className="border-t border-[#cfd6dd] bg-[#e8ebef] px-5 py-3 text-[11.5px]">
          <Link className="sap-btn inline-block" href="/">
            « Back to workbench
          </Link>
        </div>
      </section>
    </main>
  )
}
