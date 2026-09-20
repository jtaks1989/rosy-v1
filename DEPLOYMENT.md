# Rosy AI — deployment notes

## What this application actually is

Rosy AI is **not a static single-page Vite app**. It is a server-rendered
TanStack Start application:

- Pages are server-rendered, so metadata and first paint come from the server.
- All privileged logic runs in server functions (`src/lib/*.functions.ts`) and
  server routes (`src/routes/api/*`), which is exactly why integration keys and
  the service role key never reach the browser.
- `npm run build` produces a **server bundle plus static assets** in `dist/`
  (`dist/server`, `dist/public`, `dist/nitro.json`) — not a plain folder of
  static files.

This matters for hosting: a static-site configuration (output directory `dist`
served as files, plus a catch-all rewrite to `index.html`) would break the app,
because there is no `dist/index.html` to rewrite to and no runtime to execute
the server functions the dashboards depend on.

## Build facts (verified)

| Item | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` (server build + assets, produced by Nitro) |
| Node.js version | 22 |
| Build result | Succeeds — `✓ built`, `Generated dist/nitro.json` |
| Local production preview | `npx vite preview` |

Pin Node 22 by adding to `package.json` if your host reads it:

```json
"engines": { "node": "22.x" }
```

## Hosting options

### 1. Lovable hosting (current, no changes needed)

Publishing from Lovable already builds this app for its server runtime. Routing,
refresh-on-deep-link, API routes and static assets all work with no extra
configuration file — the server owns routing, so there is nothing to rewrite.

### 2. Vercel

Deploy it as a **server application (Node/Fluid runtime)**, not a static site.
The build target is chosen by Nitro at build time:

```
NITRO_PRESET=vercel
```

Set that as a build environment variable in the Vercel project, keep the build
command as `npm run build`, set Node.js to 22, and leave the output setting to
the framework/preset (the preset writes `.vercel/output` itself). Do **not** set
"Output Directory: dist" and do **not** add a `vercel.json` with a
`{"source": "/(.*)", "destination": "/index.html"}` rewrite — either one turns a
server app into a broken static site: deep links return 404 or a blank page, and
every dashboard query fails because the server functions are not running.

No `vercel.json` has been added for that reason. Routing, deep links, refreshes,
API routes (`/api/*`) and hashed static assets are all handled by the server
build for every route.

### Route note

The route list in the deployment request does not match this app. The real
authenticated routes are:

```
/overview  /brief  /actions  /monitoring  /briefing-preferences
/restaurants  /restaurants/$locationId  /sales  /menu  /inventory
/guests  /marketing  /people  /finance  /investor  /rosy-bot
/alerts  /integrations  /settings
```

Public routes: `/`, `/auth`, `/reset-password`. There is no `/dashboard`,
`/leadership`, `/investors`, `/hr`, `/operations` or `/reports`. Nothing was
renamed — renaming would break existing links, saved views and navigation.

## Environment variable checklist

### Browser-visible (publishable only)

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Backend URL for the browser client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) key; row-level security still applies |
| `VITE_SUPABASE_PROJECT_ID` | Project identifier |

### Server-only (must never be prefixed `VITE_`)

| Variable | Purpose | Required |
| --- | --- | --- |
| `SUPABASE_URL` | Server-side backend URL | Yes |
| `SUPABASE_PUBLISHABLE_KEY` | Auth middleware acting as the signed-in user | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged server work; bypasses row-level security | Yes |
| `SUPABASE_PROJECT_ID` | Project identifier | Optional |
| `LOVABLE_API_KEY` | Rosy bot narrative layer; absent = figures only, stated honestly | Optional |
| `LOVABLE_CRON_SECRET` | Verifies scheduled callbacks | Only with scheduled jobs |
| `LOVABLE_CRON_SECRET_PREVIOUS` | Rotation window for the above | Optional |

### Not yet required

Foodics, Grubtech, Supy, Eat App, HR and accounting credentials are **not
referenced anywhere in the codebase yet** — those adapters run on labelled demo
data. When they are connected, each credential must be server-only and read
inside a server function handler.

## Security verification

- **No integration or AI secret is exposed to the browser.** Every
  `import.meta.env` reference in the codebase is in
  `src/integrations/supabase/client.ts`, and it reads only the Supabase URL and
  publishable key. `LOVABLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and the cron
  secrets are read exclusively through `process.env` inside server code.
- **Row-level security is enabled on all 46 tables** in the application schema,
  each with at least one policy: restaurants/locations, orders and order lines,
  products and recipes, inventory and waste, guests and guest contacts,
  employees and restricted documents, investors, commitments, contributions,
  distributions, valuations, published reports, budgets, alerts, actions,
  monitoring rules and briefing data. Access is denied by default and scoped by
  membership, permission and grant through the `is_member`, `has_permission` and
  `has_location_access` helpers.

## Remaining deployment warnings

1. **Not production-ready as a financial system of record.** The dataset is
   clearly labelled demo data. No accounting, bank or settlement source is
   connected, so no figure here is reconciled or finance-approved.
2. **Integrations are unverified.** Foodics, Grubtech, Supy, Eat App and HR run
   on demo adapters pending credentials and read access.
3. **No message delivery.** Email and WhatsApp briefing preferences are stored
   but nothing is sent; only in-app delivery exists.
4. **Five database linter warnings** remain on pre-existing security-definer
   helper functions (used by the row-level security policies). Public and
   anonymous execute rights were revoked; the warnings are not resolved.
5. **One backend, two environments.** Preview and published apps currently share
   the same backend instance. Give production its own project before real
   restaurant, employee or investor data is loaded.
6. **Auth settings to review before launch:** email confirmation, password
   strength/leak protection, and the redirect URL allowlist for the production
   domain.

## Demo accounts (private client demonstration)

Four accounts exist in the clearly labelled demo workspace. They contain no real
personal data, and each is limited by the same database-level grants a
production account would be. Shared password: `RosyDemo2026!`

| Role | Email | Sees |
| --- | --- | --- |
| Leadership | `leadership@rosy-demo.app` | All demo venues |
| Investor | `investor@rosy-demo.app` | Demo Investor A holdings only |
| Marketing | `marketing@rosy-demo.app` | CQ French Brasserie brand only |
| HR / PRO | `hr@rosy-demo.app` | People and renewals |

They are listed in a "Demo access" panel on the sign-in page with one-click
sign-in. Remove that panel and these four accounts before any production use.

The dashboard header shows a `DEMO` badge, a top banner and a footer line
reading "This demonstration uses sample data for illustration purposes."

Rosy bot needs no AI credentials: every figure is computed by fixed backend
queries over the sample data, and when no AI narrative service is configured it
says so and returns the figures only. Suggested demonstration questions are
offered per role on the Rosy bot page.

## Vercel troubleshooting: "Missing Supabase environment variable(s)"

**Symptom:** the build succeeds on Vercel but the browser crashes with
`Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY`.

**Cause:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are inlined
into the browser bundle **at build time**. If they are absent while Vercel runs
`npm run build`, the browser code falls back to the server-only names
(`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`), which do not exist in a browser —
hence the error naming the server variables. The most common reason is that the
variables were added to Vercel **after** the last deployment, or scoped to the
"Preview" environment only while the failing deployment is "Production".

**Fix (no code change required):**

1. Vercel project → Settings → Environment Variables.
2. Confirm all six variables are enabled for **Production** (and Preview):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
   `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_PROJECT_ID`.
3. **Redeploy** (Deployments → ⋯ → Redeploy). Adding or editing a variable
   never affects an existing deployment — a fresh build is required because the
   `VITE_*` values are baked into the bundle at build time.

`vercel.json` now pins `NITRO_PRESET=vercel npm run build` as the build command
so the preset no longer needs to be set as a manual environment variable.

**Browser/server boundary (verified in the production build):**

- The browser bundle contains only the Supabase URL and publishable key
  (inlined `VITE_*` values). A scan of `dist/client` confirms no service-role
  key or other private value is present.
- Server-only variables (`SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, cron
  secrets) are read via `process.env` exclusively inside server functions and
  server routes, never shipped to the browser.
