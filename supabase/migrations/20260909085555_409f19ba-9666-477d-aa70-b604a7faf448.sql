-- Step 1: workspace / environment classification (additive)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_environment') THEN
    CREATE TYPE public.workspace_environment AS ENUM ('demo', 'sandbox', 'production');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  environment public.workspace_environment NOT NULL DEFAULT 'demo',
  base_currency text NOT NULL DEFAULT 'AED',
  timezone text NOT NULL DEFAULT 'Asia/Dubai',
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- additive nullable columns
ALTER TABLE public.organizations  ADD COLUMN IF NOT EXISTS environment public.workspace_environment NOT NULL DEFAULT 'demo';
ALTER TABLE public.organizations  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.brands         ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.legal_entities ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.locations      ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.memberships    ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);

-- one Demo workspace, backfill every existing row into it
WITH ws AS (
  INSERT INTO public.workspaces (name, environment, base_currency, timezone, notes)
  SELECT 'Rosy Hospitality — Demo', 'demo', 'AED', 'Asia/Dubai',
         'Synthetic demonstration workspace. No live integration data.'
  WHERE NOT EXISTS (SELECT 1 FROM public.workspaces WHERE environment = 'demo')
  RETURNING id
), target AS (
  SELECT id FROM ws
  UNION ALL
  SELECT id FROM public.workspaces WHERE environment = 'demo'
  LIMIT 1
)
UPDATE public.organizations o SET workspace_id = (SELECT id FROM target), environment = 'demo'
WHERE o.workspace_id IS NULL;

UPDATE public.brands b         SET workspace_id = o.workspace_id FROM public.organizations o WHERE o.id = b.org_id AND b.workspace_id IS NULL;
UPDATE public.legal_entities l SET workspace_id = o.workspace_id FROM public.organizations o WHERE o.id = l.org_id AND l.workspace_id IS NULL;
UPDATE public.locations lo     SET workspace_id = o.workspace_id FROM public.organizations o WHERE o.id = lo.org_id AND lo.workspace_id IS NULL;
UPDATE public.memberships m    SET workspace_id = o.workspace_id FROM public.organizations o WHERE o.id = m.org_id AND m.workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_locations_workspace   ON public.locations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_memberships_workspace ON public.memberships(workspace_id);

CREATE POLICY "Members read their own workspace" ON public.workspaces
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organizations o
    JOIN public.memberships m ON m.org_id = o.id
    WHERE o.workspace_id = workspaces.id
      AND m.user_id = auth.uid()
      AND m.active
  ));