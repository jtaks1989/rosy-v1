# Rosy AI — proactive intelligence roadmap

## Deployment hardening — done
- [x] Browser authentication client now reads only explicit `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` values, with no server-environment fallback.
- [x] Production builds fail immediately when either required browser value is absent.

## Increment 1 — done and working
- [x] Additive schema: actions & outcomes, action comments, monitoring rules, monitoring events (deduplicated), briefing preferences, briefing snapshots — all with row-level access rules and grants. No existing table changed.
- [x] "Your Rosy Brief" homepage-style page: role-personalised performance snapshot, what changed (with comparison period, evidence, freshness, explicitly no asserted cause), decisions needed today, today/week ahead, dated snapshot saving.
- [x] Role-based briefing content driven by permissions read server-side (not hidden UI).
- [x] Actions & Outcomes workspace: create, assign, due date, status lifecycle (open → assigned → in progress → blocked → completed → under review → closed), evidence snapshot, comments, snooze, agreed success measure, baseline, evaluation window, outcome verdict + confounders.
- [x] Promote an open alert into an action, carrying its evidence and freshness.
- [x] Monitoring rules: natural-language request parsed deterministically into a structured rule the user must confirm; edit/pause/resume/delete; bounded, permission-rechecked evaluation; minimum-sample guard; cooldown; dedupe key so one event records once; trigger history.
- [x] Briefing preferences: frequency, delivery time (default 09:00 Asia/Dubai), timezone, venues within granted scope, topics, concise/detailed, English/Arabic, quiet hours, pause/resume, past snapshots.

## Demo-only / honestly labelled
- Sales, menu, inventory, guest, people and investor figures come from the synthetic demo dataset (persistent demo banner).
- Recipe contribution is labelled "estimated" and reports mapping coverage.

## Blocked by credentials or provider setup
- Email and WhatsApp briefing/alert delivery — shown as "Delivery channel not connected"; nothing is sent or simulated.
- Scheduled (unattended) briefing delivery — needs a delivery channel first; rules and briefs are currently checked on demand with permissions rechecked at run time.
- Accounting, bank/statement, payment-processor, delivery-platform settlement and supplier-invoice sources.
- Speech provider for voice input.

## Remaining (planned increments)
- Increment 2: scheduled delivery with permission recheck at send time, voice input (record → transcript → edit → submit), user-controlled Rosy bot memory ("What Rosy remembers").
- Increment 3: accounting/settlement adapters, document intake & review queue with extraction confidence, financial reconciliation (one-to-many / many-to-one matching, candidate matches for review), monthly close and publication versioning.
- Increment 4: Week Ahead planning with forecast ranges and tracked forecast accuracy, cross-system opportunity cards, "About this number" panel on every key metric.

## Backend platform migration (steps 0-3 complete 2026-09-09)
- [x] Step 0 backup all tables (audit_backup schema)
- [x] Step 1 workspaces + demo/sandbox/production classification
- [x] Step 2 integration registry (providers, connections, jobs, runs, errors, webhooks, DLQ, rate limits, cursors)
- [x] Step 3 unified external-ID crosswalk (9,238 rows backfilled)
- [ ] Steps 4-12 awaiting approval: raw/staging layer, lineage columns, payment tenders, missing canonical entities, reconciliation, data quality, marts, audit writes, health endpoint
See docs/migration-steps-0-3.md
