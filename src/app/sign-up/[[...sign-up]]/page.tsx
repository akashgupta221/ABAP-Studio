import { SignUp } from '@clerk/nextjs'
import Link from 'next/link'
import { Suspense } from 'react'
import { AuthSplit } from '@/components/auth/auth-split'
import { clerkAppearance } from '@/components/auth/clerk-appearance'
import { ClerkSessionNotice } from '@/components/auth/clerk-session-notice'
import { clerkPublishableConfigured } from '@/lib/auth-config'

export default function SignUpPage() {
  return (
    <AuthSplit mode="sign-up">
      <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-[#16283b]">
        Create your account
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[#5b6d80]">
        Registration is handled by Clerk with a verified email one-time code or Google. Your SAP
        user name is assigned from your verified email.
      </p>

      <div className="mt-6">
        <ClerkSessionNotice />
      </div>

      <div className="mt-6">
        {clerkPublishableConfigured() ? (
          <Suspense fallback={<div className="rounded-xl border border-[#e1e9f1] bg-[#f4f7fa] p-5 text-[13px] text-[#5b6d80]">Loading secure registration…</div>}>
            <SignUp
              appearance={clerkAppearance}
              fallbackRedirectUrl="/workbench?entry=1"
              signInUrl="/sign-in"
            />
          </Suspense>
        ) : (
          <div className="rounded-xl border border-[#e1e9f1] bg-[#f4f7fa] p-5 text-[13px] leading-relaxed text-[#3d5068]">
            Clerk is not configured on this deployment. Set the Clerk environment variables to
            enable secure verified-email registration.
          </div>
        )}
      </div>

      <p className="mt-6 text-[13.5px] text-[#5b6d80]">
        Already have an account?{' '}
        <Link href="/sign-in" className="font-semibold text-[#0a6ed1] hover:text-[#0a4d8c] hover:underline">
          Log in
        </Link>
      </p>
    </AuthSplit>
  )
}
