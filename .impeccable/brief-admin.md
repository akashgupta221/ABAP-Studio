# Surface brief — System Administration and secure logon

## Scope and visitor mode

Operate. The owner-only `/admin` dashboard is the operating surface: metrics, the 7-day run ledger, recent executions, users, programs, audit, suspend/reactivate, revoke sessions, and confirmed deletion. Access. `/` and `/sign-in` are the entry surfaces for owners and trainees: Clerk Email OTP and Google only, with the Google/passkey fallback visible before the handoff.

## Audience and job

The owner is an ABAP practitioner running a multi-user training system. They need to see whether the system is healthy, find an account or program, act on it, and leave a stamped audit trail. The trainee needs one clear, trustworthy way into the same workbench. The owner's proof is live server data; the trainee's proof is the Clerk-marked secure handoff.

## Chosen direction and memorable moment

The System Manifest. Accounts are manifest lines, programs are a route, and runs are a stamped ledger. The memorable moment is the selected manifest line: a pale SAP-yellow row under a navy rail, with the owner gate stamped in blue at the bottom of the index.

## Unresolved decisions

No direction decision remains. The logon's manifest-cover composition and the admin's dense-table fallback are settled by the direction contract; both go to first-viewport review before polish.

## Direction contract

THESIS: The owner console is a working system manifest, not a generic card-grid admin dashboard. Every account, route and run is a record with a state stamp, and the rail is an index you can read before the data.

OWN-WORLD: Pale work surface `#F4F7FA`, navy top bar and rail `#0B2B52`, SAP blue `#0A6ED1`, ink `#16283B`, steel rules `#C9D4E0`, selected row `#FCF7BE`, success `#2EA52E`, warning `#B0600B`, error `#C0392B`. Archivo for display and body; Azeret Mono for manifest labels, numerals and stamps. Square controls, perforated coupon edges, carbon numerals, validation stamps, a route arc, and dense SAP tables.

STORY: The owner understands the system as a live manifest: who is on board, which routes exist, what ran, what failed, and which actions were stamped. They can act without leaving the record. The trainee understands that the logon coupon is the same system, entered securely through Clerk.

FIRST VIEWPORT: At 1440 px, a 54 px navy top bar; a 232 px manifest rail with four numbered sections; a main column with the eyebrow, the large System manifest title, and a SERVER VALIDATED stamp; a row of coupon KPIs; an account manifest table beside a system route card; and a run ledger chart beside recent executions. Owner actions stay in the top bar; section actions stay on the rail.

FORM: The System Manifest — option 08 of 13 in the hand, selected by the owner after its palette was grounded in the live SAP blue and steel tokens; seed:57976dd40a9cd84d.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
