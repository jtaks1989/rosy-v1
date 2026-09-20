DROP POLICY IF EXISTS "Members with integration permission read connections" ON public.integration_connections;
CREATE POLICY "Members read connections" ON public.integration_connections
  FOR SELECT TO authenticated USING (public.is_member(org_id));

DROP POLICY IF EXISTS "Members with integration permission read venue mappings" ON public.integration_venue_mappings;
CREATE POLICY "Members read venue mappings" ON public.integration_venue_mappings
  FOR SELECT TO authenticated USING (public.is_member(org_id));

DROP POLICY IF EXISTS "Members with integration permission read sync jobs" ON public.integration_sync_jobs;
CREATE POLICY "Members read sync jobs" ON public.integration_sync_jobs
  FOR SELECT TO authenticated USING (public.is_member(org_id));

DROP POLICY IF EXISTS "Members with integration permission read sync runs" ON public.integration_sync_runs;
CREATE POLICY "Members read sync runs" ON public.integration_sync_runs
  FOR SELECT TO authenticated USING (public.is_member(org_id));

DROP POLICY IF EXISTS "Members with integration permission read crosswalk" ON public.integration_entity_mappings;
CREATE POLICY "Members read crosswalk" ON public.integration_entity_mappings
  FOR SELECT TO authenticated USING (public.is_member(org_id));

DROP POLICY IF EXISTS "Members with integration permission read errors" ON public.integration_errors;
CREATE POLICY "Integration admins read errors" ON public.integration_errors
  FOR SELECT TO authenticated
  USING (public.is_member(org_id) AND public.has_permission('manage_integrations'));