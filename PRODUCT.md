# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Owner / administrator.** The single provisioned owner runs the training environment: monitors adoption and execution health, manages users, inspects every non-example program, suspends or reactivates accounts, revokes sessions, and performs confirmed deletions. The owner is also a practitioner and may use the same training tools as learners.
- **Trainees / learners.** People learning ABAP who sign in with Clerk, follow a classical ABAP curriculum, run programs in a private sandbox, save their own work, use the Modern ABAP workspace, and practise SAP transactions such as SE38, SE37, SE11 and SE16N. They may be first-time visitors or returning users continuing a course.
- **Unauthenticated visitors.** See the logon and Clerk sign-in surfaces. The workbench and all private data require authentication.

## Product Purpose

ABAP-Studio is a browser-based SAP NetWeaver-style ABAP training workbench. It lets people practise the day-to-day SAP workflow — logon, Easy Access, SE38, SE37, DDIC views, ALV grids and debugging — while running actual ABAP through a purpose-built TypeScript interpreter. A separate Modern ABAP workspace adds executable 7.40 constructor expressions plus validated CDS, RAP and AMDP artefacts.

Success means a learner can move from first sign-in to running and saving real ABAP without an SAP system, and the owner can run the environment safely without leaving the product.

## Positioning

The product combines faithful SAP NetWeaver interaction patterns with a from-scratch ABAP interpreter and a transparent Modern ABAP capability matrix. It is a training simulator, not a thin wrapper around a real SAP backend: learners get authentic transactions and terminology, while every simulated or validated boundary is labelled rather than implied.

## Operating Context

- Runs in a web browser on desktop and mobile; the SAP-style workbench is the primary surface, with a separate Modern ABAP view opened from ABAP Training or the `MODERN` command.
- The shared curriculum has 10 topics, 41 preloaded objects (36 Standard examples, 1 shared INCLUDE, 4 Modern examples), 11 demo tables with 113 rows, and function modules.
- Users work through Easy Access, transaction codes, editors, selection screens, ALV-style output, the debugger, ST22 dump analysis and the Pretty Printer.
- Identity is provided by Clerk. The application database remains authoritative for roles, suspension, program ownership and audit history.
- Production runs on Vercel Hobby with a Turso free-plan database; local development uses SQLite. The product is intended to stay free to deploy and use.
- The owner provisions the owner account by matching a database `role = OWNER` to `OWNER_EMAIL`; production fails closed when that email is missing or mismatched.

## Capabilities and Constraints

- **Workbench:** Easy Access tree and command field; transactions SE38, SE37, SE11, SE16N, SE24; ABAP editor; syntax check; ALV-style and list output; selection screens; debugger with line breakpoints; ST22; Pretty Printer; function module CRUD and test execution; Modern ABAP workspace.
- **Authentication:** Clerk Email OTP and Google with verified-email account linking. Password, phone and username sign-in are disabled. `/api/auth/login` is a `403` stub and `/api/auth/register` is a `410` stub; legacy password authentication is permanently retired.
- **Authorization:** All authorization is enforced server-side, never from browser-supplied role or user id. Shared examples are readable by everyone and read-only. Private programs and Modern objects are creator-only. The owner can inspect all non-example programs. A server-side owner gate protects `/admin`, and each admin API enforces the same rule independently.
- **Admin capabilities that must remain:** overview metrics, 7-day execution chart, recent executions, users, all programs, audit log, suspend/reactivate, revoke sessions, user deletion with exact-username confirmation, and program deletion.
- **Simulation boundaries:** ABAP 7.40 constructor expressions are executable. CDS view entities and RAP behavior definitions are validated structurally. AMDP classes are simulated. Real HANA pushdown, RAP/OData runtime, AMDP execution and dynpro generation are unsupported and must never be implied.
- **Security controls:** server-side sessions, same-origin CSRF checks, rate limiting, session revocation, tenant isolation and audit history.
- **Terminology:** use SAP terms accurately (logon, Easy Access, transaction, client, system, ABAP, DDIC, ALV, function module, dump). The system identity is `MER`, client `105`.
- **Out of scope:** connecting to a real SAP system, executing HANA SQL, generating dynpros, or claiming production SAP parity.

## Brand Commitments

- The product name is **ABAP-Studio**.
- Its identity is an authentic SAP NetWeaver training workbench. SAP interaction patterns, transaction codes and system identity (`MER`, client `105`) are core recognition cues, not decoration.
- The voice is precise, instructional and SAP-fluent. It explains what a control does and states simulation limits plainly; it never pretends the simulator is a live SAP production system.
- The product is explicitly a learning environment: welcoming to trainees, but never cartoonish or inaccurate for experienced SAP users.

## Evidence on Hand

- `README.md` — product description, feature inventory, security model, tech stack, deployment and environment contract.
- `docs/FINAL-ACCEPTANCE-REPORT.md` — technical acceptance evidence for the P3 integration.
- `docs/CLERK-SETUP.md`, `docs/GOOGLE-OAUTH-SETUP.md`, `docs/FREE-DOMAIN-SETUP.md` — authentication and deployment procedures.
- `tests/` — unit, API and Playwright UI coverage for the public logon, auth pages, keyboard navigation, mobile overflow, owner dashboard, Easy Access, SE38 and SE37.
- Seed data in `prisma/` and `src/lib/` — the 10-topic curriculum and 41 shared objects.
- Live demo: `https://abap-studio.akashgupta.is-a.dev`.
- No customer testimonials, case studies, press coverage, benchmarks or commercial pricing exist; future work must not invent them.

## Product Principles

1. **Practise the real workflow.** Teach the SAP transaction the learner will actually meet, using accurate terminology, screen behaviour and keyboard conventions.
2. **Be honest about the boundary.** Executable, validated and simulated features are labelled as such; never let a polished screen imply a runtime that does not exist.
3. **Private by default, shared by curriculum.** Learner work belongs to its creator; examples are shared and read-only; owner oversight is explicit and server-enforced.
4. **Security is server truth.** Clerk proves identity; the database decides role, ownership and suspension; the browser never grants privilege.
5. **One workbench, two levels of intent.** Trainees need a clear way in and a safe place to experiment; the owner needs fast, trustworthy control over the same environment.

## Accessibility & Inclusion

- Accessibility is an acceptance requirement, not an afterthought: automated axe checks, keyboard navigation and mobile-overflow coverage exist in the Playwright suite.
- Interactive controls must be reachable and operable by keyboard with visible focus, and the workbench and authentication surfaces must remain usable at mobile widths.
- No formal WCAG conformance level has been committed; future work should preserve and extend the automated checks rather than claim a level the project has not verified.
