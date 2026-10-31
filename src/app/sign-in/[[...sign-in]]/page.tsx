import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'
import { Suspense } from 'react'
import { AuthSplit } from '@/components/auth/auth-split'
import { clerkAppearance } from '@/components/auth/clerk-appearance'
import { ClerkSessionNotice } from '@/components/auth/clerk-session-notice'
import { clerkPublishableConfigured } from '@/lib/auth-config'

export default function SignInPage() {
  return (
    <AuthSplit mode="sign-in">
      <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-[#16283b]">
        Log in to ABAP Atelier
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[#5b6d80]">
        Secure sign-on is managed by Clerk. Use your verified email or Google account — password
        sign-in is retired.
      </p>

      <div className="mt-6">
        <ClerkSessionNotice />
      </div>

      <div className="mt-5 rounded-xl border border-[#e1e9f1] bg-[#f4f7fa] p-4" role="note">
        <p className="text-[12.5px] font-semibold text-[#16283b]">Google sign-in tip</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[#5b6d80]">
          If Google stops on “Verifying it’s you…” and asks for a passkey, choose{' '}
          <strong className="text-[#16283b]">Try another way</strong> →{' '}
          <strong className="text-[#16283b]">Enter your password</strong>. If the Google page keeps
          buffering, close it and use the <strong className="text-[#16283b]">Email</strong> one-time
          code instead.
        </p>
      </div>

      <div className="mt-6">
        {clerkPublishableConfigured() ? (
          <Suspense fallback={<div className="rounded-xl border border-[#e1e9f1] bg-[#f4f7fa] p-5 text-[13px] text-[#5b6d80]">Loading secure logon…</div>}>
            <SignIn
              appearance={clerkAppearance}
              fallbackRedirectUrl="/workbench?entry=1"
              signUpUrl="/sign-up"
            />
          </Suspense>
        ) : (
          <div className="rounded-xl border border-[#e1e9f1] bg-[#f4f7fa] p-5 text-[13px] leading-relaxed text-[#3d5068]">
            Clerk is not configured on this deployment. Set the Clerk environment variables to
            enable secure Email OTP and Google sign-in.
          </div>
        )}
      </div>

      <p className="mt-6 text-[13.5px] text-[#5b6d80]">
        New to ABAP Atelier?{' '}
        <Link href="/sign-up" className="font-semibold text-[#0a6ed1] hover:text-[#0a4d8c] hover:underline">
          Create a free account
        </Link>
      </p>
    </AuthSplit>
  )
}
