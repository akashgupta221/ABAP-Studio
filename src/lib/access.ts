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

// ── Function modules (SE37) ───────────────────────────────────────────
// The same ownership contract as programs: examples are shared and immutable,
// private FMs are visible/editable only to their creator (the owner may inspect
// and administer all rows). Negative/legacy rows without an owner stay
// owner-only until explicitly claimed.
export interface AccessFunctionModule {
  ownerId: string | null
  isExample: boolean
}

export interface AccessFunctionGroup {
  ownerId: string | null
  isExample: boolean
}

export function canViewFunction(
  user: AccessUser,
  fm: AccessFunctionModule,
  owner: boolean,
): boolean {
  if (fm.isExample) return true
  if (!fm.ownerId) return owner
  return owner || fm.ownerId === user.id
}

export function canEditFunction(
  user: AccessUser,
  fm: AccessFunctionModule,
  owner: boolean,
): boolean {
  if (fm.isExample) return false
  if (!fm.ownerId) return owner
  return owner || fm.ownerId === user.id
}

export function canViewFunctionGroup(
  user: AccessUser,
  group: AccessFunctionGroup,
  owner: boolean,
): boolean {
  if (group.isExample) return true
  if (!group.ownerId) return owner
  return owner || group.ownerId === user.id
}

export function canEditFunctionGroup(
  user: AccessUser,
  group: AccessFunctionGroup,
  owner: boolean,
): boolean {
  if (group.isExample) return false
  if (!group.ownerId) return owner
  return owner || group.ownerId === user.id
}

/** Prisma `where` for the SE37 overview list. */
export function functionListWhere(
  user: AccessUser,
  owner: boolean,
): Record<string, unknown> {
  if (owner) return {}
  return {
    OR: [{ isExample: true }, { ownerId: user.id }],
  }
}

/** Prisma `where` for the function-group strip. */
export function functionGroupListWhere(
  user: AccessUser,
  owner: boolean,
): Record<string, unknown> {
  if (owner) return {}
  return {
    OR: [{ isExample: true }, { ownerId: user.id }],
  }
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
