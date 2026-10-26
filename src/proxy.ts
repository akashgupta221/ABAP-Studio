import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextFetchEvent, NextRequest, NextResponse } from 'next/server'
import { clerkServerConfigured } from '@/lib/auth-config'

function isAdminPage(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

// Clerk supplies the session; the admin page and every admin API still perform
// their own database role/identity check.
const clerkProxy = clerkMiddleware(async (auth, req) => {
  if (isAdminPage(req.nextUrl.pathname)) {
    await auth.protect()
  }
  return NextResponse.next()
})

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  // Disposable local/CI test runs authenticate through /api/test/session.
  // The test broker itself refuses Vercel/Turso deployments; this bypass only
  // matters when E2E_TEST_MODE is explicitly set on a non-cloud machine.
  if (process.env.E2E_TEST_MODE === '1' && !process.env.VERCEL) {
    return NextResponse.next()
  }
  if (!clerkServerConfigured()) return NextResponse.next()
  return clerkProxy(req, event)
}

export const config = {
  matcher: [
    // Skip static assets; run on pages and API routes.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
