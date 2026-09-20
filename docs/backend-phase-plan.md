# Rosy AI — approved next migration phases (Phases 4–13)

Status: **approved as a plan; nothing implemented.** Demo freeze in force — no
migration, data change, code change or deployment has been made for this task.
Phase 4 begins only after the demo window closes, and each phase stops for
approval again.

All 12 registry connections remain `demo`, `credentials_saved = false`. No live
API call, webhook or schedule is part of any phase below.

## Phase index

| Phase | Scope | Dashboard impact |
|---|---|---|
| 4 | Raw layer (`raw_events`) + shared sync/failure enums | none |
| 5 | Staging layer (`stg_*`, 20 tables, empty) | none |
| 6 | Canonical lineage + currency columns, `fx_rates`, `core_business_date()` | none (nullable adds) |
| 7 | `payment_tenders` dimension, `tender_mapping_queue`, `rosy_eod_by_location` re-point | `/sales` — diff-gated |
| 8 | 15 missing canonical entities (empty) | none |
| 9 | `mapping_review_queue`, crosswalk effective dates + merge history, `source_authority_matrix` | none |
| 10 | `recon_batches`, `recon_definitions`, `recon_differences` | none (inactive) |
| 11 | `dq_rules`, `mart_data_quality_scores`, `mart_connection_freshness` | admin area only |
| 12 | Metric-catalogue governance columns + `mart_*` reporting models | all `rosy_*` RPCs — diff-gated |
| 13 | `data_classification`, `retention_policies`, redaction views, audit writes, `/api/public/health` | none |

Phase detail, objects, rollback and gates: see
`.lovable/plan/rosy-ai-backend-proposed-next-migration-phases-planning-only-2026-09-09.md`
and sections below.

## Reuse rules (from the Steps 0–3 audit)

- The integration control layer is `integration_*` from Step 2 — extend with
  columns, never fork a parallel table set.
- The only external-ID crosswalk is `integration_entity_mappings` +
  `integration_upsert_mapping()`. `order_source_links` and
  `external_entity_mappings` stay frozen and read-only for lineage.
- The environment concept is `workspaces` + `organizations.environment`. No
  second flag will be introduced.
- The reporting layer prefix is `mart_`, established by `mart_menu_engineering`.
- `metric_definitions` is extended, not replaced.

## Sync state machine

```text
queued ──> running ──┬─> success
                     ├─> partial ──> queued (retry window)
                     ├─> failed  ──> queued (backoff) ──> dead_letter
                     ├─> cancelled
                     ├─> awaiting_mapping        (unmapped venue/entity)
                     └─> awaiting_credentials    (current state of all providers)
```

Every run records: provider, connection, job type, requested period, cursor
before/after, start/finish, records requested / received / inserted / updated /
ignored / rejected, warnings, errors, final status.

## Failure classification and retry

| Class | Retryable | Policy |
|---|---|---|
| authentication, authorization | no | mark connection unhealthy, notify admin |
| rate_limit | yes | backoff bounded by `integration_rate_limits` |
| network, provider_outage | yes | exponential backoff, capped attempts |
| invalid_payload, unknown_entity, missing_venue_mapping | no | `awaiting_mapping` / review queue |
| duplicate | no | ignored, counted, audited |
| data_quality | no | issue row, record quarantined |
| internal | yes | bounded retries, then dead letter |

Exhausted retries move to `integration_dead_letter_events` with raw payload
reference, classification, retry history, resolution status, owner and replay
action. Nothing is ever dropped silently.

## Idempotency and deduplication

Key: `sha256(connection_id | entity_type | external_id | source_version |
source_updated_at | payload_checksum)`, unique in `raw_events` and each `stg_`
table. Unchanged payloads short-circuit. Foodics/Grubtech order pairs match on
`(venue, business_date, aggregator reference)` then
`(venue, ±90s close time, gross total in minor units, tender)`; loser keeps
`reconciliation_status = 'duplicate_excluded'`, `counts_in_revenue = false`.
Names are never a match key.

## Money and currency

Amounts keep `numeric` plus `amount_minor bigint` and `currency`. Gross sales,
discounts, refunds, net sales, tax, service charge, tips, delivery fees,
aggregator commission, payment fees, recipe cost and contribution margin stay
separate columns. Cross-currency figures carry original amount, original
currency, rate, converted amount, reporting currency, rate source and rate date
from `fx_rates`; no implicit conversion.

## Time

Stored per money/event row: source timestamp, source timezone, venue timezone,
local transaction time, UTC time, business date. Business date is derived by
`core_business_date(ts, venue)` from `locations.timezone` +
`business_day_cutoff` — no midnight assumption.

## Reconciliation set (Phase 10, registered inactive)

Foodics vs Grubtech orders · orders vs payments · gross vs discounts/refunds ·
delivery sales vs aggregator payouts · Supy theoretical vs actual usage · POs vs
goods received · sales quantities vs recipe consumption · Eat App covers vs POS
covers · HR attendance vs scheduled shifts. Each exception carries expected,
actual, difference, variance %, severity, source references, owner, status,
explanation, resolution and timestamps.

## Data quality rules (Phase 11)

Missing required fields · missing venue mapping · invalid timestamps ·
unsupported currency · negative quantity · invalid order totals · missing
payments · missing recipe cost · unknown menu item · duplicate external id ·
orphaned records · stale connection · abnormal record-count change. Scores and
freshness aggregate by provider, connection, venue, entity type and sync run,
readable only with `manage_integrations`, never including credentials.

## Security and RLS

`raw_*` and `stg_*`: RLS on, no policy, no `anon`/`authenticated` grant —
service role only, unreachable through the Data API. `integration_*` stays
admin-scoped. Canonical and `mart_` models keep `is_member` +
`has_permission` + `has_location_access`, plus the workspace-environment
predicate so a demo membership can never read production rows. Rosy Bot uses the
same authenticated context and reads canonical/`mart_` only, returning scope,
date range, metric definition, source systems, freshness and DQ warnings with
every answer.

Browser variables remain exactly `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`. Server names
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` plus
service/provider secrets stay server-only and are never mirrored into `VITE_`,
bundles, logs or the health endpoint.

## Retention and privacy (Phase 13)

Classified sensitive: guest contact details, reservation notes, employee
records, visa/permit data, investor holdings, authentication data. Each class
gets minimum-access role list, retention period, redaction rule, audit
requirement, export control and deletion workflow. Reporting models carry
aggregates and keys, not sensitive fields.

## Environment separation

Demo (existing sample data, demo accounts, no live connections) · Sandbox
(future test credentials, limited windows, validation before promotion) ·
Production (approved connections, monitored schedules, reconciliation, change
control). No demo or sandbox process may write production rows; enforced by the
workspace predicate, not by convention.

## Provider onboarding checklist

1. `integration_providers` row with authoritative domains + API version.
2. Secrets stored server-side; `secret_ref` recorded, value never in a table.
3. Adapter implementing the section-5 contract of `docs/backend-architecture.md`.
4. Versioned fixture contract committed before any live call.
5. Venue mapping rows approved; unmapped venues refuse ingestion.
6. Entity types + deterministic idempotency keys declared.
7. Webhook signature verification + replay protection.
8. Backfill window agreed, run as a controlled job in Sandbox.
9. DQ rules enabled; first sync run reviewed.
10. Source authority recorded in `source_authority_matrix` and the metric
    catalogue.
11. RLS + role tests re-run; integration centre shows the true status.

## Test gates per phase

Row counts identical for every pre-existing table · frozen totals unchanged
(net sales 1,570,659.30 · orders 7,398 · covers 8,550 · stock value 339,988.00)
· all four demo roles sign in and every report route renders clean ·
role-boundary denials re-verified in the database · `raw_`/`stg_` unreachable
from `anon`/`authenticated` · no secret in the client bundle · Lovable and Vercel
parity on the same backend.
