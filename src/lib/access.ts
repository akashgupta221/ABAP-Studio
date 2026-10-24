// ── Pure program access rules (unit-testable) ─────────────────────────
// Examples are shared and read-only. Private programs belong to exactly one
// user. Rows created before ownership existed have no owner and are treated as
// owner-only until the owner explicitly claims/assigns them.
export interface AccessUser {
  id: string
  username: string
}

export interface AccessProgram {
  ownerId: string | null
  isExample: boolean
}

export function canViewProgram(user: AccessUser, program: AccessProgram, owner: boolean): boolean {
  if (program.isExample) return true
  if (!program.ownerId) return owner
  return owner || program.ownerId === user.id
}

/** Editing includes saving source, attributes, and deleting. Examples stay immutable. */
export function canEditProgram(user: AccessUser, program: AccessProgram, owner: boolean): boolean {
  if (program.isExample) return false
  if (!program.ownerId) return owner
  return owner || program.ownerId === user.id
}

export function isLegacyProgram(program: AccessProgram): boolean {
  return !program.isExample && !program.ownerId
}

/**
 * Prisma `where` for the repository list. Owners see everything; ordinary users
 * see shared examples plus their own private objects only.
 */
export function programListWhere(
  user: AccessUser,
  owner: boolean,
): Record<string, unknown> {
  if (owner) return {}
  return {
    OR: [{ isExample: true }, { ownerId: user.id }],
  }
}
