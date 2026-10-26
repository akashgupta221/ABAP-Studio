export const dynamic = 'force-dynamic'

import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest } from 'next/server'
import { ensureSchema } from '@/lib/db'
import {
  clerkIdentityFromWebhookUser,
  type ClerkWebhookUserLike,
} from '@/lib/clerk-identity'
import { removeDeletedClerkIdentity, syncClerkIdentity } from '@/lib/clerk-user'

// POST /api/webhooks/clerk — signed Clerk user sync.
// The webhook is a convenience/consistency path; session resolution also links
// on first sign-in. Neither path can choose a role or grant ownership.
export async function POST(req: NextRequest) {
  const signingSecret =
    process.env.CLERK_WEBHOOK_SECRET ?? process.env.CLERK_WEBHOOK_SIGNING_SECRET
  if (!signingSecret) {
    return Response.json(
      { error: 'Clerk webhook signing secret is not configured' },
      { status: 503 },
    )
  }

  let event: Awaited<ReturnType<typeof verifyWebhook>>
  try {
    event = await verifyWebhook(req, { signingSecret })
  } catch (error) {
    console.error('[clerk/webhook] signature verification failed:', error instanceof Error ? error.message : error)
    return Response.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  try {
    await ensureSchema()

    if (event.type === 'user.created' || event.type === 'user.updated') {
      const identity = clerkIdentityFromWebhookUser(event.data as unknown as ClerkWebhookUserLike)
      if (identity) await syncClerkIdentity(identity)
      return Response.json({ ok: true })
    }

    if (event.type === 'user.deleted') {
      const clerkId = (event.data as { id?: string }).id
      if (clerkId) await removeDeletedClerkIdentity(clerkId)
      return Response.json({ ok: true })
    }

    return Response.json({ ok: true, ignored: event.type })
  } catch (error) {
    console.error('[clerk/webhook] handler failed:', error instanceof Error ? error.message : error)
    return Response.json({ error: 'Webhook could not be processed' }, { status: 500 })
  }
}
