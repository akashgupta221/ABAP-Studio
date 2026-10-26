# Free production domain for Clerk

Clerk production requires a domain with DNS records that we control. A
`*.vercel.app` hostname cannot be used for the production Clerk domain. This
document records the zero-cost domain paths, the current blockers and the exact
owner actions.

The production Clerk instance was moved to the verified is-a.dev path:

- Instance: `ins_3LAf6uu766aoTCwlI8nX5faMFQA`
- Status: **complete** — domain/DNS/mail/SSL all complete
- Application origin: `https://abap-studio.akashgupta.is-a.dev`
- Clerk Frontend API: `https://clerk.abap-studio.akashgupta.is-a.dev`
- The original `abap-studio.is-a.dev` root was **denied** and is not registered; it is
  not used by the app

No production key, webhook secret, password or OTP belongs in this document or
in Git.

## Current status — 25.10.2026

- The root registration `abap-studio.is-a.dev` is dead. The is-a.dev PR #58254
  was denied as `not dev related`; appeal issue #58258 was **closed** on
  25.10.2026 at 09:29 UTC.
- Maintainer `linuskang` closed the appeal with:

  > Nope. Still doesn't count as dev-related, as we typically only allow
  > portfolios on root subdomains.
  >
  > Create a nested subdomain if you want to add this.

- A nested subdomain needs an owned root. The owner approved a new parallel
  is-a.dev path:
  - **Portfolio root:** `akashgupta.is-a.dev`
  - **Nested application:** `abap-studio.akashgupta.is-a.dev`
  - **Clerk hostnames:** `clerk.`, `accounts.`, `clkmail.`,
    `clk._domainkey.` and `clk2._domainkey.` under
    `abap-studio.akashgupta.is-a.dev`
- The portfolio is published at <https://akashgupta221.github.io/> and is
  reachable. It is a completed, responsive developer portfolio with public
  project links, including ABAP Studio. The root is-a.dev record will redirect
  to it.
- The owner fixed the root PR
  [is-a.dev PR #58327](https://github.com/is-a-dev/register/pull/58327). It
  changed exactly one file, `domains/akashgupta.json` (9 additions), with no
  blank placeholder files and no nested `domains/domains` directory. All checks
  passed and the PR was **merged** on 25.10.2026 at 13:01 UTC. The root is live:
  `https://akashgupta.is-a.dev` returns `301` to
  `https://akashgupta221.github.io/`, which returns `200`.
- The is-a.dev reviewbot sends a generic GitHub Pages message after every merge.
  It does **not** apply to this root: `akashgupta.json` uses a `URL` record, not
  a GitHub Pages CNAME. Do not add `akashgupta.is-a.dev` as a GitHub Pages custom
  domain; the root redirect already works.
- The six nested records for the app and Clerk were prepared in
  `is-a-dev-akashgupta/nested/domains/` and passed the local is-a.dev test suite
  (13/13) and the PR template check. The owner submitted them as
  [is-a.dev PR #58363](https://github.com/is-a-dev/register/pull/58363). It was
  **merged** on 25.10.2026 at 17:52 UTC (merge commit
  `bb86038f7e5004fd36e55f43b41fed286a69c707`); all checks passed. The six
  nested DNS records now resolve through Cloudflare DNS. The Clerk production
  instance has been moved and its Frontend API and account portal are live over
  TLS. The app hostname still fails the TLS handshake until Vercel verifies the
  owner-submitted `_vercel` TXT/CNAME and issues the certificate.
- The is-a.dev terms prohibit AI-created pull requests. The owner made the root
  fix; this assistant did not edit the fork or the PR.
- The EU.org request for `abap-studio.eu.org` was submitted on 25.10.2026 and
  is still awaiting human approval. No nameserver delegation is live:
  `dig NS abap-studio.eu.org` and `dig SOA abap-studio.eu.org` return no
  records, so Cloudflare remains pending.
- **The first fully verified domain wins.** Do not add production Clerk keys,
  create the webhook or switch the Clerk production domain until DNS, SSL and
  mail are verified for that domain. Do not switch domains after production
  users start signing in without a planned cutover.

Production is **live and P1 is accepted** on this domain. The six nested records are live;
the Clerk production instance serves its Frontend API and account portal on the new
hostname. is-a.dev PR #58410 was merged; Vercel reports `configured-correctly`, and the app
returns HTTP `200` at `https://abap-studio.akashgupta.is-a.dev`. The merged `main` build
(`e3df40c`) is deployed; `/sign-in`, `/sign-up` and `/api/health` report the expected
configuration. Clerk keys, `OWNER_EMAIL`, webhook secret and both legacy flags (`off`) are
set in Vercel. [PR #58415](https://github.com/is-a-dev/register/pull/58415) merged on
25.10.2026 at 20:07 UTC; the three Clerk mail/DKIM CNAMEs point at the current
`nefqx6afwufx` tenant, and Clerk reports domain/DNS/mail/SSL complete. Production owner
Email OTP and Google sign-in, non-owner isolation, administration, signed webhook delivery
and legacy retirement are verified. EU.org is not required.

Vercel required this ownership verification:

| Type | Name | Value |
|---|---|---|
| CNAME | `abap-studio` | `e65413aa6d37f6f6.vercel-dns-017.com` |
| TXT | `_vercel` | `vc-domain-verify=abap-studio.akashgupta.is-a.dev,7c86e8bdcf66173704fd` |

The TXT record is at `_vercel.akashgupta.is-a.dev`, not under `abap-studio`.
The owner submitted [PR #58410](https://github.com/is-a-dev/register/pull/58410), which changed
exactly two files: the new TXT file and the updated CNAME. It was **merged** on
25.10.2026 at 18:42 UTC (merge commit `5950e202c6134f95ba69bfe2fe5287c98fd61a8c`).
The TXT/CNAME records are live and `vercel domains verify` reports
`configured-correctly` / `verified` for `abap-studio-rd9d`.

## Verified facts

| Check | Result |
|---|---|
| `https://akashgupta221.github.io/` | `200`; title “Akash Gupta — Developer”; 6 project cards; Lighthouse 100 accessibility / 100 best practices / 100 SEO |
| `https://akashgupta.is-a.dev` | `301` to `https://akashgupta221.github.io/`; final response `200` |
| is-a.dev PR #58327 | merged 25.10.2026 13:01 UTC; one file, 9 additions; all checks passed |
| Nested app/Clerk records | [PR #58363](https://github.com/is-a-dev/register/pull/58363) merged 25.10.2026 17:52 UTC; merge commit `bb86038f7e5004fd36e55f43b41fed286a69c707`; all checks passed |
| Nested PR local validation | fresh is-a.dev clone + six files -> 13/13 tests; template check passed |
| Six nested hostnames | all resolve via Cloudflare DNS; Clerk Frontend API and account portal are live over TLS; Vercel app hostname verified |
| `https://abap-studio.akashgupta.is-a.dev` | HTTP `200` via Vercel; valid certificate; merged `main` build; `/sign-in` and `/sign-up` return `200` |
| `https://clerk.abap-studio.akashgupta.is-a.dev/v1/environment` | HTTP `200`; production instance; Email OTP + Google; password/phone/username disabled |
| `https://accounts.abap-studio.akashgupta.is-a.dev` | Valid TLS certificate; Cloudflare browser challenge to curl (expected); production Clerk sign-in verified through the app |
| Vercel verification | [PR #58410](https://github.com/is-a-dev/register/pull/58410) merged 25.10.2026 18:42 UTC; TXT/CNAME live; `vercel domains verify` says `configured-correctly`; project `abap-studio-rd9d` verified |
| Production P1 config | `/api/health` reports `clerkConfigured: true`, `legacyAuthMode: "off"`, webhook secret present, 1 user, 50 programs; unsigned webhook request returns `400` |
| Production sign-in | Owner Email OTP and Google verified; `/admin` loads; non-owner isolation, suspend/reactivate/force-logout/delete and webhook delivery verified |
| `https://abap-studio.is-a.dev` | `302` to `https://is-a.dev/available?d=abap-studio` |
| is-a.dev PR #58254 | closed, `status: denied`, `reason: not dev related`; no domain registered |
| is-a.dev issue #58258 | closed 25.10.2026 09:29 UTC; maintainer says root is for portfolios and suggests a nested subdomain |
| `dig NS abap-studio.eu.org` | no records |
| `dig SOA abap-studio.eu.org` | no records |
| Clerk production instance | Moved to `abap-studio.akashgupta.is-a.dev` (Secondary application); Frontend API live; account portal has a valid certificate and a Cloudflare challenge |
| Production Vercel env | has `OWNER_EMAIL`, production Clerk publishable/secret keys, `CLERK_WEBHOOK_SECRET`, Turso credentials, `AUTH_SECRET` (dormant); both legacy flags are `off` |
| Production Google OAuth | configured with a production Google Cloud client; owner Google sign-in verified and linked as `oauth_google` |

## Why the first is-a.dev root was denied

The root PR preview opened the SAP-style logon screen, which requires an
account. It did not show the ABAP editor, so the reviewer did not see a
software-development website. The root record was also a redirect to the GitHub
repository, not a portfolio.

The new root is deliberately **a portfolio**, not the application. The app is a
nested subdomain. Do not describe the root as an ABAP course or as the login
page. Do not point the root preview at the Vercel app.

## Denied appeal record

The owner posted the following text in issue #58258. It is retained for history.
The issue is closed; do not post it again or open another root PR for
`abap-studio.is-a.dev`.

```markdown
### Your subdomain

abap-studio.is-a.dev

### The issue

I would like to appeal the denial of PR #58254:
https://github.com/is-a-dev/register/pull/58254

The preview URL opened the application's SAP-style logon screen, which requires
an account. It did not show the actual tool, so I understand why it looked
unrelated to software development.

ABAP Studio is an open-source software project and a browser-based ABAP
development environment. It includes a TypeScript tokenizer, parser and
interpreter for ABAP, an SE38-style editor with syntax checking, a data
dictionary, class builder, function builder and ALV output. The source,
architecture and feature documentation are public:
https://github.com/akashgupta221/ABAP-Studio

The root domain record is a public redirect to that repository, not to the
login-gated application. The project also ships sample ABAP programs for
learning, but its primary purpose is a developer workbench.

Would you reconsider the PR using the public GitHub repository as the preview?
If the root registration still does not meet the policy, I will respect the
decision and use another provider.

Thank you.
```

The maintainer's final response is quoted in the status section above. The
appeal did not change the root policy.

## Path A — is-a.dev portfolio root + nested application

### A1. Portfolio site — published

The portfolio is live at:

- **URL:** <https://akashgupta221.github.io/>
- **Repository:** <https://github.com/akashgupta221/akashgupta221.github.io>
- **Source:** `index.html`, `styles.css` and `favicon.svg`, served directly by
  GitHub Pages from `main`; no build step or environment variables

It is a genuine portfolio: it introduces the owner, links to public projects
(ABAP Studio, Sprint, Currency Converter, Pac-Man, Spotify Clone and Pseudocode
Basics), lists the tools used, and links back to GitHub. All external links were
checked and returned `200`.

Before submitting the root PR:

1. Open <https://akashgupta221.github.io/> and confirm it loads without a
   placeholder.
2. Do not add a password, login wall or under-construction page.
3. Keep the ABAP Studio live-app link on the portfolio; that is a project link,
   not the root preview.

### A2. Register the portfolio root — owner submits manually

Fork <https://github.com/is-a-dev/register> from `akashgupta221` and create
`domains/akashgupta.json`:

```json
{
  "description": "Akash Gupta - developer portfolio",
  "owner": {
    "username": "akashgupta221"
  },
  "records": {
    "URL": "https://akashgupta221.github.io/"
  }
}
```

Commit the file and open a pull request titled:

```text
Register akashgupta.is-a.dev
```

Use the repository's pull-request template exactly. Keep the template comments;
check every requirement box and fill the two marked sections:

```markdown
# Website Preview

<!-- WEBSITE_PREVIEW_START -->
https://akashgupta221.github.io/
<!-- WEBSITE_PREVIEW_END -->

# Website Purpose

<!-- WEBSITE_PURPOSE_START -->
Personal developer portfolio for Akash Gupta. It showcases public software
projects and experiments, including ABAP Studio, a browser-based ABAP
development tool. The root domain is a public redirect to this portfolio.
<!-- WEBSITE_PURPOSE_END -->
```

Important:

- The root purpose is the **portfolio**. Do not submit the app as the root
  purpose and do not use the login-gated app as the preview.
- The root must be merged before any nested `akashgupta.is-a.dev` record is
  submitted.
- Do not submit a second `abap-studio.is-a.dev` root PR. That name is closed.
- Do not automate or bulk-submit the PR. The is-a.dev terms prohibit AI-created
  pull requests; the owner must review and submit it.

If the maintainer asks for a different root name, use the same portfolio and
change only the JSON filename/domain. Do not reopen the old appeal.

### PR #58327 is merged

The root PR changed exactly one file:

```text
domains/akashgupta.json
```

It contained 9 additions and no blank placeholder files, no nested
`domains/domains` directory and no denied `abap-studio.json`. The PR template was
restored.

Final checks for head
`55db8a1c78e7495cc097584562bd61387f279479`:

| Check | Result |
|---|---|
| `PR / Template` | success |
| `CI / Tests` | success |
| `PR / Label` | success |
| `Filter out AI-generated PRs` | success |

The PR was merged on 25.10.2026 at 13:01 UTC. The root is live:
`https://akashgupta.is-a.dev` returns `301` to
`https://akashgupta221.github.io/`, which returns `200`.

The reviewbot's GitHub Pages instructions are generic. Do **not** add
`akashgupta.is-a.dev` as a GitHub Pages custom domain; the root JSON uses a
`URL` record and the redirect already works.

The one-file tree and the restored template were also verified locally against
the is-a.dev repository: all 13 tests passed and
`util/check-pr-template.cjs` reported `PR template validation passed`.

### A3. Register the nested app and Clerk records — merged, DNS live

`akashgupta.is-a.dev` is merged and live. The owner submitted the six nested
files as [PR #58363](https://github.com/is-a-dev/register/pull/58363). It was
**merged** on 25.10.2026 at 17:52 UTC (merge commit
`bb86038f7e5004fd36e55f43b41fed286a69c707`); all four checks passed. The six
hostnames now resolve. The Clerk production instance has been moved and its
Frontend API/account portal are live. Vercel verification and the app certificate are
complete. The earlier Clerk mail/DKIM mismatch was fixed by
[PR #58415](https://github.com/is-a-dev/register/pull/58415), which merged on 25.10.2026 at
20:07 UTC. All five Clerk CNAMEs are verified and Clerk reports the domain, DNS, mail and
SSL as `complete`, so Email OTP delivery is unblocked.

The files and matching PR body are in `is-a-dev-akashgupta/nested/`; the local
is-a.dev suite passed 13/13 and the template check passed. Do not comment or
ping maintainers about any PR.

| File | Hostname | Record |
|---|---|---|
| `domains/abap-studio.akashgupta.json` | `abap-studio.akashgupta.is-a.dev` | `CNAME` → `e65413aa6d37f6f6.vercel-dns-017.com` |
| `domains/clerk.abap-studio.akashgupta.json` | `clerk.abap-studio.akashgupta.is-a.dev` | `CNAME` → `frontend-api.clerk.services` |
| `domains/accounts.abap-studio.akashgupta.json` | `accounts.abap-studio.akashgupta.is-a.dev` | `CNAME` → `accounts.clerk.services` |
| `domains/clkmail.abap-studio.akashgupta.json` | `clkmail.abap-studio.akashgupta.is-a.dev` | `CNAME` → `mail.nefqx6afwufx.clerk.services` |
| `domains/clk._domainkey.abap-studio.akashgupta.json` | `clk._domainkey.abap-studio.akashgupta.is-a.dev` | `CNAME` → `dkim1.nefqx6afwufx.clerk.services` |
| `domains/clk2._domainkey.abap-studio.akashgupta.json` | `clk2._domainkey.abap-studio.akashgupta.is-a.dev` | `CNAME` → `dkim2.nefqx6afwufx.clerk.services` |

The Clerk mail/DKIM targets above are the values now verified for production instance
`ins_3LAf6uu766aoTCwlI8nX5faMFQA`. Do not reuse the old `vedhnrhsrdju` values. Confirm the
values in the Clerk dashboard before changing DNS because a replacement instance can have
different targets.

Example JSON for the application domain:

```json
{
  "description": "ABAP Studio application",
  "owner": {
    "username": "akashgupta221"
  },
  "records": {
    "CNAME": "cname.vercel-dns.com"
  }
}
```

Example JSON for the Clerk Frontend API:

```json
{
  "description": "ABAP Studio Clerk Frontend API",
  "owner": {
    "username": "akashgupta221"
  },
  "records": {
    "CNAME": "frontend-api.clerk.services"
  }
}
```

Use the same shape for the other four records. Suggested PR title:

```text
Register ABAP Studio nested domains
```

The PR was submitted as
[#58363](https://github.com/is-a-dev/register/pull/58363) and showed exactly six
added files. The submission commands and compare link remain in
`is-a-dev-akashgupta/nested/README.md` for reference.

The nested preview is `https://abap-studio-rd9d.vercel.app/`. It opens on the
SAP-style logon screen; the PR purpose explains that registration opens the SE38
workbench. The root is the approved portfolio, so the software-related root
requirement is already satisfied.

If Vercel asks for a `_vercel` TXT record after the application domain is added,
add it as a separate nested file using the exact name and value shown by Vercel.

After the records are published, verify:

```bash
dig +short abap-studio.akashgupta.is-a.dev CNAME
dig +short clerk.abap-studio.akashgupta.is-a.dev CNAME
dig +short accounts.abap-studio.akashgupta.is-a.dev CNAME
dig +short clkmail.abap-studio.akashgupta.is-a.dev CNAME
dig +short clk._domainkey.abap-studio.akashgupta.is-a.dev CNAME
dig +short clk2._domainkey.abap-studio.akashgupta.is-a.dev CNAME
```

Then point the Clerk production instance at `abap-studio.akashgupta.is-a.dev`
(change the domain if Clerk permits it, otherwise create a new production
instance) and run:

```bash
bunx clerk deploy status --wait
```

Do not add production Clerk keys to Vercel until the domain reports `dns`,
`ssl` and `mail` as verified.

### A4. Values for Path A

| Item | Value |
|---|---|
| Application origin | `https://abap-studio.akashgupta.is-a.dev` |
| Vercel domain | `abap-studio.akashgupta.is-a.dev` |
| Clerk Frontend API | `https://clerk.abap-studio.akashgupta.is-a.dev` |
| Clerk Accounts portal | `https://accounts.abap-studio.akashgupta.is-a.dev` |
| Webhook | `https://abap-studio.akashgupta.is-a.dev/api/webhooks/clerk` |
| Google OAuth redirect URI | `https://clerk.abap-studio.akashgupta.is-a.dev/v1/oauth_callback` |

## Path B — EU.org

EU.org has provided free domain delegations since 1996. It is slower but more
durable than a volunteer subdomain service. A direct `abap-studio.eu.org`
registration is possible; EU.org only delegates nameservers for direct
registrations, so Cloudflare's free DNS can host the records.

> **Status (25.10.2026):** the owner submitted the `abap-studio.eu.org` request.
> It is awaiting human approval. `dig NS abap-studio.eu.org` and
> `dig SOA abap-studio.eu.org` currently return no delegation. The Cloudflare
> zone will remain **Pending Nameserver Update** until EU.org publishes the
> delegation. Do not add production Clerk keys or switch the Clerk domain yet.

> **Do not use a Gmail address for the EU.org contact.** EU.org warns that
> Gmail refuses its validation messages as spam. Use a non-Gmail mailbox you
> control long-term (Outlook, Proton Mail, iCloud, a university address, etc.).
> A disposable mailbox is not suitable because EU.org approval and domain
> management depend on that address.

1. Create a free Cloudflare account at <https://dash.cloudflare.com/sign-up>.
   Choose **Add a site**, enter `abap-studio.eu.org`, and select the **Free**
   plan. Cloudflare will show two assigned nameservers (for example
   `ada.ns.cloudflare.com` and `bob.ns.cloudflare.com`). Keep this zone open;
   it will remain **Pending Nameserver Update** until EU.org delegates it.
2. Create an EU.org contact at
   <https://nic.eu.org/arf/en/contact/create/>. Use your real name and postal
   address, the **non-Gmail** address, and a strong unique password. Select
   **Private** if you do not want your contact details published in WHOIS.
   Accept the domain policy and submit. EU.org will show a handle such as
   `AK1234-FREE` and send a validation email. Save the handle and validate the
   address.
3. Log in at <https://nic.eu.org/arf/en/> with the handle and password. Click
   **New Domain**, enter `abap-studio.eu.org`, and complete the owner/contact
   fields with the same handle.
4. In the nameserver section, choose **server names** (not the option that
   checks whether the servers are already reachable) and enter the two
   Cloudflare nameservers exactly as shown in the Cloudflare dashboard. Submit
   the request.
5. Wait for human approval. EU.org says a few days, but real-world reports range
   from days to several months; do not depend on it for an immediate cutover.
   Check the non-Gmail inbox and spam folder. A second identical request that
   reports “request already exists” means the first one is still pending.
6. After approval, confirm the Cloudflare zone becomes **Active**. Then create
   the application and Clerk CNAME records listed below, plus any Vercel
   verification TXT record.
7. Run `bunx clerk deploy status --wait` only after the records resolve.

### Path B DNS layout

| Hostname | Purpose | Record |
|---|---|---|
| `abap-studio.eu.org` | ABAP Studio application | `CNAME` → `cname.vercel-dns.com` |
| `clerk.abap-studio.eu.org` | Clerk Frontend API | `CNAME` → `frontend-api.clerk.services` |
| `accounts.abap-studio.eu.org` | Clerk Accounts portal | `CNAME` → `accounts.clerk.services` |
| `clkmail.abap-studio.eu.org` | Clerk email | `CNAME` → `mail.vedhnrhsrdju.clerk.services` |
| `clk._domainkey.abap-studio.eu.org` | Clerk DKIM | `CNAME` → `dkim1.vedhnrhsrdju.clerk.services` |
| `clk2._domainkey.abap-studio.eu.org` | Clerk DKIM | `CNAME` → `dkim2.vedhnrhsrdju.clerk.services` |

### Path B values

| Item | Value |
|---|---|
| Application origin | `https://abap-studio.eu.org` |
| Vercel domain | `abap-studio.eu.org` |
| Clerk Frontend API | `https://clerk.abap-studio.eu.org` |
| Clerk Accounts portal | `https://accounts.abap-studio.eu.org` |
| Webhook | `https://abap-studio.eu.org/api/webhooks/clerk` |
| Google OAuth redirect URI | `https://clerk.abap-studio.eu.org/v1/oauth_callback` |

EU.org remains a parallel path, not an automatic fallback. If it is approved,
confirm the Cloudflare zone and DNS first; then decide whether to move the
Clerk production instance or create a new one. Do not add keys to two live
production instances without a cutover plan.

## Choosing the final domain

1. **First fully verified domain wins.** A domain is ready only when its
   application CNAME resolves, Vercel has issued the certificate, and Clerk
   reports `dns`, `ssl` and `mail` verified.
2. If both become ready before any production users sign in, ask the owner to
   choose. `abap-studio.eu.org` is shorter and cleaner; the nested
   `abap-studio.akashgupta.is-a.dev` is the faster is-a.dev path.
3. Once production users sign in, do not switch domains without a planned
   identity migration. Clerk identities, webhook URLs and OAuth redirect URIs
   are tied to the chosen host.
4. The production instance has been moved to
   `abap-studio.akashgupta.is-a.dev` as a Secondary application. Do not run
   the interactive creation wizard again for `abap-studio.is-a.dev`.
5. Keep `abap-studio.is-a.dev` unregistered. The portfolio root is
   `akashgupta.is-a.dev`; the app is nested under it.

## After DNS is live

1. Add the chosen application hostname to the `abap-studio-rd9d` Vercel project
   and verify its certificate:
   - Path A: `abap-studio.akashgupta.is-a.dev` (current)
   - Path B: `abap-studio.eu.org`
   The Vercel **team-level** CLI command may return `domain_not_owned`; add the
   domain from the project's **Settings → Domains** page instead. If Vercel
   shows a `_vercel` TXT challenge, submit that TXT record through a separate
   is-a.dev PR manually before expecting the certificate.
2. Move/create the Clerk production instance for that hostname. For the nested
   is-a.dev app, choose **Secondary application** because Clerk lives under
   `clerk.abap-studio.akashgupta.is-a.dev`. Confirm its five CNAME targets in the
   Clerk dashboard; do not reuse stale targets. DNS is already live for the six
   current records, but Clerk may issue different mail/DKIM targets after the
   move.
3. Add the production Clerk keys, `CLERK_WEBHOOK_SECRET`, `OWNER_EMAIL`,
   `AUTH_SECRET` (dormant) and both legacy flags (`off`) to Vercel production.
4. Create the Clerk webhook:
   - Path A: `https://abap-studio.akashgupta.is-a.dev/api/webhooks/clerk`
   - Path B: `https://abap-studio.eu.org/api/webhooks/clerk`
5. Configure the production Google OAuth client with the matching redirect URI:
   - Path A: `https://clerk.abap-studio.akashgupta.is-a.dev/v1/oauth_callback`
   - Path B: `https://clerk.abap-studio.eu.org/v1/oauth_callback`
6. Set Clerk paths to `/sign-in`, `/sign-up`, `/` and `/`.
7. Complete the production regression checks in `docs/CLERK-SETUP.md` before switching
   domains. P1 is already accepted on the is-a.dev path; do not move unless the owner
   explicitly decides to replace it.

## Owner action checklist

- [x] Publish the portfolio at <https://akashgupta221.github.io/> (verified).
- [x] Fix and merge root PR #58327 (verified: one file, all checks passed,
      merged 25.10.2026; `https://akashgupta.is-a.dev` redirects to the portfolio
      and returns `200`).
- [x] Submit the prepared nested app/Clerk PR. It was
      [PR #58363](https://github.com/is-a-dev/register/pull/58363): six files,
      54 additions; all checks passed; merged 25.10.2026 at 17:52 UTC.
- [x] Confirm the six nested hostnames resolve through DNS.
- [x] In the **abap-studio-rd9d** Vercel project, add
      `abap-studio.akashgupta.is-a.dev` as a custom domain. Vercel requires
      ownership verification because the hostname was previously linked to
      another Vercel account.
- [x] Submit the follow-up is-a.dev PR for the Vercel TXT/CNAME:
      [PR #58410](https://github.com/is-a-dev/register/pull/58410). It changed
      exactly two files, all checks passed, and it was merged 25.10.2026 at
      18:42 UTC.
- [x] Verify the Vercel domain and certificate. `vercel domains verify` reports
      `configured-correctly`; the app returns HTTP `200` at the new hostname.
- [x] Move the Clerk production instance to
      `https://abap-studio.akashgupta.is-a.dev`, choosing **Secondary
      application**. The Frontend API is live, returns the correct Email OTP +
      Google configuration, and the account portal has a valid certificate.
- [x] Set the production Clerk keys, `OWNER_EMAIL`, `CLERK_WEBHOOK_SECRET` and both
      legacy flags to `off` in Vercel.
- [x] Merge and deploy the P1 build (`main`, `e3df40c`) to the custom domain.
      `/sign-in`, `/sign-up` and `/api/health` report the expected configuration.
- [x] Complete the production owner Email OTP sign-in, `/admin` and non-owner
      isolation checks.
- [x] Configure production Google OAuth and verify the owner Google flow.
- [x] Send/observe a real signed Clerk webhook event and confirm acceptance.
- [x] Confirm Clerk reports domain/DNS/mail/SSL complete.
- [x] Verify the Standard ABAP `MER / 105` screen after P1.
- [x] Accept P1 after the production verification checklist passed.
- [ ] Optional: monitor the EU.org contact inbox; EU.org is not needed for production.
