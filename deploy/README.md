# deploy/ — one paste per host

Three templates, one per hosting target. Copy the file, fill in every
`REPLACE-ME`, paste into the host's bulk env import, **redeploy**.

| File | Host | Import at |
|---|---|---|
| `vercel-web.env.example` | Vercel · octa-web | Settings → Environment Variables → Import .env |
| `vercel-console.env.example` | Vercel · octa-console | same |
| `render-api.env.example` | Render · octa-api | Environment → Add from .env |

A filled-in copy saved as `deploy/*.env` (no `.example`) is gitignored.

## Where the secrets come from

Supabase dashboard, project `lqvkqdaqtkhxmnvodmyr`:

- **Project URL** and **anon key** — Project Settings → API Keys
- **service-role key** — same page. API only. Never a `VITE_*` variable:
  Vite inlines those into the browser bundle.
- **JWT secret** — Project Settings → API → JWT Settings
- **DATABASE_URL** — Connect → **Transaction pooler**, port **6543**

Generate the rest yourself:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Order matters

1. **Supabase schema first.** `db-push-supabase.mjs --reset` **drops the public
   schema**. Run it before anything else, or it deletes what came after. Re-run
   `--check` immediately beforehand.
2. Content: `sync-content` → `sync-items` → `sync-assessments`.
3. **Then** `node scripts/bootstrap-admin.mjs` — with `OCTA_ADMIN_*` exported,
   it needs no arguments.
4. Vercel env vars → redeploy **both** apps.
5. Render `CORS_ALLOWED_ORIGINS` → both Vercel origins, no trailing slashes.
6. Console: Settings → Deployment Protection → **Disabled**, and hand people the
   production domain, not a `octa-console-<hash>-<team>.vercel.app` preview URL.

## The admin defaults are not secrets

```
OCTA_ADMIN_EMAIL=admin@octa.local
OCTA_ADMIN_PASSWORD=OctaTemp-2026-change-me
```

They are committed here and printed to a terminal, so treat them as already
seen. They are safe only because they cannot survive first contact:

- `bootstrap-admin.mjs` stamps `app_metadata.must_change_credentials`.
- The console blocks on a change screen while that flag is set
  (`apps/console/src/lib/session.ts`).
- `POST /console/account/credentials` changes **email and password together**
  and clears the flag in the same Admin API call — never one without the other.
- That route **refuses either default**, case-insensitively for the email. Length
  was no defence on its own: `OctaTemp-2026-change-me` is 23 characters and
  passed a `min(12)` check, which would have let an admin submit the published
  defaults straight back and clear the flag saying they had been dealt with.

So the first thing the instructor does on a fresh deployment is replace both.

## Why the current deployment cannot sign anyone in

Measured 23 Sep 2026 against `octa-web-beige.vercel.app`:

- **No Supabase values in the build.** `session.ts` returns a null client, and
  the form answers *"Sign-in is not configured on this build. Ask your
  instructor."* with no network request at all.
- **`VITE_API_URL` is an empty string**, which is not the same as unset:
  `VITE_API_URL ?? "http://localhost:8090"` only falls back on nullish, so the
  bundle carries neither a host nor the fallback. Every `/api/v1` path resolves
  against the Vercel origin, where `vercel.json`'s SPA catch-all returns
  `index.html` — `GET /api/v1/stages` is **HTTP 200, `text/html`**.

Both are fixed by pasting the templates and redeploying.
