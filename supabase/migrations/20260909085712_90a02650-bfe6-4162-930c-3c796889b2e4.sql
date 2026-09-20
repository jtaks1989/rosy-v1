-- Step 2: extensible integration registry (additive; no credentials stored)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_health') THEN
    CREATE TYPE public.integration_health AS ENUM ('unknown','healthy','degraded','failing','disabled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_run_status') THEN
    CREATE TYPE public.sync_run_status AS ENUM ('queued','running','succeeded','partial','failed','cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.integration_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  category text NOT NULL,
  owns_domains text[] NOT NULL DEFAULT '{}',
  auth_type text NOT NULL DEFAULT 'api_key',
  api_version text,
  supports_webhooks boolean NOT NULL DEFAULT false,
  supports_backfill boolean NOT NULL DEFAULT true,
  docs_url text,
  adapter_status text NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.integration_providers TO authenticated;
GRANT ALL ON public.integration_providers TO service_role;
ALTER TABLE public.integration_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read provider catalogue" ON public.integration_providers
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.integration_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  workspace_id uuid REFERENCES public.workspaces(id),
  provider_id uuid NOT NULL REFERENCES public.integration_providers(id),
  location_id uuid REFERENCES public.locations(id),
  legacy_integration_id uuid REFERENCES public.integrations(id),
  label text NOT NULL,
  environment public.workspace_environment NOT NULL DEFAULT 'demo',
  mode text NOT NULL DEFAULT 'demo',
  status public.integration_status NOT NULL DEFAULT 'demo',
  health public.integration_health NOT NULL DEFAULT 'unknown',
  auth_type text NOT NULL DEFAULT 'api_key',
  api_version text,
  credential_secret_name text,
  credentials_saved boolean NOT NULL DEFAULT false,
  connection_verified boolean NOT NULL DEFAULT false,
  webhook_status text NOT NULL DEFAULT 'not_configured',
  webhook_secret_name text,
  historical_from date,
  sync_cursor text,
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  records_received bigint NOT NULL DEFAULT 0,
  records_accepted bigint NOT NULL DEFAULT 0,
  records_rejected bigint NOT NULL DEFAULT 0,
  error_summary text,
  capability_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.integration_connections TO authenticated;
GRANT ALL ON public.integration_connections TO service_role;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members with integration permission read connections" ON public.integration_connections
  FOR SELECT TO authenticated
  USING (public.is_member(org_id) AND public.has_permission('integrations.view'));
CREATE INDEX IF NOT EXISTS idx_int_conn_org ON public.integration_connections(org_id);
CREATE INDEX IF NOT EXISTS idx_int_conn_provider ON public.integration_connections(provider_id);

CREATE TABLE IF NOT EXISTS public.integration_venue_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  connection_id uuid NOT NULL REFERENCES public.integration_connections(id),
  external_venue_id text NOT NULL,
  external_venue_name text,
  location_id uuid REFERENCES public.locations(id),
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  confidence text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_venue_id, effective_from)
);
GRANT SELECT ON public.integration_venue_mappings TO authenticated;
GRANT ALL ON public.integration_venue_mappings TO service_role;
ALTER TABLE public.integration_venue_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members with integration permission read venue mappings" ON public.integration_venue_mappings
  FOR SELECT TO authenticated
  USING (public.is_member(org_id) AND public.has_permission('integrations.view'));

CREATE TABLE IF NOT EXISTS public.integration_sync_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  connection_id uuid NOT NULL REFERENCES public.integration_connections(id),
  entity_type text NOT NULL,
  job_kind text NOT NULL DEFAULT 'incremental',
  schedule_cron text,
  enabled boolean NOT NULL DEFAULT false,
  window_from date,
  window_to date,
  priority integer NOT NULL DEFAULT 100,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.integration_sync_jobs TO authenticated;
GRANT ALL ON public.integration_sync_jobs TO service_role;
ALTER TABLE public.integration_sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members with integration permission read sync jobs" ON public.integration_sync_jobs
  FOR SELECT TO authenticated
  USING (public.is_member(org_id) AND public.has_permission('integrations.view'));

CREATE TABLE IF NOT EXISTS public.integration_sync_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  connection_id uuid NOT NULL REFERENCES public.integration_connections(id),
  job_id uuid REFERENCES public.integration_sync_jobs(id),
  entity_type text NOT NULL,
  run_kind text NOT NULL DEFAULT 'incremental',
  status public.sync_run_status NOT NULL DEFAULT 'queued',
  attempt integer NOT NULL DEFAULT 1,
  idempotency_key text,
  cursor_before text,
  cursor_after text,
  window_from timestamptz,
  window_to timestamptz,
  records_received bigint NOT NULL DEFAULT 0,
  records_accepted bigint NOT NULL DEFAULT 0,
  records_rejected bigint NOT NULL DEFAULT 0,
  duration_ms integer,
  error_summary text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, idempotency_key)
);
GRANT SELECT ON public.integration_sync_runs TO authenticated;
GRANT ALL ON public.integration_sync_runs TO service_role;
ALTER TABLE public.integration_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members with integration permission read sync runs" ON public.integration_sync_runs
  FOR SELECT TO authenticated
  USING (public.is_member(org_id) AND public.has_permission('integrations.view'));
CREATE INDEX IF NOT EXISTS idx_int_runs_conn ON public.integration_sync_runs(connection_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.integration_errors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  connection_id uuid NOT NULL REFERENCES public.integration_connections(id),
  sync_run_id uuid REFERENCES public.integration_sync_runs(id),
  entity_type text,
  external_id text,
  error_code text,
  error_message text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  retryable boolean NOT NULL DEFAULT true,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
GRANT ALL ON public.integration_errors TO service_role;
ALTER TABLE public.integration_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members with integration permission read errors" ON public.integration_errors
  FOR SELECT TO authenticated
  USING (public.is_member(org_id) AND public.has_permission('integrations.view'));
GRANT SELECT ON public.integration_errors TO authenticated;

-- backend-only tables (no authenticated grants at all)
CREATE TABLE IF NOT EXISTS public.integration_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES public.organizations(id),
  connection_id uuid REFERENCES public.integration_connections(id),
  provider_key text NOT NULL,
  event_type text,
  external_event_id text,
  signature_verified boolean NOT NULL DEFAULT false,
  dedupe_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_status text NOT NULL DEFAULT 'received',
  processed_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_key, dedupe_key)
);
GRANT ALL ON public.integration_webhook_events TO service_role;
ALTER TABLE public.integration_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.integration_dead_letter_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES public.organizations(id),
  connection_id uuid REFERENCES public.integration_connections(id),
  sync_run_id uuid REFERENCES public.integration_sync_runs(id),
  entity_type text NOT NULL,
  external_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_reason text NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  replayable boolean NOT NULL DEFAULT true,
  replayed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.integration_dead_letter_events TO service_role;
ALTER TABLE public.integration_dead_letter_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.integration_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES public.integration_connections(id),
  scope text NOT NULL DEFAULT 'default',
  limit_per_window integer,
  window_seconds integer,
  remaining integer,
  resets_at timestamptz,
  backoff_until timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, scope)
);
GRANT ALL ON public.integration_rate_limits TO service_role;
ALTER TABLE public.integration_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.integration_cursors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES public.integration_connections(id),
  entity_type text NOT NULL,
  cursor_kind text NOT NULL DEFAULT 'updated_at',
  cursor_value text,
  watermark_at timestamptz,
  page_token text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, entity_type, cursor_kind)
);
GRANT ALL ON public.integration_cursors TO service_role;
ALTER TABLE public.integration_cursors ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_int_providers_updated_at ON public.integration_providers;
CREATE TRIGGER update_int_providers_updated_at BEFORE UPDATE ON public.integration_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_int_connections_updated_at ON public.integration_connections;
CREATE TRIGGER update_int_connections_updated_at BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_int_venue_mappings_updated_at ON public.integration_venue_mappings;
CREATE TRIGGER update_int_venue_mappings_updated_at BEFORE UPDATE ON public.integration_venue_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_int_sync_jobs_updated_at ON public.integration_sync_jobs;
CREATE TRIGGER update_int_sync_jobs_updated_at BEFORE UPDATE ON public.integration_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- provider catalogue
INSERT INTO public.integration_providers (key, display_name, category, owns_domains, auth_type, supports_webhooks, adapter_status)
VALUES
  ('foodics','Foodics','pos', ARRAY['orders','order_lines','menu','payments','taxes','discounts','refunds','pos_activity'],'oauth2',true,'demo_adapter'),
  ('grubtech','Grubtech','delivery_aggregation', ARRAY['delivery_orders','channels','order_status','commissions','fulfilment_timestamps','cancellations'],'api_key',true,'demo_adapter'),
  ('supy','Supy','inventory', ARRAY['inventory_items','stock_levels','stock_movements','purchase_orders','goods_receipts','suppliers','ingredient_costs','recipes','waste','transfers'],'api_key',false,'demo_adapter'),
  ('eatapp','Eat App','reservations', ARRAY['reservations','covers','guest_profiles','segments','no_shows','booking_channels'],'api_key',true,'demo_adapter'),
  ('hr_system','HR system','hr', ARRAY['employees','assignments','departments','shifts','attendance','leave','payroll_summaries','documents','renewals'],'api_key',false,'demo_adapter'),
  ('accounting','Accounting platform','finance', ARRAY['journals','trial_balance','ap','ar'],'oauth2',false,'planned'),
  ('banking','Banking','finance', ARRAY['bank_transactions','payouts'],'oauth2',false,'planned'),
  ('payroll','Payroll','hr', ARRAY['payroll_runs','payslips'],'api_key',false,'planned'),
  ('loyalty','Loyalty','crm', ARRAY['members','points','rewards'],'api_key',false,'planned'),
  ('reviews','Review platform','reputation', ARRAY['reviews','ratings'],'api_key',false,'planned'),
  ('marketing','Marketing & advertising','marketing', ARRAY['campaigns','spend','attribution'],'oauth2',false,'planned'),
  ('captable','Investor / cap-table system','investor', ARRAY['investors','commitments','valuations','distributions'],'api_key',false,'planned')
ON CONFLICT (key) DO NOTHING;

-- reference connections mirrored from the existing integrations rows (no credentials)
INSERT INTO public.integration_connections (
  org_id, workspace_id, provider_id, location_id, legacy_integration_id, label,
  environment, mode, status, health, auth_type, credentials_saved, connection_verified,
  historical_from, last_success_at, next_attempt_at, records_accepted, error_summary, capability_notes
)
SELECT i.org_id, o.workspace_id, p.id, i.location_id, i.id,
       p.display_name || COALESCE(' — ' || l.name, ' — all venues'),
       'demo', i.mode, i.status, 'unknown', p.auth_type,
       false, i.connection_verified,
       i.historical_from, i.last_success_at, i.next_attempt_at,
       COALESCE(i.row_count, 0), i.failure_reason, i.capability_notes
FROM public.integrations i
JOIN public.organizations o ON o.id = i.org_id
JOIN public.integration_providers p ON p.key = lower(replace(i.provider, ' ', '_'))
LEFT JOIN public.locations l ON l.id = i.location_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.integration_connections c WHERE c.legacy_integration_id = i.id
);

-- venue mappings mirrored from existing external mappings, where a connection exists
INSERT INTO public.integration_venue_mappings (org_id, connection_id, external_venue_id, location_id, effective_from, effective_to)
SELECT m.org_id, c.id, m.external_id, m.location_id, m.effective_from, m.effective_to
FROM public.external_entity_mappings m
JOIN public.integration_providers p ON p.key = lower(replace(m.provider, ' ', '_'))
JOIN public.integration_connections c ON c.provider_id = p.id AND c.org_id = m.org_id
  AND (c.location_id IS NULL OR c.location_id = m.location_id)
ON CONFLICT DO NOTHING;