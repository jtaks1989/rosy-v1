ALTER TABLE public.integration_providers ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';

UPDATE public.integration_providers SET aliases = ARRAY['eat_app','eatapp'] WHERE key = 'eatapp';
UPDATE public.integration_providers SET aliases = ARRAY['hr_provider','hr','hr_system'] WHERE key = 'hr_system';

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
JOIN public.integration_providers p
  ON p.key = lower(replace(i.provider,' ','_'))
  OR lower(replace(i.provider,' ','_')) = ANY (p.aliases)
LEFT JOIN public.locations l ON l.id = i.location_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.integration_connections c WHERE c.legacy_integration_id = i.id
);