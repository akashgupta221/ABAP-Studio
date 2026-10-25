# Free production domain for Clerk

Clerk production requires a domain with DNS records that we control. A
`*.vercel.app` hostname cannot be used for the production Clerk domain. This
document records the zero-cost domain paths, the current blockers and the exact
owner actions.

The production Clerk instance was created for `abap-studio.is-a.dev`:

- Instance: `ins_3LAf6uu766aoTCwlI8nX5faMFQA`
- Status: `domain_pending`
- The `abap-studio.is-a.dev` domain was **denied** and is not registered
- The instance therefore must be moved to the final domain, or replaced with a
  new production instance, before any production keys are added

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
- The owner opened the root PR as
  [is-a.dev PR #58327](https://github.com/is-a-dev/register/pull/58327), but it is
  **not ready**: it contains `domains/domains/akashgupta.json` instead of
  `domains/akashgupta.json`, still includes the denied
  `domains/abap-studio.json`, and its description removed the required template
  comments. The `Tests` and `Template` checks fail. Follow the correction steps
  in §A2 before waiting for review. Do not close and reopen the PR; update it.
- The is-a.dev terms prohibit AI-created pull requests. The owner must make the
  correction and submit/review the PR; this assistant does not edit the fork or
  the PR.
- The EU.org request for `abap-studio.eu.org` was submitted on 25.10.2026 and
  is still awaiting human approval. No nameserver delegation is live:
  `dig NS abap-studio.eu.org` and `dig SOA abap-studio.eu.org` return no
  records, so Cloudflare remains pending.
- **The first fully verified domain wins.** Do not add production Clerk keys,
  create the webhook or switch the Clerk production domain until DNS, SSL and
  mail are verified for that domain. Do not switch domains after production
  users start signing in without a planned cutover.

Production remains **blocked**. No production Clerk key, `OWNER_EMAIL`,
`CLERK_WEBHOOK_SECRET` or Google production credential is configured, and no
production Clerk session has been exercised.

## Verified facts

| Check | Result |
|---|---|
| `https://akashgupta221.github.io/` | `200`; title “Akash Gupta — Developer”; 6 project cards; Lighthouse 100 accessibility / 100 best practices / 100 SEO |
| `https://abap-studio.is-a.dev` | `302` to `https://is-a.dev/available?d=abap-studio` |
| is-a.dev PR #58254 | closed, `status: denied`, `reason: not dev related`; no domain registered |
| is-a.dev issue #58258 | closed 25.10.2026 09:29 UTC; maintainer says root is for portfolios and suggests a nested subdomain |
| `dig NS abap-studio.eu.org` | no records |
| `dig SOA abap-studio.eu.org` | no records |
| Clerk production instance | `domain_pending`; bound to the dead `abap-studio.is-a.dev` |
| Production Vercel env | has `OWNER_USERNAME`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_SECRET`; missing `OWNER_EMAIL`, Clerk production keys and `CLERK_WEBHOOK_SECRET` |
| Production Google OAuth | enabled in Clerk with empty production credentials |

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

### Correcting PR #58327 (current state)

The PR currently fails because of three independent mistakes:

1. The portfolio file is at `domains/domains/akashgupta.json`. It must be at
   `domains/akashgupta.json`. The nested directory makes the tests try to read a
   directory as JSON and makes `domains/akashgupta.json` missing.
2. The old `domains/abap-studio.json` is still in the branch. That root was
   denied and must not be part of this PR.
3. The PR description replaced the repository template and removed the HTML
   comments. The template check requires the original comments and the exact
   `<!-- TOS -->`, `<!-- DOMAIN_STRUCTURE -->` … markers around checked boxes.

The cleanest fix is to reset the fork's `main` to upstream and add only the one
correct file. This rewrites only the owner's fork branch; the open PR updates
automatically. Do not close and reopen the PR.

```bash
git clone https://github.com/akashgupta221/register.git
cd register
git remote add upstream https://github.com/is-a-dev/register.git
git fetch upstream
git checkout main
git reset --hard upstream/main
mkdir -p domains
cp "/Volumes/drive-E/Abap Editor/is-a-dev-akashgupta/akashgupta.json" domains/akashgupta.json
git add domains/akashgupta.json
git commit -m "Add akashgupta.is-a.dev"
git push --force-with-lease origin main
```

If a force push is not acceptable, use the GitHub web UI instead:

1. Delete `domains/domains/akashgupta.json`.
2. Delete `domains/abap-studio.json`.
3. Create `domains/akashgupta.json` with the JSON above.
4. Commit the changes to the fork's `main` branch.

Then repair the PR description:

1. Open <https://github.com/is-a-dev/register/pull/58327>.
2. Click **Edit** next to the title/body.
3. Select the entire body and replace it with the full contents of
   `/Volumes/drive-E/Abap Editor/is-a-dev-akashgupta/PR-BODY.md` (or the
   template in this document). Keep all HTML comments and markers.
4. Click **Update comment**. The `edited` event re-runs the template check.

The corrected PR must show exactly one added file:

```text
domains/akashgupta.json
```

Wait for the checks. Do not comment, ping maintainers or open a replacement PR.
The `reason: incomplete pr` label should clear when the template passes; the
`domain` label and code-owner review are normal.

The corrected one-file tree and the corrected PR body were tested locally
against the is-a.dev repository: all 13 tests passed and
`util/check-pr-template.cjs` reported `PR template validation passed`.

### A3. Register the nested app and Clerk records — after the root merge

After `akashgupta.is-a.dev` is merged, create these files in the same fork and
submit **one** pull request. The application is the nested domain itself; there
is no extra `app.` label.

| File | Hostname | Record |
|---|---|---|
| `domains/abap-studio.akashgupta.json` | `abap-studio.akashgupta.is-a.dev` | `CNAME` → `cname.vercel-dns.com` |
| `domains/clerk.abap-studio.akashgupta.json` | `clerk.abap-studio.akashgupta.is-a.dev` | `CNAME` → `frontend-api.clerk.services` |
| `domains/accounts.abap-studio.akashgupta.json` | `accounts.abap-studio.akashgupta.is-a.dev` | `CNAME` → `accounts.clerk.services` |
| `domains/clkmail.abap-studio.akashgupta.json` | `clkmail.abap-studio.akashgupta.is-a.dev` | `CNAME` → `mail.vedhnrhsrdju.clerk.services` |
| `domains/clk._domainkey.abap-studio.akashgupta.json` | `clk._domainkey.abap-studio.akashgupta.is-a.dev` | `CNAME` → `dkim1.vedhnrhsrdju.clerk.services` |
| `domains/clk2._domainkey.abap-studio.akashgupta.json` | `clk2._domainkey.abap-studio.akashgupta.is-a.dev` | `CNAME` → `dkim2.vedhnrhsrdju.clerk.services` |

The Clerk targets above are the current values for instance
`ins_3LAf6uu766aoTCwlI8nX5faMFQA`. Re-check them in the Clerk dashboard before
submitting; a new production instance can have different targets.

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
Register ABAP Studio and Clerk records under akashgupta.is-a.dev
```

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
4. The existing production instance is bound to the dead
   `abap-studio.is-a.dev`. Change its domain or create a new production
   instance **before** adding keys. Do not run the interactive creation wizard
   again for `abap-studio.is-a.dev`.
5. Keep `abap-studio.is-a.dev` unregistered. The portfolio root is
   `akashgupta.is-a.dev`; the app is nested under it.

## After DNS is live

1. Add the chosen application hostname to the `abap-studio-rd9d` Vercel project
   and verify its certificate:
   - Path A: `abap-studio.akashgupta.is-a.dev`
   - Path B: `abap-studio.eu.org`
2. Move/create the Clerk production instance for that hostname. Confirm its
   five CNAME targets in the Clerk dashboard; do not reuse stale targets.
3. Add the production Clerk keys, `CLERK_WEBHOOK_SECRET`, `OWNER_EMAIL`,
   `AUTH_SECRET` and the fallback flags to Vercel production.
4. Create the Clerk webhook:
   - Path A: `https://abap-studio.akashgupta.is-a.dev/api/webhooks/clerk`
   - Path B: `https://abap-studio.eu.org/api/webhooks/clerk`
5. Configure the production Google OAuth client with the matching redirect URI:
   - Path A: `https://clerk.abap-studio.akashgupta.is-a.dev/v1/oauth_callback`
   - Path B: `https://clerk.abap-studio.eu.org/v1/oauth_callback`
6. Set Clerk paths to `/sign-in`, `/sign-up`, `/` and `/`.
7. Complete the checks in `docs/CLERK-SETUP.md` before merging or accepting P1.

## Owner action checklist

- [x] Publish the portfolio at <https://akashgupta221.github.io/> (verified).
- [ ] Fix open root PR #58327: move the file to `domains/akashgupta.json`,
      remove `domains/abap-studio.json`, restore the full template, then wait
      for checks.
- [ ] After the root merges, submit the nested app/Clerk PR.
- [ ] Monitor the EU.org contact inbox (non-Gmail) and the Cloudflare zone.
- [ ] Choose the first fully verified domain.
- [ ] Move/create the Clerk production instance for that domain.
- [ ] Add production keys, webhook, `OWNER_EMAIL` and Google OAuth.
- [ ] Complete the production verification checklist and only then accept P1.
