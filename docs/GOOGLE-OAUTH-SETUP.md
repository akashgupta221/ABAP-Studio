# Production Google OAuth for Clerk

Clerk provides shared Google OAuth credentials for development only. The
production instance must use a Google Cloud OAuth client owned by the project
owner. This is free; Google Cloud does not charge for OAuth credentials.

Do not paste the client secret into chat, a GitHub issue, a commit or a
screenshot. Enter it directly in the Clerk dashboard.

## Values for this deployment

The hostnames below use the **Path A** is-a.dev domain. If the EU.org backup is approved
first, substitute `abap-studio.eu.org` for the application origin and
`clerk.abap-studio.eu.org` for the Clerk Frontend API. Do not create Google credentials
for a domain that is not live yet.

| Field | Value |
|---|---|
| Clerk application | `app_3Ks7MMboysX2gIBJhfURlf16Pwq` |
| Clerk production instance | `ins_3LAf6uu766aoTCwlI8nX5faMFQA` (currently bound to the denied `abap-studio.is-a.dev`; move it or create a new production instance for the final domain) |
| Clerk Frontend API | `https://clerk.abap-studio.akashgupta.is-a.dev` |
| Google authorized redirect URI | `https://clerk.abap-studio.akashgupta.is-a.dev/v1/oauth_callback` |
| Application origin | `https://abap-studio.akashgupta.is-a.dev` |

The redirect URI must match exactly, including the `/v1/oauth_callback` path.
The app origin is not the OAuth callback. The EU.org alternatives are
`https://abap-studio.eu.org` and
`https://clerk.abap-studio.eu.org/v1/oauth_callback`.

## 1. Create the Google Cloud project

1. Sign in at <https://console.cloud.google.com/> with the owner Google account.
2. Create a project named `ABAP Studio`.
3. No billing account is required for basic OAuth. Do not enable paid APIs.

## 2. Configure the OAuth consent screen

Google may label this **Google Auth Platform** or **OAuth consent screen**.

1. Choose **External** user type.
2. App name: `ABAP Studio`.
3. User support email: the owner's email.
4. Developer contact email: the owner's email.
5. Add only these scopes:
   - `openid`
   - `email`
   - `profile`
6. Do not add sensitive or restricted scopes. The app only needs the user's
   verified email address and basic profile.
7. Publish the app to production if Google offers that choice. With only the
   three scopes above, the project should not need sensitive-scope verification.
   If Google requests verification, stop and check that no extra scopes were
   added rather than submitting identity documents.

## 3. Create the OAuth client

1. Open **APIs & Services → Credentials**.
2. Choose **Create credentials → OAuth client ID**.
3. Application type: **Web application**.
4. Name: `ABAP Studio Clerk production`.
5. Authorized JavaScript origins:
   - `https://clerk.abap-studio.akashgupta.is-a.dev`
   - `https://accounts.abap-studio.akashgupta.is-a.dev`
   - Path B alternative: `https://clerk.abap-studio.eu.org` and
     `https://accounts.abap-studio.eu.org`
6. Authorized redirect URIs:
   - `https://clerk.abap-studio.akashgupta.is-a.dev/v1/oauth_callback`
   - Path B alternative: `https://clerk.abap-studio.eu.org/v1/oauth_callback`
7. Create the client.

Google shows the client ID and client secret once. Keep the secret private.

## 4. Install the credentials in Clerk

Use the Clerk dashboard for the **production** instance. The old instance is
`ins_3LAf6uu766aoTCwlI8nX5faMFQA`, but it is bound to the denied
`abap-studio.is-a.dev`; move it to the final domain or open the new production
instance if you create one:

1. Open <https://dashboard.clerk.com/apps/app_3Ks7MMboysX2gIBJhfURlf16Pwq/instances/ins_3LAf6uu766aoTCwlI8nX5faMFQA>
   (or the new instance).
2. Go to **SSO connections → Google**.
3. Enable Google if it is not enabled.
4. Paste the Google client ID and client secret into the production
   credentials fields.
5. Save.

Do not use the development instance for these credentials. Do not reuse the
shared development client.

## 5. Verify

After the Clerk domain DNS is live and the credentials are saved:

```bash
bunx clerk deploy status
```

`oauth.complete` should become `true` and `oauth.configured` should include
`google`. A real Google sign-in is still required in a browser; a configured
status alone is not acceptance evidence.

## Troubleshooting

- `redirect_uri_mismatch`: the Google authorized redirect URI does not exactly
  match the final Clerk callback, either
  `https://clerk.abap-studio.akashgupta.is-a.dev/v1/oauth_callback` (Path A) or
  `https://clerk.abap-studio.eu.org/v1/oauth_callback` (Path B).
- `invalid_client`: the client ID/secret was pasted into the wrong Clerk
  instance or contains whitespace.
- Google blocks the app for unverified branding: check the consent screen app
  name and support email; do not add scopes beyond `openid`, `email`, `profile`.
- Clerk still lists Google as pending: save the credentials in the production
  instance, then re-run `bunx clerk deploy status`.
