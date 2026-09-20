-- Enums
DO $$ BEGIN
  CREATE TYPE public.action_status AS ENUM ('open','assigned','in_progress','blocked','completed','under_review','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.monitoring_rule_status AS ENUM ('draft','active','paused','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Shared updated_at trigger fn
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Actions & Outcomes
CREATE TABLE IF NOT EXISTS public.rosy_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  location_id uuid REFERENCES public.locations(id),
  legal_entity_id uuid REFERENCES public.legal_entities(id),
  title text NOT NULL,
  why_it_matters text,
  source_kind text NOT NULL DEFAULT 'manual',
  source_ref text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  department text,
  owner_user_id uuid,
  owner_name text,
  due_date date,
  status public.action_status NOT NULL DEFAULT 'open',
  severity text NOT NULL DEFAULT 'medium',
  success_metric text,
  baseline_value numeric(18,4),
  baseline_note text,
  evaluation_window text,
  outcome_review_date date,
  outcome_value numeric(18,4),
  outcome_verdict text,
  outcome_note text,
  confounders text,
  snoozed_until date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.rosy_actions TO authenticated;
GRANT ALL ON public.rosy_actions TO service_role;
ALTER TABLE public.rosy_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members with alert access read actions" ON public.rosy_actions
  FOR SELECT TO authenticated
  USING (public.is_member(org_id) AND public.has_permission('view_alerts')
         AND (location_id IS NULL OR public.has_location_access(location_id)));
CREATE POLICY "members with alert access create actions" ON public.rosy_actions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member(org_id) AND public.has_permission('view_alerts')
              AND (location_id IS NULL OR public.has_location_access(location_id)));
CREATE POLICY "members with alert access update actions" ON public.rosy_actions
  FOR UPDATE TO authenticated
  USING (public.is_member(org_id) AND public.has_permission('view_alerts'))
  WITH CHECK (public.is_member(org_id) AND public.has_permission('view_alerts'));

CREATE TRIGGER rosy_actions_updated_at BEFORE UPDATE ON public.rosy_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS rosy_actions_org_status_idx ON public.rosy_actions (org_id, status, due_date);

-- Comments
CREATE TABLE IF NOT EXISTS public.action_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  action_id uuid NOT NULL REFERENCES public.rosy_actions(id) ON DELETE CASCADE,
  author uuid,
  author_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.action_comments TO authenticated;
GRANT ALL ON public.action_comments TO service_role;
ALTER TABLE public.action_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read action comments" ON public.action_comments
  FOR SELECT TO authenticated USING (public.is_member(org_id) AND public.has_permission('view_alerts'));
CREATE POLICY "members add action comments" ON public.action_comments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member(org_id) AND public.has_permission('view_alerts') AND author = auth.uid());

-- Monitoring rules
CREATE TABLE IF NOT EXISTS public.monitoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  created_by uuid NOT NULL,
  name text NOT NULL,
  request_text text,
  metric text NOT NULL,
  scope_type text NOT NULL DEFAULT 'all',
  scope_ref uuid,
  operator text NOT NULL DEFAULT 'below',
  threshold numeric(18,4),
  baseline text NOT NULL DEFAULT 'previous_period',
  frequency text NOT NULL DEFAULT 'daily',
  min_sample integer NOT NULL DEFAULT 20,
  channel text NOT NULL DEFAULT 'in_app',
  recipients text[] NOT NULL DEFAULT '{}',
  cooldown_hours integer NOT NULL DEFAULT 24,
  escalate_after_hours integer,
  status public.monitoring_rule_status NOT NULL DEFAULT 'draft',
  last_evaluated_at timestamptz,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_rules TO authenticated;
GRANT ALL ON public.monitoring_rules TO service_role;
ALTER TABLE public.monitoring_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read own org rules" ON public.monitoring_rules
  FOR SELECT TO authenticated USING (public.is_member(org_id) AND public.has_permission('use_bot'));
CREATE POLICY "members create own rules" ON public.monitoring_rules
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member(org_id) AND public.has_permission('use_bot') AND created_by = auth.uid());
CREATE POLICY "owners update own rules" ON public.monitoring_rules
  FOR UPDATE TO authenticated USING (public.is_member(org_id) AND created_by = auth.uid())
  WITH CHECK (public.is_member(org_id) AND created_by = auth.uid());
CREATE POLICY "owners delete own rules" ON public.monitoring_rules
  FOR DELETE TO authenticated USING (public.is_member(org_id) AND created_by = auth.uid());
CREATE TRIGGER monitoring_rules_updated_at BEFORE UPDATE ON public.monitoring_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Monitoring events (deduplicated)
CREATE TABLE IF NOT EXISTS public.monitoring_rule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  rule_id uuid NOT NULL REFERENCES public.monitoring_rules(id) ON DELETE CASCADE,
  dedupe_key text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  observed_value numeric(18,4),
  baseline_value numeric(18,4),
  sample_size integer,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  channel text NOT NULL DEFAULT 'in_app',
  delivery_status text NOT NULL DEFAULT 'in_app_only',
  action_id uuid REFERENCES public.rosy_actions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, dedupe_key)
);
GRANT SELECT, INSERT ON public.monitoring_rule_events TO authenticated;
GRANT ALL ON public.monitoring_rule_events TO service_role;
ALTER TABLE public.monitoring_rule_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read rule events" ON public.monitoring_rule_events
  FOR SELECT TO authenticated USING (public.is_member(org_id) AND public.has_permission('use_bot'));
CREATE POLICY "members record rule events" ON public.monitoring_rule_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member(org_id) AND public.has_permission('use_bot'));

-- Briefing preferences (private per person)
CREATE TABLE IF NOT EXISTS public.briefing_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL UNIQUE,
  daily_enabled boolean NOT NULL DEFAULT true,
  weekly_enabled boolean NOT NULL DEFAULT false,
  monthly_enabled boolean NOT NULL DEFAULT false,
  delivery_time time NOT NULL DEFAULT '09:00',
  timezone text NOT NULL DEFAULT 'Asia/Dubai',
  locations uuid[] NOT NULL DEFAULT '{}',
  topics text[] NOT NULL DEFAULT '{sales,menu,inventory,guests,actions}',
  detail_level text NOT NULL DEFAULT 'concise',
  language text NOT NULL DEFAULT 'en',
  channels text[] NOT NULL DEFAULT '{in_app}',
  quiet_from time,
  quiet_to time,
  paused boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefing_preferences TO authenticated;
GRANT ALL ON public.briefing_preferences TO service_role;
ALTER TABLE public.briefing_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own briefing preferences" ON public.briefing_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.is_member(org_id));
CREATE TRIGGER briefing_preferences_updated_at BEFORE UPDATE ON public.briefing_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Briefing snapshots (private per person)
CREATE TABLE IF NOT EXISTS public.briefing_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  role_preset text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  period_from date NOT NULL,
  period_to date NOT NULL,
  scope_label text,
  completeness text NOT NULL DEFAULT 'preliminary',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  channel text NOT NULL DEFAULT 'in_app',
  delivery_status text NOT NULL DEFAULT 'viewed_in_app',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.briefing_snapshots TO authenticated;
GRANT ALL ON public.briefing_snapshots TO service_role;
ALTER TABLE public.briefing_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own briefing snapshots read" ON public.briefing_snapshots
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own briefing snapshots insert" ON public.briefing_snapshots
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_member(org_id));
CREATE INDEX IF NOT EXISTS briefing_snapshots_user_idx ON public.briefing_snapshots (user_id, generated_at DESC);