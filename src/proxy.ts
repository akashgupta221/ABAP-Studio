import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { clerkServerConfigured } from '@/lib/auth-mode'

function isAdminPage(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

// Clerk supplies the session; the admin page and every admin API still perform
// their own database role/identity check. During the approved fallback window a
// valid legacy cookie is allowed through to that server-side gate as well.
const clerkProxy = clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()
  if (isAdminPage(req.nextUrl.pathname) && !req.cookies.has('sap_session')) {
    await auth.protect()
  }
  const response = NextResponse.next()
  // Once a Clerk session exists, the legacy cookie must not be able to
  // resurface when the Clerk session is later signed out in the browser.
  if (userId) response.cookies.delete('sap_session')
  return response
})

export default clerkServerConfigured() ? clerkProxy : () => NextResponse.next()

export const config = {
  matcher: [
    // Skip static assets; run on pages and API routes.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
