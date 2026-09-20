# Rosy AI backend — proposed next migration phases (planning only)

Demo freeze respected: nothing in this task changes the database, demo data,
accounts, permissions, calculations, dashboard, routes or deployments. No
migration is submitted until you approve.

## 1. Audit of what Steps 0–3 already delivered (reuse, do not recreate)

| Existing object | Keep as | Overlap note |
|---|---|---|
| `audit_backup.*_20260909` + `backup_manifest` | backup mechanism for every later phase | new dated copies per phase, same pattern |
| `workspaces`, `organizations.environment`, `workspace_id` on tenancy tables | environment separation (demo/sandbox/production) | no second environment concept will be added |
| `integration_providers`, `integration_connections` (12 demo rows, no credentials) | integration control layer | `integrations` (12 rows) stays untouched for `/integrations` |
| `integration_venue_mappings` (0 rows) | venue mapping workflow | the only venue crosswalk; `external_entity_mappings` stays frozen |
| `integration_sync_jobs`, `_runs`, `_errors`, `_webhook_events`, `_dead_letter_events`, `_rate_limits`, `_cursors` | sync + failure layer | extend with columns, never fork new tables |
| `integration_entity_mappings` (9,238 backfilled) + `integration_upsert_mapping()` | the single external-ID crosswalk | `order_source_links` retained read-only for lineage |
| `mart_menu_engineering` + `rosy_menu_*` RPCs | first reporting-layer models | the `mart_` prefix is the reporting layer going forward |
| `metric_definitions` (12 rows) | metric catalogue seed | needs governance columns, not a replacement table |

Gaps still open: no raw layer, no staging layer, no lineage/currency columns on
money rows, tender still derived by text matching, no reconciliation models, no
data-quality rules or scoring, no retention/privacy classification, no
freshness/health summary, metric catalogue not enforced.

## 2. Proposed phases (one migration each, additive, stop for approval per phase)

**Phase 4 — Raw layer.** `raw_events` (provider, connection, org, workspace,
venue mapping, endpoint/event type, external id, api + payload version, jsonb
payload, checksum, idempotency key, source created/updated, received_at,
sync_run_id, processing_status, retry_count, error_ref). Append-only trigger,
unique idempotency key, RLS on with no policy and no browser grant (service role
only). Zero rows. No dashboard query touched.

**Phase 5 — Staging layer.** `stg_` tables for orders, order_lines, payments,
refunds, discounts, taxes, menu_items, modifiers, ingredients, stock_movements,
purchase_orders, suppliers, recipes, reservations, guests, employees, shifts,
attendance, hr_documents, finance_entries. Each carries `raw_event_id`,
`sync_run_id`, connection, workspace, idempotency key, `record_status`,
`dq_status`. Empty, service-role only.

**Phase 6 — Canonical lineage + money.** Nullable columns on `canonical_orders`,
`order_lines`, `payment_entries`: `brand_id`, `connection_id`, `sync_run_id`,
`currency`, `amount_minor`, `source_created_at`, `source_updated_at`,
`ingested_at`, `record_status`, `data_quality_status`, `source_timezone`,
`local_transaction_time`. Backfill from existing values so every current total is
byte-identical. Plus `fx_rates(date, base, quote, rate, source)` and a
`core_business_date(ts, venue)` immutable helper honouring
`locations.business_day_cutoff`.

**Phase 7 — Payment tender dimension.** `payment_tenders` (cash, card, wallet,
aggregator, bank_transfer, gift_card, loyalty, complimentary, unknown) +
`payment_entries.tender_id` + `source_label` retention +
`tender_mapping_queue` for unknown labels. `rosy_eod_by_location` is then
rewritten to read the dimension with the *same output columns and figures*;
current `ILIKE` buckets are backfilled first and the outputs diffed row-by-row
before the RPC is switched.

**Phase 8 — Missing canonical entities.** `menu_categories`,
`product_modifiers`, `order_adjustments`, `suppliers`, `purchase_orders`,
`goods_receipts`, `stock_locations`, `stock_movements`, `stock_transfers`,
`guest_visits`, `employee_assignments`, `employee_shifts`,
`employee_attendance`, `payroll_summaries`, `share_classes`. Internal UUID keys
only; external ids live in the crosswalk. Empty; existing tables untouched.

**Phase 9 — Mapping review queue + source authority.** `mapping_review_queue`
(unmapped external record → owner, status, decision, audit), mapping
effective-dates and merge/unmerge history on the crosswalk, and
`source_authority_matrix` (provider, domain, authority level, effective from,
version) seeded from the Foodics/Grubtech/Supy/Eat App/HR expectations as
*configurable data*, never as constraints.

**Phase 10 — Reconciliation.** `recon_batches`, `recon_definitions` (the nine
comparisons), `recon_differences` (expected, actual, difference, variance %,
severity, source refs, owner, status, explanation, resolution, timestamps).
Definitions registered but inactive until real contracts exist.

**Phase 11 — Data quality + freshness.** `dq_rules` (configurable, the thirteen
rule types), writes into existing `data_quality_issues`,
`mart_data_quality_scores` and `mart_connection_freshness` aggregated by
provider/connection/venue/entity/sync run. Admin-only read via
`manage_integrations`; no credentials in any payload.

**Phase 12 — Governed metrics + reporting models.** Add
`business_definition`, `grain`, `applicable_filters`, `currency_treatment`,
`timezone_treatment`, `owner`, `approval_status`, `source_precedence`,
`version`, `supersedes` to `metric_definitions` (insert-only versioning). Add
`mart_` models for daily venue performance, sales & channels, inventory & food
cost, waste & variance, guests & reservations, marketing, people & renewals,
finance, investor reporting. Existing RPCs keep their names and signatures and
are re-pointed only after output diffs match exactly.

**Phase 13 — Privacy, retention, audit, health.** `data_classification`,
`retention_policies`, redaction views for reporting, audit writes on login,
export, permission change, integration change, manual correction, recon
resolution, valuation publication and HR document update, plus
`/api/public/health` returning environment, connection health and freshness with
no credentials.

Sync statuses (`queued`, `running`, `partial`, `success`, `failed`, `cancelled`,
`awaiting_mapping`, `awaiting_credentials`) and failure classes (auth,
authorization, rate_limit, network, provider_outage, invalid_payload,
unknown_entity, missing_venue_mapping, duplicate, data_quality, internal) are
added as enum values in Phase 4 and reused everywhere.

## 3. Dashboard queries affected

Phases 4, 5, 8, 9, 10, 11 add only backend-only objects — zero dashboard impact.
Phase 6 adds nullable columns; existing `select` lists are unaffected. Phase 7 is
the one behavioural risk (`rosy_eod_by_location` on `/sales`) and Phase 12 the
other (all `rosy_*` RPCs); both ship behind an output-diff gate.

## 4. Rollback

Every phase ships with a reverse script that drops only the objects it created
and restores affected rows from that phase's dated `audit_backup` copies.
No phase drops, renames or narrows an existing object, so reversing any single
phase leaves the current dashboard code path untouched.

## 5. Test gates (all must pass before a phase is called done)

Pre/post row counts identical for every pre-existing table; the four frozen
totals unchanged (net sales 1,570,659.30 · orders 7,398 · covers 8,550 · stock
value 339,988.00); all four demo roles sign in and every one of the 18+ report
routes renders with no console or HTTP errors; role-boundary denials re-verified
in the database; `raw_`/`stg_` unreachable from `anon`/`authenticated`; no
`VITE_`-exposed secret; Lovable and Vercel parity read on the same backend.

## 6. Documentation deliverables (written on approval, no DB change)

`docs/backend-audit.md` and `docs/backend-architecture.md` get the remaining
deliverables appended: data dictionary, ERD update, adapter specification with
fixture-based versioned sample contracts, sync state machine, retry/dead-letter
policy, DQ framework, reconciliation design, RLS matrix, retention/privacy
policy, metric catalogue, monitoring spec, onboarding checklist and the Vercel
variable checklist. All providers stay labelled Demo / Not connected / Awaiting
credentials.

## 7. Approval requested

Approve to begin **Phase 4 only** (raw layer, empty, backend-only), after the
demo window closes. I will stop again after it.
