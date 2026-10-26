// ── Administration helpers ─────────────────────────────────────────────
import { db } from '@/lib/db'
import type { AuthUser } from '@/lib/session'

export type AdminAction =
  | 'USER_SUSPEND'
  | 'USER_REACTIVATE'
  | 'USER_SESSION_REVOKE'
  | 'USER_DELETE'
  | 'PROGRAM_DELETE'
  | 'OWNER_ASSIGN'
  | 'USER_EMAIL_MAP'

/** Append an immutable audit entry. Never include passwords, tokens, or source. */
export async function writeAudit(
  actor: Pick<AuthUser, 'id' | 'username'>,
  action: AdminAction,
  targetType: string,
  targetId: string,
  detail = '',
): Promise<void> {
  await db.adminAuditLog.create({
    data: {
      actorId: actor.id,
      actorName: actor.username,
      action,
      targetType,
      targetId,
      detail: detail.slice(0, 500),
    },
  })
}
