# Rosy AI — existing backend audit (Sep 2026)

Audit only. No schema changed in this pass.

## 1. What exists today

46 tables in `public`, all with RLS enabled and at least one policy. 20 database
functions (5 `security definer` scope/permission helpers, 12 `rosy_*` reporting
RPCs, 1 timestamp trigger fn, plus investor helpers). 3 `updated_at` triggers.

### Tenancy & access (reusable, keep as-is)
| Table | Rows | Verdict |
|---|---|---|
| organizations | 1 | Keep. Needs `environment` (demo/sandbox/production) + `workspace` concept. |
| brands | 3 | Keep. |
| locations | 5 | Keep = canonical Venue. Already has timezone, `business_day_cutoff`, currency, brand, legal entity. |
| legal_entities | 3 | Keep. |
| memberships, scope_grants, role_permissions | 5/5/53 | Keep. Org+brand+entity+location+investor scoping already enforced in DB via `has_location_access`, `has_permission`, `is_member`. |
| profiles | 5 | Keep. |
| audit_events | 3 | Keep, under-used — only 3 rows; no login/export/reconciliation entries. |

### Canonical-ish operational data (reusable, needs lineage columns)
| Table | Rows | Gap |
|---|---|---|
| canonical_orders | 7,544 | Has `authoritative_source`, `counts_in_revenue`, `reconciliation_status`, `business_date`. Missing: brand_id, connection_id, source created/updated timestamps, ingestion timestamp, currency, minor-unit money, sync_run_id, data-quality status. |
| order_lines | 15,080 | Missing modifiers, tax/charge split, currency, lineage. |
| payment_entries | 14,792 | Missing tender taxonomy (card/cash/third-party derived by `ILIKE` inside `rosy_eod_by_location` — should be a dimension column), fees/commission. |
| order_source_links | 9,238 | This is the de-facto crosswalk for orders only. Should be generalised. |
| products / recipe_versions / ingredients | 36/36/18 | Keep. No modifiers, no categories table, no supplier/PO/GRN/stock-movement tables. |
| stock_snapshots / waste_entries | 322/382 | Snapshot-only. No movements, transfers, theoretical-vs-actual. |
| reservations / guest_profiles / guest_contacts | 1560/60/60 | Keep. No `visits` entity; reservation→order match lives on `reservations.matched_order_id`. |
| employees / restricted_documents / renewal_tasks | 24/96/11 | Keep. No shifts, attendance, leave, payroll summary. |
| investors / capital_commitments / contribution_entries / distribution_entries / valuations / published_reports | small | Keep. No share_classes table (share class is a text column). |
| budgets, alerts, rosy_actions, action_comments, monitoring_rules(+events), briefing_preferences(+snapshots), chat_sessions/messages, saved_views, metric_definitions, data_quality_issues | small | Keep. |

### Integration surface (main weakness)
- `integrations` (12 rows) is a single flat table doing provider + connection +
  venue mapping + health + cursor hints. No sync jobs, runs, webhook events,
  errors, dead letters, rate limits, or cursors.
- `external_entity_mappings` exists but is **empty (0 rows)** and only maps to
  `location_id` — not a general provider+connection+entity_type+external_id crosswalk.
- No raw payload retention anywhere. Nothing to replay or re-normalise from.
- No staging layer: demo data was written straight into the canonical tables.

## 2. Technical debt / duplication found
1. Two ID-mapping mechanisms: `order_source_links` (orders) and `external_entity_mappings` (venues only). Should collapse into one crosswalk.
2. Payment tender bucketing (`cash`/`card`/`third party`/`gift`/`house`) is computed with `ILIKE` string matching inside `rosy_eod_by_location`. Fragile; belongs in a dimension.
3. `integrations` mixes provider catalogue, connection state and venue mapping.
4. Money stored as `numeric` without a per-row currency on order/line/payment rows (currency lives on `locations` only). Blocks multi-country consolidation.
5. Reporting logic is duplicated between SQL RPCs and TypeScript (`rosy.functions.ts`, `brief.functions.ts`); `metric_definitions` (12 rows) is descriptive only — nothing enforces that a component uses it.
6. `rosy_*` RPCs other than `rosy_eod_by_location` are `stable` but not `security definer` and do **not** re-check `has_permission`/`has_location_access`; they rely on RLS of the underlying tables. Acceptable today, inconsistent tomorrow.
7. No `environment` flag: demo rows are indistinguishable from future production rows.
8. `audit_events` not written by most privileged paths.

## 3. Dashboard/query surface that any change must not break
Routes reading the backend: `/overview`, `/brief`, `/sales`, `/menu`, `/inventory`,
`/guests`, `/marketing`, `/people`, `/finance`, `/investor`, `/restaurants`,
`/restaurants/$locationId`, `/actions`, `/alerts`, `/monitoring`,
`/briefing-preferences`, `/integrations`, `/settings`, `/rosy-bot`.

Server entry points: `src/hooks/use-metrics.ts` (all `rosy_*` RPCs),
`src/lib/access.functions.ts`, `brief.functions.ts`, `rules.functions.ts`,
`rosy.functions.ts`.

Contract to preserve: **every existing table, column, RPC name and signature stays.**
New capability arrives as new objects plus additive nullable columns.

## 4. Risk register
| Risk | Mitigation |
|---|---|
| Renaming canonical tables breaks 19 routes | No renames. Views/synonyms only. |
| Adding NOT NULL columns to 15k-row tables fails | All new columns nullable with backfill, then optional validation trigger. |
| Demo data loss | Snapshot demo rows into `audit_`-prefixed backup tables before each migration. |
| RLS regression | Role-boundary test suite run against all four demo accounts after every migration. |
| Preview/production share one backend | `environment` classification + RLS predicate on workspace. |
