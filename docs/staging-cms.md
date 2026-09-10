# Staging CMS setup

This repository contains the current static site and a local Directus/PostgreSQL staging stack. The stack is for internal testing only; it does not contain production credentials or customer documents.

## 1. Start Directus and PostgreSQL

Install Docker Desktop, then from the repository root:

```powershell
Copy-Item .env.example .env
# Edit .env and replace every replace-with-* value.
docker compose -f docker-compose.staging.yml up -d
```

Open `http://localhost:8055` and sign in with `DIRECTUS_ADMIN_EMAIL` and `DIRECTUS_ADMIN_PASSWORD`.

To stop the stack without deleting data:

```powershell
docker compose -f docker-compose.staging.yml down
```

To remove local test data as well:

```powershell
docker compose -f docker-compose.staging.yml down -v
```

Never commit `.env`, production credentials, or customer files.

## 2. Google account login

1. Sign in to https://console.cloud.google.com/ with a company Google account and create a project (e.g. "Lumens Manual Staging").
2. Under APIs & Services > OAuth consent screen, set **User Type = Internal**. This is what restricts sign-in to `@lumens.com.tw` accounts only — an external Google account cannot authenticate at all. If "Internal" is not offered, the account/project is not recognized as part of the Workspace org; involve the Workspace admin or fall back to an "External" app plus a domain check.
3. Fill in the basic app info (name, support email) and save.
4. Under Credentials > Create Credentials > OAuth client ID, choose **Web application**, and add this authorized redirect URI (use the real staging hostname instead of `localhost` for a shared server):
   ```text
   http://localhost:8055/auth/login/google/callback
   ```
5. Copy the generated Client ID and Client Secret into `.env` as `AUTH_GOOGLE_CLIENT_ID` / `AUTH_GOOGLE_CLIENT_SECRET`, and set `AUTH_PROVIDERS=google`.

Keep `AUTH_GOOGLE_ALLOW_PUBLIC_REGISTRATION=false`. New SSO logins still need a Directus role to have any permissions — run `tools/setup-directus-qa.js` first (it creates and prints the id of the "TS Q&A Editor" role) and set that id as `AUTH_GOOGLE_DEFAULT_ROLE_ID` so first-time company logins are automatically provisioned into it instead of a no-permission account.

## 3. Initial Directus collections

Create these collections in Directus before migrating content:

- `qa_items`: `id`, `status`, `sort`, `category`, `question_en`, `question_zh_cn`, `question_zh_tw`, `answer_en`, `answer_zh_cn`, `answer_zh_tw`
- `products`: existing product metadata plus `audiences`
- `manuals`: product relation, document type, language, title, status, file, updated date
- `product_categories`
- `manual_types`

Use Directus status values `draft`, `in_review`, and `published`. Public API permissions must allow read access only to `published` records. Staff write permissions should be role-based.

## 4. Test sequence

1. Log in with a Google Workspace test account.
2. Confirm the account receives only its assigned Directus role.
3. Create a draft Q&A in all three languages.
4. Confirm the public API cannot read the draft.
5. Publish it and confirm the frontend can read it.
6. Upload a test PDF to local Directus storage.
7. Edit and delete the test record.
8. Verify the activity log records the editor and timestamp.
9. Repeat with a second editor to test concurrent updates.
10. Only after acceptance, configure Azure Blob Storage and a staging hostname.

## 5. Production gate

Do not connect the public company domain, production database, production Blob container, or customer documents until the staging checklist passes. The current GitHub Pages site remains the test fallback during this migration.
