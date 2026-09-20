-- Step 3: unified external-ID crosswalk (additive)
CREATE TABLE IF NOT EXISTS public.integration_entity_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  workspace_id uuid REFERENCES public.workspaces(id),
  provider_key text NOT NULL,
  connection_id uuid REFERENCES public.integration_connections(id),
  entity_type text NOT NULL,
  external_id text NOT NULL,
  external_name text,
  internal_id uuid,
  internal_table text NOT NULL,
  is_primary_source boolean NOT NULL DEFAULT true,
  match_method text NOT NULL DEFAULT 'deterministic',
  match_confidence text NOT NULL DEFAULT 'confirmed',
  raw_status text,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider_key, entity_type, external_id)
);

GRANT SELECT ON public.integration_entity_mappings TO authenticated;
GRANT ALL ON public.integration_entity_mappings TO service_role;
ALTER TABLE public.integration_entity_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members with integration permission read crosswalk" ON public.integration_entity_mappings
  FOR SELECT TO authenticated
  USING (public.is_member(org_id) AND public.has_permission('integrations.view'));

CREATE INDEX IF NOT EXISTS idx_iem_internal ON public.integration_entity_mappings(internal_table, internal_id);
CREATE INDEX IF NOT EXISTS idx_iem_provider_entity ON public.integration_entity_mappings(provider_key, entity_type);

DROP TRIGGER IF EXISTS update_iem_updated_at ON public.integration_entity_mappings;
CREATE TRIGGER update_iem_updated_at BEFORE UPDATE ON public.integration_entity_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- backfill: order/source links -> crosswalk
INSERT INTO public.integration_entity_mappings (
  org_id, workspace_id, provider_key, connection_id, entity_type, external_id,
  internal_id, internal_table, is_primary_source, match_method, match_confidence,
  raw_status, first_seen_at, last_seen_at
)
SELECT DISTINCT ON (s.org_id, lower(replace(s.provider,' ','_')), s.external_id)
  s.org_id,
  o.workspace_id,
  lower(replace(s.provider, ' ', '_')),
  c.id,
  'order',
  s.external_id,
  s.order_id,
  'canonical_orders',
  (co.authoritative_source = s.provider),
  'deterministic',
  'confirmed',
  s.raw_status,
  s.ingested_at,
  s.ingested_at
FROM public.order_source_links s
JOIN public.organizations o ON o.id = s.org_id
JOIN public.canonical_orders co ON co.id = s.order_id
LEFT JOIN public.integration_providers p ON p.key = lower(replace(s.provider, ' ', '_'))
LEFT JOIN public.integration_connections c
       ON c.provider_id = p.id AND c.org_id = s.org_id
      AND (c.location_id IS NULL OR c.location_id = co.location_id)
ORDER BY s.org_id, lower(replace(s.provider,' ','_')), s.external_id, s.ingested_at
ON CONFLICT (org_id, provider_key, entity_type, external_id) DO NOTHING;

-- backfill: venue mappings -> crosswalk
INSERT INTO public.integration_entity_mappings (
  org_id, workspace_id, provider_key, connection_id, entity_type, external_id,
  internal_id, internal_table, match_method, match_confidence
)
SELECT m.org_id, o.workspace_id, lower(replace(m.provider,' ','_')), NULL,
       'venue', m.external_id, m.location_id, 'locations', 'deterministic', 'confirmed'
FROM public.external_entity_mappings m
JOIN public.organizations o ON o.id = m.org_id
ON CONFLICT (org_id, provider_key, entity_type, external_id) DO NOTHING;

-- idempotent upsert helper for future adapters (service role only)
CREATE OR REPLACE FUNCTION public.integration_upsert_mapping(
  p_org uuid,
  p_provider_key text,
  p_entity_type text,
  p_external_id text,
  p_internal_table text,
  p_internal_id uuid,
  p_connection uuid DEFAULT NULL,
  p_external_name text DEFAULT NULL,
  p_is_primary boolean DEFAULT true,
  p_match_method text DEFAULT 'deterministic',
  p_match_confidence text DEFAULT 'confirmed'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.integration_entity_mappings (
    org_id, provider_key, connection_id, entity_type, external_id, external_name,
    internal_id, internal_table, is_primary_source, match_method, match_confidence
  ) VALUES (
    p_org, p_provider_key, p_connection, p_entity_type, p_external_id, p_external_name,
    p_internal_id, p_internal_table, p_is_primary, p_match_method, p_match_confidence
  )
  ON CONFLICT (org_id, provider_key, entity_type, external_id) DO UPDATE
    SET internal_id = COALESCE(EXCLUDED.internal_id, public.integration_entity_mappings.internal_id),
        internal_table = EXCLUDED.internal_table,
        external_name = COALESCE(EXCLUDED.external_name, public.integration_entity_mappings.external_name),
        connection_id = COALESCE(EXCLUDED.connection_id, public.integration_entity_mappings.connection_id),
        is_primary_source = EXCLUDED.is_primary_source,
        match_method = EXCLUDED.match_method,
        match_confidence = EXCLUDED.match_confidence,
        last_seen_at = now(),
        updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.integration_upsert_mapping(uuid,text,text,text,text,uuid,uuid,text,boolean,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_upsert_mapping(uuid,text,text,text,text,uuid,uuid,text,boolean,text,text) TO service_role;