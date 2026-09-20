# Rosy AI — target backend architecture & migration plan

Companion to `docs/backend-audit.md`. Additive only. Nothing existing is dropped
or renamed.

## 1. Layers

Lovable Cloud/Supabase exposes only `public` through the Data API, so layers are
expressed as **table prefixes** in `public`, with browser access removed from
everything except the canonical and mart layers.

| Prefix | Purpose | Browser (anon/authenticated) grants |
|---|---|---|
| `raw_` | Verbatim vendor payload, never edited | none — service role only |
| `stg_` | Cleaned/validated/deduplicated rows | none — service role only |
| existing canonical tables (`canonical_orders`, `locations`, …) | one Rosy truth | SELECT under RLS |
| `mart_` | Governed reporting models | SELECT under RLS |
| `integration_` | Registry, jobs, health | admin role only |
| `audit_` | Audit log + pre-migration backups | admin read only |

Rule enforced by review + tests: no route, hook or Rosy Bot tool may reference a
`raw_` or `stg_` object. Rosy Bot reads canonical/`mart_` only.

## 2. ERD (core spine)

```text
organizations ──< workspaces(environment: demo|sandbox|production)
      │
      ├──< brands ──< locations(venue) ──< canonical_orders ──< order_lines
      │                    │                     │                  └─> products ──< product_modifiers
      │                    │                     ├──< payment_entries ─> payment_tenders(dim)
      │                    │                     └──< order_adjustments(discount|tax|charge|refund|void)
      │                    ├──< reservations ──> guest_profiles ──< guest_visits
      │                    ├──< employees ──< employee_shifts / employee_attendance / restricted_documents
      │                    └──< stock_locations ──< stock_movements ─> ingredients
      ├──< legal_entities ──< capital_commitments ─> investors, share_classes, valuations
      └──< integration_providers ──< integration_connections
                                        ├──< integration_venue_mappings ─> locations
                                        ├──< integration_entity_mappings (crosswalk)
                                        ├──< integration_sync_jobs ──< integration_sync_runs
                                        ├──< integration_cursors / _rate_limits
                                        ├──< integration_webhook_events
                                        └──< integration_errors ──< integration_dead_letter_events

recon_batches ──< recon_differences ─> rosy_actions (owner/status/resolution)
metric_definitions (versioned, approved) ──> mart_* models ──> dashboards, Rosy Bot
```

## 3. Source-of-truth matrix

| Domain | Authoritative | Contributing | Never authoritative |
|---|---|---|---|
| Closed sales, order lines, taxes, discounts, refunds, voids, tenders, cashier activity | Foodics | — | Grubtech |
| Delivery/digital order detail, channel, status timeline, aggregator commission, prep/fulfilment times, cancellations | Grubtech | Foodics (payment leg) | — |
| Inventory items, stock levels & movements, POs, GRN, suppliers, ingredient cost, recipes/BOM, waste, transfers, theoretical vs actual, food cost | Supy | — | POS |
| Reservations, covers, visits, guest profiles/segments, no-shows, booking channel, seating times | Eat App | Foodics (spend match) | — |
| Employees, venue assignment, department/position, status, shifts, attendance, leave, payroll summary, visa/permit, document expiry | HR provider | — | POS |
| Ledger revenue, payouts, settlements | Accounting/bank adapter (not connected) | Foodics, Grubtech | — |

Precedence is stored as data in `metric_definitions.source_precedence` and
`integration_providers.authoritative_domains`, not hard-coded in components.

## 4. Crosswalk & deduplication

`integration_entity_mappings`:
`(connection_id, entity_type, external_id) → (internal_id, internal_table)`,
unique on the triple, many-external-to-one-internal allowed, with
`match_method` (`webhook_id`|`receipt_number`|`deterministic_key`|`manual`),
`confidence`, `confirmed_by`, `superseded_by`.

Dedup rules (all deterministic, none name-only):
- **Order in Foodics + Grubtech** — match on `(venue, business_date, aggregator order reference)`, else `(venue, ±90s of close time, gross total to the minor unit, tender)`. Winner: Foodics for money, Grubtech for operational detail. Loser row keeps `reconciliation_status='duplicate_excluded'`, `counts_in_revenue=false` (mechanism already present).
- **Menu items** — POS item id per connection; cross-provider merge requires an explicit confirmed mapping row.
- **Customers** — normalised phone/email hash; never name.
- **Employees** — HR employee code; multi-venue via an assignment table, never duplicated employee rows.
- **Suppliers/ingredients** — Supy id; external suppliers map in, never merge on label.

## 5. Adapter contract

```ts
interface RosyAdapter {
  provider: string; apiVersion: string;
  authenticate(ctx): Promise<AuthResult>;
  testConnection(ctx): Promise<HealthReport>;
  fetchIncremental(ctx, cursor): Promise<Page<RawRecord>>;   // pagination + watermark
  backfill(ctx, from, to): Promise<Page<RawRecord>>;
  verifyWebhook(req): Promise<boolean>;                       // signature
  receiveWebhook(ctx, event): Promise<RawRecord[]>;
  normalize(raw): StagedRecord[];                             // → stg_
  mapExternalIds(staged): MappedRecord[];                     // → crosswalk
  health(ctx): Promise<HealthReport>;
}
```
Credentials live only in server secrets, referenced by
`integration_connections.secret_ref`. No secret value is ever stored in a table
or shipped to the browser.

## 6. Sync & reliability design

Idempotency key: `sha256(connection_id|entity_type|external_id|source_updated_at)`
used as the upsert conflict target in `stg_`. Every run writes an
`integration_sync_runs` row with received/accepted/rejected counts; a run is
`success` only when the whole requested window is processed, otherwise `partial`.
Failures → `integration_errors`, exhausted retries → `integration_dead_letter_events`
with manual replay. Exponential backoff bounded by `integration_rate_limits`.
Webhook duplicates dropped by unique `(connection_id, provider_event_id)`.
Tombstones set `record_status='deleted'`; nothing is hard-deleted.

## 7. Time, dates, currency

Timestamps UTC + `source_timezone`. Business date computed per venue from
`locations.timezone` + `business_day_cutoff` (already present) via a
`core_business_date(ts, venue)` immutable helper — no midnight assumption.
Money: keep existing `numeric` columns, add `currency` and `amount_minor bigint`
alongside; consolidated reporting joins `fx_rates(date, base, quote, source)` and
every multi-currency figure renders its rate date and basis.

## 8. Data quality

`dq_rules` (configurable) + `data_quality_issues` (exists) covering: missing
venue mapping, unknown product, duplicate external id, invalid timestamp,
unsupported currency, impossible quantity, order totals not reconciling,
movement without item, employee without venue scope, reservation without valid
venue/guest. `mart_data_quality_scores` aggregates by provider, connection,
venue, entity type and sync run; surfaced in the admin-only integration centre.

## 9. Metric catalogue

Extend `metric_definitions` with: `business_definition`, `grain`,
`applicable_filters`, `currency_treatment`, `timezone_treatment`, `owner`,
`approval_status`, `source_precedence`, `supersedes`. New versions are inserted,
never edited. `mart_` models: daily venue performance, brand performance, sales &
covers, ATV, menu item performance, delivery channel performance, food cost,
gross margin, inventory variance, waste, customer segments, repeat visits,
reservation demand, labour productivity, employee compliance, visa exposure,
investor holdings & valuations.

## 10. RLS matrix (target)

| Layer | leadership | finance | investor_relations | restaurant_manager | inventory_procurement | marketing | hr_pro | investor | tech_admin |
|---|---|---|---|---|---|---|---|---|---|
| canonical sales | scoped R | scoped R | – | own venue R | – | scoped R | – | – | scoped R |
| inventory | scoped R | scoped R | – | own venue R | scoped R | – | – | – | scoped R |
| guests | scoped R | – | – | own venue R | – | scoped R | – | – | scoped R |
| HR docs | – | – | – | – | – | – | scoped R/W | – | – |
| investor ledger | R | R | R/W | – | – | – | – | own only | – |
| recon differences | R | R/W | – | own venue R | scoped R | – | – | – | R |
| `integration_*` | R | – | – | – | – | – | – | – | R/W |
| `raw_`/`stg_` | – | – | – | – | – | – | – | – | – (service role only) |

Every predicate uses `is_member` + `has_permission` + `has_location_access`, plus
a new `workspace_environment` check so a demo membership can never read
production rows.

## 11. Migration sequence (each step independently reversible)

0. Backup: `audit_backup_<table>_<date>` copies of all 46 tables. *(no app impact)*
1. `workspaces` + `organizations.environment` + nullable `workspace_id` on
   tenant tables; backfill every existing row to the single **Demo** workspace.
2. `integration_providers` / `integration_connections` and friends; backfill from
   the 12 existing `integrations` rows. `integrations` kept as a view-compatible
   table so `/integrations` keeps working.
3. `integration_entity_mappings`; backfill from `order_source_links` (9,238) and
   `external_entity_mappings`. Both originals retained.
4. `raw_events` + `stg_*` tables (empty; service role only).
5. Lineage columns (nullable) on `canonical_orders`, `order_lines`,
   `payment_entries`: `brand_id`, `connection_id`, `currency`, `amount_minor`,
   `source_created_at`, `source_updated_at`, `ingested_at`, `sync_run_id`,
   `data_quality_status`, `record_status`; backfill from existing values.
6. `payment_tenders` dimension + `payment_entries.tender_id`; backfill from the
   current `ILIKE` buckets, then switch `rosy_eod_by_location` to the dimension
   (same output columns).
7. Missing canonical entities: `menu_categories`, `product_modifiers`,
   `order_adjustments`, `suppliers`, `purchase_orders`, `goods_receipts`,
   `stock_locations`, `stock_movements`, `stock_transfers`, `guest_visits`,
   `employee_assignments`, `employee_shifts`, `employee_attendance`,
   `payroll_summaries`, `share_classes`, `fx_rates`.
8. `recon_batches` / `recon_differences` + the seven reconciliation types.
9. `dq_rules` + data-quality scoring.
10. `mart_*` models and metric-catalogue columns.
11. Audit-log writes on login, export, report generation, permission change,
    integration change, manual correction, recon resolution, valuation
    publication, HR document update.
12. `/api/public/health` — environment, project id, connection health, auth
    health, latest successful sync, freshness by provider. No credentials.

## 12. Rollback plan

Each step ships as one migration with a matching documented reverse script:
drop the objects it created and restore affected rows from the step-0
`audit_backup_*` tables. Because steps 1–12 only add objects and nullable
columns, rollback of any single step leaves the dashboard on its current code
path. No step drops, renames or narrows an existing object.

## 13. Validation gates (must all pass before "production-ready" is claimed)

- All four demo accounts sign in and every route renders (Playwright).
- Role-boundary tests: each role denied every permission it lacks, at the
  database level.
- Isolation test: a demo membership reads zero production-workspace rows.
- Dedup test: a synthetic Foodics+Grubtech pair counts once.
- Reconciliation test: injected difference is detected with expected/actual/%.
- Parity test: identical figures from `rosy-insight-core.lovable.app` and
  `rosyai.vercel.app`.
- Integration health check returns healthy with no credential in the payload.

## 14. Vercel environment checklist

Browser: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_SUPABASE_PROJECT_ID` only.
Server: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`,
`SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, `LOVABLE_CRON_SECRET`, plus one
`*_CLIENT_ID`/`*_CLIENT_SECRET` pair per future provider. Never `VITE_`-prefixed.
`NITRO_PRESET=vercel`, Node 22.

## 15. Provider onboarding checklist

1. Row in `integration_providers` with authoritative domains + API version.
2. Secrets stored server-side; `secret_ref` recorded.
3. Adapter implementing the section-5 contract.
4. Venue mapping rows; refuse ingestion for unmapped venues.
5. Entity types + deterministic idempotency keys declared.
6. Webhook signature verification + replay protection.
7. Backfill window agreed and run as a controlled job.
8. DQ rules enabled; first sync run reviewed.
9. Source precedence recorded in the metric catalogue.
10. RLS + role tests re-run; integration centre shows healthy.
