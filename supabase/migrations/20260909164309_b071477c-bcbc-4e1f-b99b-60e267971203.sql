-- SELECT policies for integration technical tables (admin/integration managers only)

CREATE POLICY "integration managers read cursors"
ON public.integration_cursors FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.integration_connections ic
    WHERE ic.id = integration_cursors.connection_id
      AND public.is_member(ic.org_id)
  )
  AND public.has_permission('manage_integrations')
);

CREATE POLICY "integration managers read rate limits"
ON public.integration_rate_limits FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.integration_connections ic
    WHERE ic.id = integration_rate_limits.connection_id
      AND public.is_member(ic.org_id)
  )
  AND public.has_permission('manage_integrations')
);

CREATE POLICY "integration managers read dead letter events"
ON public.integration_dead_letter_events FOR SELECT TO authenticated
USING (public.is_member(org_id) AND public.has_permission('manage_integrations'));

CREATE POLICY "integration managers read webhook events"
ON public.integration_webhook_events FOR SELECT TO authenticated
USING (public.is_member(org_id) AND public.has_permission('manage_integrations'));

GRANT SELECT ON public.integration_cursors TO authenticated;
GRANT SELECT ON public.integration_rate_limits TO authenticated;
GRANT SELECT ON public.integration_dead_letter_events TO authenticated;
GRANT SELECT ON public.integration_webhook_events TO authenticated;
GRANT ALL ON public.integration_cursors TO service_role;
GRANT ALL ON public.integration_rate_limits TO service_role;
GRANT ALL ON public.integration_dead_letter_events TO service_role;
GRANT ALL ON public.integration_webhook_events TO service_role;

-- Explicit write policies for scope_grants, restricted to access managers
CREATE POLICY "access managers insert scope grants"
ON public.scope_grants FOR INSERT TO authenticated
WITH CHECK (public.is_member(org_id) AND public.has_permission('manage_access'));

CREATE POLICY "access managers update scope grants"
ON public.scope_grants FOR UPDATE TO authenticated
USING (public.is_member(org_id) AND public.has_permission('manage_access'))
WITH CHECK (public.is_member(org_id) AND public.has_permission('manage_access'));

CREATE POLICY "access managers delete scope grants"
ON public.scope_grants FOR DELETE TO authenticated
USING (public.is_member(org_id) AND public.has_permission('manage_access'));

GRANT INSERT, UPDATE, DELETE ON public.scope_grants TO authenticated;
GRANT ALL ON public.scope_grants TO service_role;

-- Harden SECURITY DEFINER functions: no anon/public execute
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- Restore execute for authenticated only on functions the app/RLS needs
GRANT EXECUTE ON FUNCTION public.has_location_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_entitled_entity_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_investor_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rosy_eod_by_location(date, date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rosy_menu_engineering_period(date, date, uuid[], text[], text[], text[], text[], text, numeric, integer, numeric, text, numeric, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rosy_menu_item_channels(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rosy_menu_item_trend(uuid, date, date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rosy_menu_item_venues(text, date, date, uuid[]) TO authenticated;
