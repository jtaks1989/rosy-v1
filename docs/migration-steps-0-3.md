# Steps 0–3 execution record (2026-09-09)

Additive and reversible only. No table, column, record, function, trigger or RLS
policy that existed before this run was dropped, renamed or narrowed.

## Migration IDs (in order)

| Step | Migration file |
| --- | --- |
| 0 — backup of all tables | `20260909085517_18387b27-32c7-4f28-8d13-ebff817d6c69.sql` |
| 1 — workspaces / environment | `20260909085555_409f19ba-9666-477d-aa70-b604a7faf448.sql` |
| 2 — integration registry | `20260909085712_90a02650-bfe6-4162-930c-3c796889b2e4.sql` |
| 3 — external-ID crosswalk | `20260909085750_0e85d95f-f091-4e13-b650-edb0114497db.sql` |
| 2b — provider aliases | `20260909085826_e8cc80b6-814e-4e6e-b23d-c2b18065e8a9.sql` |
| 3b — registry read policies aligned | `20260909090453_6f1c9bd0-fd7b-4811-92e0-b883c56903a6.sql` |

## Step 0 — backup

Schema `audit_backup`: one `<table>_20260909` copy of each of the 45 public base
tables, plus `audit_backup.backup_manifest` (source table, backup table, row
count, date). `USAGE` granted to `service_role` only; `anon` and `authenticated`
have no access, and the schema is not exposed through the Data API (verified: a
restricted role gets `permission denied for schema audit_backup`).

## Row counts

All 45 pre-existing tables: **identical before and after** (verified by diff of
full `count(*)` snapshots). Total ≈ 49,300 rows.

Key values: `canonical_orders` 7,544 · `order_lines` 15,080 ·
`payment_entries` 14,792 · `order_source_links` 9,238 · `reservations` 1,560 ·
`integrations` 12 · `locations` 5 · `memberships` 5 · `role_permissions` 53.

New objects after migration:

| Table | Rows |
| --- | --- |
| `workspaces` | 1 (Rosy Hospitality — Demo, environment `demo`) |
| `integration_providers` | 12 |
| `integration_connections` | 12 (one per existing `integrations` row) |
| `integration_venue_mappings` | 0 (source table is empty) |
| `integration_entity_mappings` | 9,238 (backfilled from `order_source_links`) |
| `integration_sync_jobs` / `_runs` / `_errors` / `_webhook_events` / `_dead_letter_events` / `_rate_limits` / `_cursors` | 0 |

Backfill completeness: `organizations`, `brands`, `legal_entities`, `locations`,
`memberships` each have **0** rows with a null `workspace_id`.

## Unchanged dashboard totals

| Measure | Before | After |
| --- | --- | --- |
| Revenue-counting net sales | 1,570,659.30 | 1,570,659.30 |
| Revenue-counting orders | 7,398 | 7,398 |
| Covers | 8,550 | 8,550 |
| Stock value | 339,988.00 | 339,988.00 |

`rosy_sales_summary` for leadership returns net_sales 1,570,611.00 / 7,398
orders / 8,550 covers (net of 48.30 refunds) — same as before the run.

## Role tests (live tokens, database-enforced)

| Role | Venues | Sales summary | Investor holdings | Registry | Backend-only tables |
| --- | --- | --- | --- | --- | --- |
| Leadership | 5 of 5 | full | none | 12 connections, 9,238 crosswalk rows | denied |
| Investor | 0 | 0 (blocked) | own commitment only | registry visible, no financial leak | denied |
| Marketing | 3 (CQ brand) | 0 (blocked) | none | visible | denied |
| HR / PRO | 5 | 0 (blocked) | none | visible | denied |

`integration_webhook_events`, `integration_dead_letter_events`,
`integration_rate_limits`, `integration_cursors` return nothing for every role
(RLS on, no policies, no `authenticated` grant) — by design, service role only.
`integration_errors` is restricted to `manage_integrations`.
`integration_upsert_mapping` is `EXECUTE`-revoked from `anon`/`authenticated`.

## Browser verification

`/overview`, `/sales`, `/menu`, `/finance`, `/people`, `/investor`,
`/marketing`, `/integrations` all render authenticated with no failing requests
and no console errors. Demo banner, DEMO label, outlet counter and Foodics-style
per-outlet EOD sections unchanged.

## Rollback instructions

Each step is independently reversible; run in reverse order as service role.

```sql
-- reverse 3b + 3
DROP FUNCTION IF EXISTS public.integration_upsert_mapping(uuid,text,text,text,text,uuid,uuid,text,boolean,text,text);
DROP TABLE IF EXISTS public.integration_entity_mappings;

-- reverse 2b + 2
DROP TABLE IF EXISTS public.integration_cursors, public.integration_rate_limits,
  public.integration_dead_letter_events, public.integration_webhook_events,
  public.integration_errors, public.integration_sync_runs,
  public.integration_sync_jobs, public.integration_venue_mappings,
  public.integration_connections, public.integration_providers;
DROP TYPE IF EXISTS public.sync_run_status;
DROP TYPE IF EXISTS public.integration_health;

-- reverse 1
ALTER TABLE public.memberships    DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE public.locations      DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE public.legal_entities DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE public.brands         DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE public.organizations  DROP COLUMN IF EXISTS workspace_id, DROP COLUMN IF EXISTS environment;
DROP TABLE IF EXISTS public.workspaces;
DROP TYPE IF EXISTS public.workspace_environment;

-- data restore of any pre-existing table, if ever needed
-- INSERT INTO public.<table> SELECT * FROM audit_backup.<table>_20260909
--   ON CONFLICT DO NOTHING;  -- (or TRUNCATE + INSERT under maintenance)

-- reverse 0 (only when backups are no longer wanted)
-- DROP SCHEMA audit_backup CASCADE;
```

Because steps 1–3 only add objects and nullable columns, reversing any of them
leaves the current dashboard code path working untouched.

## Warnings

1. Six pre-existing "signed-in users can execute SECURITY DEFINER function"
   advisories remain. They are the intentional reporting RPCs
   (`rosy_*`, `has_permission`, `is_member`) that must run as definer to enforce
   scoping; `anon` execution is already revoked. Not introduced by this run.
2. Four "RLS enabled, no policy" notices are the deliberately backend-only
   ingestion tables (webhook events, dead letters, rate limits, cursors). Locked
   by design.
3. `external_entity_mappings` was empty, so `integration_venue_mappings` has no
   rows yet; venue mapping will be populated when adapters are configured.
4. Two existing integration rows used alternative provider spellings
   (`eat_app`, `hr_provider`); step 2b added an alias list rather than editing
   the original rows.
5. Preview and the external Vercel deployment share one backend project, so both
   see these additive changes. No browser variable, route, query or component was
   changed, so Vercel needs no redeploy for parity.
6. No live external system was connected. All 12 registry connections are
   `environment = demo`, `credentials_saved = false`, and hold no secret values.

## Backup count reconciliation (2026-09-09, after the fact)

The audit document said "46 tables in `public`"; the first completion report said
44 were backed up. Both numbers were wrong. Verified counts:

- `public` base tables before Steps 1–3: **45**
- Objects in `audit_backup`: **46** = 45 dated table copies + `backup_manifest`
- Live `public` base tables now: **57** = 45 pre-existing + 12 new
  (`workspaces` and 11 `integration_*` tables)

Tables present in `public` with **no** backup copy — exactly 12, all created by
Steps 1–3 and therefore not part of the pre-migration state:

`workspaces`, `integration_providers`, `integration_connections`,
`integration_venue_mappings`, `integration_entity_mappings`,
`integration_sync_jobs`, `integration_sync_runs`, `integration_errors`,
`integration_webhook_events`, `integration_dead_letter_events`,
`integration_rate_limits`, `integration_cursors`.

Excluded by design and unchanged by these migrations: the managed `auth`,
`storage`, `realtime`, `supabase_functions` and `vault` schemas.

Verification query result: **0** pre-existing public tables lack a backup. Every
table holding business, authentication-linked profile, permission, configuration
or demo data — `organizations`, `workspaces`' source tenancy tables, `profiles`,
`memberships`, `scope_grants`, `role_permissions`, `metric_definitions`,
`integrations`, all canonical sales / inventory / guest / HR / investor / finance
tables, alerts, chat, briefings, actions and monitoring — has a dated copy.
The "46" figure in `docs/backend-audit.md` was an over-count of one and the "44"
in this record was an under-count of one; both are corrected to 45 here.

## External deployment parity (rosyai.vercel.app vs rosy-insight-core.lovable.app)

Both point at the same shared demo backend. All integrations remain in demo
status; no live API calls, webhooks or schedules were attempted, and API
availability was not part of this check.

Result before the fix: **Vercel failed.** Sign-in succeeded and pages rendered,
but every server-function response carried
`Missing Supabase environment variable(s): SUPABASE_URL`, so no venue, sales or
inventory figure loaded (Overview showed `AED 0`, `0 of 0` outlets, and role
scoping could not be observed because no role saw any data). Lovable passed:
Leadership Overview showed net sales `1,570,611.00` (the `1,570,659.30`
revenue-counting figure less the `48.30` refund adjustment the RPC applies) and
`7,398` orders.

Cause: the generated server-side modules read `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY`; those names are not resolving in the Vercel server
runtime, where only the `VITE_*` public values are reaching the function.

Fix (source, `src/start.ts`): a server-side environment normaliser runs at
startup and on every request, mirroring `VITE_SUPABASE_URL` →`SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` → `SUPABASE_PUBLISHABLE_KEY` when the server
names are absent. Both are public values. `SUPABASE_SERVICE_ROLE_KEY` is never
mirrored or defaulted — verified against the built server bundle: with only the
`VITE_*` values present the two public names resolve and the service-role name
stays undefined.

`NITRO_PRESET=vercel npm run build` succeeds with only the `VITE_*` values set.
The parity numbers on Vercel must be re-read after Vercel rebuilds this commit.
