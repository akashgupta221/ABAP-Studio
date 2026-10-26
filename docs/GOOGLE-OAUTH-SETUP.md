# Production Google OAuth for Clerk

**Status: complete (26.10.2026).** The production Google Cloud OAuth client is installed
in the Clerk production instance. The owner completed a real Google sign-in, and the
Google account linked to the existing Clerk identity as `oauth_google`. The resulting
session returns `AKASH` / `OWNER` with the same private workspace.

Clerk provides shared Google OAuth credentials for development only. The
production instance must use a Google Cloud OAuth client owned by the project
owner. This is free; Google Cloud does not charge for OAuth credentials.

Do not paste the client secret into chat, a GitHub issue, a commit or a
screenshot. Enter it directly in the Clerk dashboard.

## Values for this deployment

The hostnames below use the verified **Path A** is-a.dev domain. EU.org is an unused
backup path; do not create Google credentials for it unless the owner explicitly moves
production.

| Field | Value |
|---|---|
| Clerk application | `app_3Ks7MMboysX2gIBJhfURlf16Pwq` |
| Clerk production instance | `ins_3LAf6uu766aoTCwlI8nX5faMFQA`, bound to `abap-studio.akashgupta.is-a.dev` |
| Clerk Frontend API | `https://clerk.abap-studio.akashgupta.is-a.dev` |
| Google authorized redirect URI | `https://clerk.abap-studio.akashgupta.is-a.dev/v1/oauth_callback` |
| Application origin | `https://abap-studio.akashgupta.is-a.dev` |

The redirect URI must match exactly, including the `/v1/oauth_callback` path.
The app origin is not the OAuth callback. Do not add the EU.org alternatives unless the
production domain actually moves.

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
6. Authorized redirect URIs:
   - `https://clerk.abap-studio.akashgupta.is-a.dev/v1/oauth_callback`
7. Create the client.

Google shows the client ID and client secret once. Keep the secret private.

## 4. Install the credentials in Clerk

Use the Clerk dashboard for the **production** instance
`ins_3LAf6uu766aoTCwlI8nX5faMFQA`, which is bound to
`abap-studio.akashgupta.is-a.dev`:

1. Open <https://dashboard.clerk.com/apps/app_3Ks7MMboysX2gIBJhfURlf16Pwq/instances/ins_3LAf6uu766aoTCwlI8nX5faMFQA>.
2. Go to **SSO connections → Google**.
3. Enable Google if it is not enabled.
4. Paste the Google client ID and client secret into the production
   credentials fields.
5. Save.

Do not use the development instance for these credentials. Do not reuse the
shared development client.

## 5. Verify

The Clerk production config reports Google `enabled: true`, `authenticatable: true`, and
both the client id and secret present. The owner completed a real Google sign-in in
production on 26.10.2026. Clerk linked `oauth_google` to the existing verified-email
identity, and `/api/auth/me` returned `AKASH` / `OWNER`.

For a future credential rotation, repeat the browser check; a configured status alone is
not acceptance evidence.

## Troubleshooting

- `redirect_uri_mismatch`: the Google authorized redirect URI does not exactly
  match `https://clerk.abap-studio.akashgupta.is-a.dev/v1/oauth_callback`.
- `invalid_client`: the client ID/secret was pasted into the wrong Clerk
  instance or contains whitespace.
- Google blocks the app for unverified branding: check the consent screen app
  name and support email; do not add scopes beyond `openid`, `email`, `profile`.
- Clerk does not offer Google: confirm the connection is enabled and the client
  credentials are saved in the correct production instance, then reload the sign-in page.
