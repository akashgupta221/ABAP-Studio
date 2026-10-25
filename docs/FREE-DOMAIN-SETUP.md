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

1. Create a free Cloudflare account and add `abap-studio.eu.org` as a zone.
   Cloudflare will show two nameservers before the delegation exists.
2. Create an EU.org account at <https://nic.eu.org/arf/en/contact/create/> and
   request `abap-studio.eu.org` with the Cloudflare nameservers.
3. Wait for the email approving the delegation. This can take days or weeks.
4. In Cloudflare, create the same application and Clerk CNAME records listed
   above, plus any Vercel verification TXT record.
5. Run `bunx clerk deploy status --wait` again.

EU.org should remain a backup until the is-a.dev path is either verified or
rejected. Switching Clerk to a different domain later requires a domain change
and a new set of production keys; do not switch after users have started signing
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
