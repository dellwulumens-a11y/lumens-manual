# Deploying Directus to Zeabur

This replaces the local-only `docker-compose.staging.yml` stack with a
publicly reachable one, so the site can eventually read Directus by default
instead of only when a developer enables `?cms=directus` on their own
machine. Do this once staging testing has passed.

## 1. Create the project on Zeabur

1. In the Zeabur dashboard, create a new project.
2. Add a **PostgreSQL** service from the marketplace (one click). Note the
   connection variables Zeabur generates for it.
3. Add a service **from this GitHub repo**, pointing it at the `directus/`
   directory so Zeabur builds `directus/Dockerfile` (this bakes in
   `directus/extensions/restrict-email-domain` — the official Directus
   template in Zeabur's marketplace does *not* include it, so don't use that
   template directly).
4. On the Directus service, add a **Volume** mounted at `/directus/uploads`
   (persistent file storage for uploaded manuals/PDFs — this replaces the
   `directus-uploads` named volume from the local docker-compose file).

## 2. Environment variables

Set these on the Directus service. **Do not reuse the values from the local
`.env` file** — those are throwaway local-dev secrets (literally named
`local-staging-*-change-before-sharing`). Generate new random values for
`DIRECTUS_KEY`, `DIRECTUS_SECRET`, `POSTGRES_PASSWORD` and
`DIRECTUS_ADMIN_PASSWORD` for this deployment.

| Variable | Value |
|---|---|
| `KEY`, `SECRET` | new random strings |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | new admin login for this deployment |
| `DB_CLIENT` | `pg` |
| `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` | from the Zeabur PostgreSQL service's connection variables |
| `PUBLIC_URL` | the custom domain set up in step 3, e.g. `https://cms.lumens.com.tw` |
| `CORS_ENABLED` | `true` |
| `CORS_ORIGIN` | the real site origin, e.g. `https://dellwulumens-a11y.github.io` (add the GitHub Pages custom domain too if/when one is set up) |
| `WEBSOCKETS_ENABLED` | `true` |
| `AUTH_PROVIDERS` | `google` |
| `AUTH_GOOGLE_DRIVER` | `openid` |
| `AUTH_GOOGLE_CLIENT_ID`, `AUTH_GOOGLE_CLIENT_SECRET` | same values as local `.env` (same Google OAuth client — see step 4) |
| `AUTH_GOOGLE_ISSUER_URL` | `https://accounts.google.com` |
| `AUTH_GOOGLE_IDENTIFIER_KEY` | `email` |
| `AUTH_GOOGLE_ALLOW_PUBLIC_REGISTRATION` | `true` |
| `AUTH_GOOGLE_DEFAULT_ROLE_ID` | same value as local `.env` |
| `AUTH_GOOGLE_SCOPE` | `openid profile email` |
| `ALLOWED_EMAIL_DOMAINS` | `lumens.com.tw` |
| `ALLOWED_EMAILS` | any exceptions, same as local `.env` |

## 3. Custom domain

In the Zeabur service settings, add a custom domain (e.g.
`cms.lumens.com.tw`) — Zeabur issues the TLS certificate automatically. Point
the domain's DNS at Zeabur per their instructions. Update `PUBLIC_URL` above
to match once the domain is live.

## 4. Update the Google OAuth client

In Google Cloud Console → the `Lumens Manual Staging` project → **Clients**,
open the existing OAuth client and add a new **Authorized redirect URI**:

```
https://cms.lumens.com.tw/auth/login/google/callback
```

(keep the existing `http://localhost:8055/...` one too, for local dev). The
app is still in "Testing" publish status, so also add every staff email that
needs to log in to **Audience → Test users** — or move the app to
**Production** publish status once ready, so any `@lumens.com.tw` Google
account can sign in without being pre-added (this may show Google's "unverified
app" warning until the app passes verification, which is fine for an
internal tool).

## 5. Point the setup/migration scripts at the new instance

The scripts under `tools/` (`setup-directus-qa.js`, `setup-directus-content.js`,
`migrate-content-to-directus.js`) default to `http://127.0.0.1:8055` but can
target the new deployment instead via environment variables, without editing
the local `.env`:

```powershell
$env:DIRECTUS_URL = "https://cms.lumens.com.tw"
$env:DIRECTUS_ADMIN_EMAIL = "the new ADMIN_EMAIL from step 2"
$env:DIRECTUS_ADMIN_PASSWORD = "the new ADMIN_PASSWORD from step 2"
node tools/setup-directus-qa.js
node tools/setup-directus-content.js
node tools/migrate-content-to-directus.js
```

Run them in that order. `migrate-content-to-directus.js` re-uploads all 256
manual files (~575MB), so this will take a while and only needs to run once
against a fresh deployment (it's idempotent — safe to re-run later if new
files are added locally, existing manuals are skipped, not re-uploaded).

## 6. Point the frontend at it

In `assets/js/data.js`, update the `DIRECTUS_URL` constant from
`http://localhost:8055` to the real domain (e.g. `https://cms.lumens.com.tw`).
This alone does **not** switch production behavior — reads still default to
the static JSON files until `?cms=directus` is enabled — but it means the
toggle now works for *any* visitor (a colleague, a phone, a different
computer), not just on the developer's own machine. That unblocks broader
testing without needing a tunnel tool.

## 7. Going further: making Directus the default

Only after the full staging checklist in `docs/staging-cms.md` passes should
`getCategories`/`getTypes`/`getManualsIndex`/`getQa` in `data.js` be changed
to default to Directus instead of requiring the `cms=directus` opt-in — and
even then, keep a static-JSON fallback path for a while as a safety net
during the cutover.
