# Free production domain for Clerk

Clerk production requires a domain with DNS records that we control. A
`*.vercel.app` hostname cannot be used for the production Clerk domain. This
document records the two zero-cost paths under consideration.

The production Clerk instance has already been created for
`abap-studio.is-a.dev`:

- Instance: `ins_3LAf6uu766aoTCwlI8nX5faMFQA`
- Clerk Frontend API: `https://clerk.abap-studio.is-a.dev`
- Clerk Accounts portal: `https://accounts.abap-studio.is-a.dev`
- Status: `domain_pending` — all DNS and email DNS records are still missing

No production key, webhook secret, password or OTP belongs in this document or
in Git.

## Current status — is-a.dev root PR denied

On 25.10.2026 the owner submitted the root registration as
[is-a.dev PR #58254](https://github.com/is-a-dev/register/pull/58254). The PR
template was corrected and all CI checks passed, but maintainer `linuskang`
closed the PR with `status: denied` and `reason: not dev related`:

> is-a.dev subdomains are only for **software development** related websites
> (portfolios, projects, dev tools, etc.). Your website doesn't appear to meet
> this requirement...

The domain was **not registered**:

- `abap-studio.is-a.dev` still redirects to the is-a.dev availability page.
- No `app` / Clerk / DKIM DNS record exists.
- The production Clerk instance remains `domain_pending`.
- No production Clerk key has been added to Vercel.

The likely cause is that the PR preview opened the SAP-style logon screen
(`https://abap-studio-rd9d.vercel.app`), which requires an account and does not
show the ABAP editor. The root record is a **public redirect to the GitHub
repository**, not the login-gated app. The project also includes sample
programs for learning ABAP, which can read as a course even though the product
is a developer workbench.

The owner's next actions are:

1. Post the appeal below from the `akashgupta221` GitHub account. Do not submit
   a second root PR while the appeal is open.
2. Start the EU.org backup with a **non-Gmail** contact address, because EU.org
   explicitly warns that Gmail rejects its validation mail.

## Appeal text for is-a.dev

Create an issue at
<https://github.com/is-a-dev/register/issues/new?template=support.md> and use
the following as a starting point. Edit it into your own words; do not claim
anything that is not true.

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

If a maintainer asks for a new PR, use the public repository or a public
project page as the Website Preview, and describe the project as an open-source
ABAP IDE/dev tool. Do not point the preview only at the SAP logon screen.

## Recommended: is-a.dev

`is-a.dev` is a free subdomain service for software projects. It supports the
CNAME records Clerk needs. The planned layout is:

| Hostname | Purpose | Record |
|---|---|---|
| `abap-studio.is-a.dev` | Public project redirect | `URL` → GitHub repository |
| `app.abap-studio.is-a.dev` | ABAP-Studio application | `CNAME` → Vercel |
| `clerk.abap-studio.is-a.dev` | Clerk Frontend API | `CNAME` → `frontend-api.clerk.services` |
| `accounts.abap-studio.is-a.dev` | Clerk Accounts portal | `CNAME` → `accounts.clerk.services` |
| `clkmail.abap-studio.is-a.dev` | Clerk email | `CNAME` → `mail.vedhnrhsrdju.clerk.services` |
| `clk._domainkey.abap-studio.is-a.dev` | Clerk DKIM | `CNAME` → `dkim1.vedhnrhsrdju.clerk.services` |
| `clk2._domainkey.abap-studio.is-a.dev` | Clerk DKIM | `CNAME` → `dkim2.vedhnrhsrdju.clerk.services` |

The root redirect keeps the root hostname public; the authenticated application
is on the nested `app` hostname.

### Important is-a.dev rules

- The root subdomain must be submitted first. Nested subdomains are only
  accepted after the root is owned.
- The service is volunteer-run and is not a permanent registrar. It can revoke
  a subdomain at any time.
- The is-a.dev terms explicitly prohibit AI-created pull requests and
  login-gated **root** hostnames. **Do not submit these files automatically.**
  The owner must review and submit the pull requests from the
  `akashgupta221` GitHub account. This document only prepares the content.

### Step 1 — register the root subdomain

Fork <https://github.com/is-a-dev/register>, create
`domains/abap-studio.json` with:

```json
{
  "description": "ABAP Studio - open-source SAP ABAP workbench",
  "owner": {
    "username": "akashgupta221"
  },
  "records": {
    "URL": "https://github.com/akashgupta221/ABAP-Studio"
  }
}
```

Commit it, open a pull request titled `Register abap-studio.is-a.dev`, and wait
for the maintainers to merge it. Check the pull request for requested changes.

### Step 2 — add the application and Clerk records

After the root pull request is merged, create these files in the same fork and
submit one pull request. Each file is a separate is-a.dev domain record.

`domains/app.abap-studio.json`:

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

`domains/clerk.abap-studio.json`:

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

`domains/accounts.abap-studio.json`:

```json
{
  "description": "ABAP Studio Clerk accounts",
  "owner": {
    "username": "akashgupta221"
  },
  "records": {
    "CNAME": "accounts.clerk.services"
  }
}
```

`domains/clkmail.abap-studio.json`:

```json
{
  "description": "ABAP Studio Clerk mail",
  "owner": {
    "username": "akashgupta221"
  },
  "records": {
    "CNAME": "mail.vedhnrhsrdju.clerk.services"
  }
}
```

`domains/clk._domainkey.abap-studio.json`:

```json
{
  "description": "ABAP Studio Clerk DKIM 1",
  "owner": {
    "username": "akashgupta221"
  },
  "records": {
    "CNAME": "dkim1.vedhnrhsrdju.clerk.services"
  }
}
```

`domains/clk2._domainkey.abap-studio.json`:

```json
{
  "description": "ABAP Studio Clerk DKIM 2",
  "owner": {
    "username": "akashgupta221"
  },
  "records": {
    "CNAME": "dkim2.vedhnrhsrdju.clerk.services"
  }
}
```

If Vercel asks for a `_vercel` TXT record after the application domain is
added, add it as a separate nested file using the exact name and value shown by
Vercel.

### Step 3 — verify DNS

After the records are published:

```bash
dig +short clerk.abap-studio.is-a.dev CNAME
dig +short accounts.abap-studio.is-a.dev CNAME
dig +short clkmail.abap-studio.is-a.dev CNAME
dig +short clk._domainkey.abap-studio.is-a.dev CNAME
dig +short clk2._domainkey.abap-studio.is-a.dev CNAME
```

Then run:

```bash
bunx clerk deploy status --wait
```

Do not add production Clerk keys to Vercel until the domain reports `dns`,
`ssl` and `mail` as verified.

## Backup: EU.org

EU.org has provided free domain delegations since 1996. It is slower but more
durable than a volunteer subdomain service. A direct `abap-studio.eu.org`
registration is possible; EU.org only delegates nameservers for direct
registrations, so Cloudflare's free DNS can host the records.

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
   the same application and Clerk CNAME records listed above, plus any Vercel
   verification TXT record.
7. Run `bunx clerk deploy status --wait` only after the records resolve.

EU.org should remain a backup until the is-a.dev path is either verified or
exhausted. The existing Clerk production instance is configured for
`abap-studio.is-a.dev`; switching to `abap-studio.eu.org` is not automatic and
may require a Clerk production-domain change or a new production instance. Do
not add production keys or switch the domain after users have started signing
in without a planned cutover.

## After DNS is live

1. Add `app.abap-studio.is-a.dev` to the `abap-studio-rd9d` Vercel project and
   verify its certificate.
2. Add the production Clerk keys, `CLERK_WEBHOOK_SECRET`, `OWNER_EMAIL`,
   `AUTH_SECRET` and the fallback flags to Vercel production.
3. Create the Clerk webhook at
   `https://app.abap-studio.is-a.dev/api/webhooks/clerk`.
4. Configure the production Google OAuth client with the redirect URI
   `https://clerk.abap-studio.is-a.dev/v1/oauth_callback`.
5. Set Clerk paths to `/sign-in`, `/sign-up`, `/` and `/`.
6. Complete the checks in `docs/CLERK-SETUP.md` before merging or accepting P1.
