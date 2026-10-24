// ── Per-user practice sandbox ─────────────────────────────────────────
// Every user owns a private Z_MY_PRACTICE. Program names are globally unique
// (an existing database invariant), so the physical row uses the user name as
// a suffix while the workbench always presents it as "My Practice Program".
export const SANDBOX_LABEL = 'Z_MY_PRACTICE'

export function sandboxName(username: string): string {
  return `${SANDBOX_LABEL}_${username.toUpperCase()}`.slice(0, 40)
}

export const SANDBOX_TITLE = 'My Practice Program — Free Coding Sandbox'

export const SANDBOX_DESCRIPTION =
  'Your own private practice program. Training examples are read-only; this one is yours to change, run and save.'

export const SANDBOX_SOURCE = `REPORT Z_MY_PRACTICE.

*════════════════════════════════════════════════════════════════
*  YOUR PRACTICE PROGRAM — free coding sandbox
*════════════════════════════════════════════════════════════════
*  The training examples are read-only. THIS program is yours:
*    F8       execute the program
*    Ctrl+S   save your changes
*    Ctrl+F2  syntax check
*  Change anything below, or paste code from any lesson.
*════════════════════════════════════════════════════════════════

DATA gv_greeting TYPE string VALUE 'Hello from my own practice program!'.

WRITE gv_greeting.
SKIP.
WRITE / |Today is { sy-datum DATE = ISO } — user { sy-uname }, client { sy-mandt }|.
WRITE / |System { sy-sysid } · program { sy-repid }|.
SKIP.
`

export const SANDBOX_TAGS = 'practice,sandbox,own program,free coding'
