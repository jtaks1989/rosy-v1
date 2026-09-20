
-- ============ ENUMS ============
create type public.role_preset as enum ('leadership','finance','investor_relations','restaurant_manager','inventory_procurement','marketing','hr_pro','investor','tech_admin');
create type public.integration_status as enum ('demo','not_configured','pending_access','testing','healthy','syncing','partial','stale','expired_credentials','failed');
create type public.order_lifecycle as enum ('open','completed','cancelled','rejected','refunded','partially_refunded');
create type public.valuation_status as enum ('draft','review','approved','published');
create type public.doc_status as enum ('valid','upcoming','action_required','in_progress','submitted','renewed','expired','verification_needed','waived');
create type public.alert_status as enum ('open','acknowledged','snoozed','resolved');
create type public.recon_status as enum ('single_source','matched','duplicate_excluded','unmatched','review');

-- ============ ORGANIZATION ============
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_demo boolean not null default false,
  base_currency text not null default 'AED',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role_preset public.role_preset not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table public.role_permissions (
  role_preset public.role_preset not null,
  permission text not null,
  primary key (role_preset, permission)
);

create table public.scope_grants (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  scope_type text not null check (scope_type in ('all','brand','location','entity','investor')),
  ref_id uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.scope_grants (membership_id);

create table public.legal_entities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  jurisdiction text
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid not null references public.brands(id),
  legal_entity_id uuid references public.legal_entities(id),
  name text not null,
  city text default 'Dubai',
  timezone text not null default 'Asia/Dubai',
  business_day_cutoff time not null default '04:00',
  currency text not null default 'AED',
  opened_on date,
  manager_name text
);
create index on public.locations (org_id);

-- ============ INTEGRATIONS ============
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  location_id uuid references public.locations(id) on delete cascade,
  mode text not null default 'demo' check (mode in ('demo','live')),
  status public.integration_status not null default 'not_configured',
  credentials_saved boolean not null default false,
  connection_verified boolean not null default false,
  data_reconciled boolean not null default false,
  capability_notes text,
  dependency_note text,
  historical_from date,
  last_success_at timestamptz,
  next_attempt_at timestamptz,
  row_count integer default 0,
  failure_reason text
);

create table public.external_entity_mappings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  external_id text not null,
  location_id uuid references public.locations(id) on delete cascade,
  effective_from date not null default current_date,
  effective_to date,
  unique (org_id, provider, external_id, effective_from)
);

create table public.data_quality_issues (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  kind text not null,
  detail text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  created_at timestamptz not null default now()
);

-- ============ COMMERCE ============
create table public.products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  pos_item_id text not null,
  name text not null,
  category text not null,
  is_available boolean not null default true
);
create index on public.products (location_id);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  unit text not null
);

create table public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  version integer not null default 1,
  effective_from date not null,
  ingredient_cost numeric(14,4),
  source text not null default 'supy_demo'
);
create index on public.recipe_versions (product_id);

create table public.canonical_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  business_date date not null,
  occurred_at timestamptz not null,
  status public.order_lifecycle not null default 'completed',
  channel text not null,
  fulfilment_type text not null,
  authoritative_source text not null,
  net_sales_ex_tax numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  charge_total numeric(14,2) not null default 0,
  customer_total numeric(14,2) not null default 0,
  refund_total numeric(14,2) not null default 0,
  covers integer,
  guest_id uuid,
  reconciliation_status public.recon_status not null default 'single_source',
  counts_in_revenue boolean not null default true
);
create index on public.canonical_orders (location_id, business_date);

create table public.order_source_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.canonical_orders(id) on delete cascade,
  provider text not null,
  external_id text not null,
  raw_status text,
  ingested_at timestamptz not null default now(),
  unique (org_id, provider, external_id)
);
create index on public.order_source_links (order_id);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.canonical_orders(id) on delete cascade,
  product_id uuid references public.products(id),
  quantity numeric(10,3) not null default 1,
  gross_ex_tax numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  net_ex_tax numeric(14,2) not null default 0
);
create index on public.order_lines (order_id);
create index on public.order_lines (product_id);

create table public.payment_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.canonical_orders(id) on delete cascade,
  tender text not null,
  amount numeric(14,2) not null
);

-- ============ INVENTORY ============
create table public.stock_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  as_of_date date not null,
  quantity numeric(14,3) not null,
  unit text not null,
  value_aed numeric(14,2) not null,
  reorder_threshold numeric(14,3),
  days_cover numeric(8,2),
  expiry_date date,
  source text not null default 'supy_demo',
  unique (location_id, ingredient_id, as_of_date)
);

create table public.waste_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id),
  occurred_on date not null,
  quantity numeric(14,3) not null,
  unit text not null,
  value_aed numeric(14,2) not null,
  reason text not null
);

-- ============ GUESTS ============
create table public.guest_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  first_seen_on date,
  is_identifiable boolean not null default true,
  behaviour_tag text,
  consent_marketing boolean not null default false
);

create table public.guest_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  guest_id uuid not null references public.guest_profiles(id) on delete cascade,
  masked_email text,
  masked_phone text,
  consent_source text,
  opted_out_at timestamptz
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  business_date date not null,
  scheduled_at timestamptz not null,
  party_size integer not null,
  expected_covers integer not null,
  seated_covers integer,
  status text not null,
  source text not null default 'eat_app_demo',
  guest_id uuid references public.guest_profiles(id),
  matched_order_id uuid references public.canonical_orders(id),
  match_confidence text not null default 'none'
);
create index on public.reservations (location_id, business_date);

-- ============ PEOPLE ============
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  legal_entity_id uuid references public.legal_entities(id),
  source_ref text,
  display_name text not null,
  role_title text,
  department text,
  status text not null default 'active',
  joined_on date,
  left_on date,
  manager_name text
);

create table public.restricted_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  doc_type text not null,
  masked_number text,
  issuing_authority text,
  jurisdiction text,
  issue_date date,
  expiry_date date,
  renewal_target_date date,
  verified_legal_deadline date,
  verification_status text not null default 'verification_needed',
  status public.doc_status not null default 'verification_needed',
  owner_name text,
  document_ref text,
  source_timestamp timestamptz
);
create index on public.restricted_documents (expiry_date);

create table public.renewal_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.restricted_documents(id) on delete cascade,
  threshold_days integer not null,
  due_date date not null,
  status text not null default 'open',
  owner_name text,
  notes text,
  created_at timestamptz not null default now(),
  unique (document_id, threshold_days)
);

-- ============ INVESTORS / FINANCE ============
create table public.investors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  display_name text not null,
  contact_note text
);

create table public.capital_commitments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  investor_id uuid not null references public.investors(id) on delete cascade,
  legal_entity_id uuid not null references public.legal_entities(id),
  instrument_type text not null default 'equity',
  share_class text,
  committed_amount numeric(16,2) not null,
  currency text not null default 'AED',
  ownership_pct numeric(9,6),
  effective_from date not null,
  tranche_label text
);

create table public.contribution_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  commitment_id uuid not null references public.capital_commitments(id) on delete cascade,
  paid_on date not null,
  amount numeric(16,2) not null,
  reference text
);

create table public.distribution_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  commitment_id uuid not null references public.capital_commitments(id) on delete cascade,
  paid_on date not null,
  amount numeric(16,2) not null,
  kind text not null default 'dividend',
  reference text
);

create table public.valuations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  legal_entity_id uuid not null references public.legal_entities(id) on delete cascade,
  valuation_date date not null,
  equity_value numeric(18,2),
  per_share_value numeric(18,6),
  currency text not null default 'AED',
  method text,
  basis text,
  assumptions text,
  share_class text,
  status public.valuation_status not null default 'draft',
  prepared_by text,
  approved_by text,
  approved_at timestamptz,
  published_at timestamptz,
  evidence_ref text
);

create table public.published_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  legal_entity_id uuid references public.legal_entities(id) on delete cascade,
  title text not null,
  period_start date,
  period_end date,
  period_close_status text not null default 'preliminary',
  body text,
  published_at timestamptz,
  revision integer not null default 1
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  period_month date not null,
  net_sales_target numeric(14,2) not null,
  unique (location_id, period_month)
);

-- ============ APPLICATION ============
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  kind text not null,
  severity text not null default 'medium',
  title text not null,
  detail text,
  evidence jsonb not null default '{}'::jsonb,
  status public.alert_status not null default 'open',
  owner_name text,
  due_date date,
  source_freshness timestamptz,
  created_at timestamptz not null default now()
);

create table public.metric_definitions (
  key text primary key,
  label text not null,
  formula text not null,
  version integer not null default 1,
  notes text
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  actor uuid,
  action text not null,
  target text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  title text not null default 'New conversation',
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.chat_messages (session_id);

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  page text not null,
  params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============ GRANTS + RLS ============
do $$ declare r record; begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', r.tablename);
    execute format('grant all on public.%I to service_role', r.tablename);
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-- ============ ACCESS HELPERS ============
create or replace function public.is_member(_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.user_id = auth.uid() and m.active and m.org_id = _org);
$$;

create or replace function public.has_permission(_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    join role_permissions rp on rp.role_preset = m.role_preset
    where m.user_id = auth.uid() and m.active and rp.permission = _perm
  );
$$;

create or replace function public.has_location_access(_loc uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from memberships m
    join scope_grants sg on sg.membership_id = m.id
    join locations l on l.id = _loc
    where m.user_id = auth.uid() and m.active and m.org_id = l.org_id
      and (sg.expires_at is null or sg.expires_at > now())
      and (
        sg.scope_type = 'all'
        or (sg.scope_type = 'location' and sg.ref_id = l.id)
        or (sg.scope_type = 'brand' and sg.ref_id = l.brand_id)
        or (sg.scope_type = 'entity' and sg.ref_id = l.legal_entity_id)
      )
  );
$$;

create or replace function public.my_investor_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select sg.ref_id
  from memberships m
  join scope_grants sg on sg.membership_id = m.id
  where m.user_id = auth.uid() and m.active and sg.scope_type = 'investor' and sg.ref_id is not null
    and (sg.expires_at is null or sg.expires_at > now());
$$;

create or replace function public.my_entitled_entity_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct cc.legal_entity_id
  from capital_commitments cc
  where cc.investor_id in (select public.my_investor_ids());
$$;

grant execute on function public.is_member(uuid), public.has_permission(text), public.has_location_access(uuid), public.my_investor_ids(), public.my_entitled_entity_ids() to authenticated;

-- ============ POLICIES ============
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "member orgs" on public.organizations for select to authenticated using (public.is_member(id));
create policy "own memberships" on public.memberships for select to authenticated using (user_id = auth.uid() or public.has_permission('manage_access'));
create policy "role permission catalogue" on public.role_permissions for select to authenticated using (true);
create policy "own scope grants" on public.scope_grants for select to authenticated using (
  public.has_permission('manage_access') or exists (select 1 from memberships m where m.id = membership_id and m.user_id = auth.uid())
);
create policy "member entities" on public.legal_entities for select to authenticated using (
  public.is_member(org_id) and (public.has_permission('view_finance') or public.has_permission('view_overview') or id in (select public.my_entitled_entity_ids()))
);
create policy "member brands" on public.brands for select to authenticated using (public.is_member(org_id));
create policy "scoped locations" on public.locations for select to authenticated using (public.is_member(org_id) and public.has_location_access(id));

create policy "member integrations" on public.integrations for select to authenticated using (public.is_member(org_id));
create policy "admin integrations write" on public.integrations for update to authenticated using (public.has_permission('manage_integrations')) with check (public.has_permission('manage_integrations'));
create policy "member mappings" on public.external_entity_mappings for select to authenticated using (public.is_member(org_id) and public.has_permission('manage_integrations'));
create policy "member dq" on public.data_quality_issues for select to authenticated using (public.is_member(org_id));

create policy "scoped products" on public.products for select to authenticated using (public.has_permission('view_menu') and public.has_location_access(location_id));
create policy "menu ingredients" on public.ingredients for select to authenticated using (public.is_member(org_id) and (public.has_permission('view_inventory') or public.has_permission('view_menu')));
create policy "scoped recipes" on public.recipe_versions for select to authenticated using (
  public.has_permission('view_menu') and exists (select 1 from products p where p.id = product_id and public.has_location_access(p.location_id))
);

create policy "scoped orders" on public.canonical_orders for select to authenticated using (public.has_permission('view_sales') and public.has_location_access(location_id));
create policy "scoped order links" on public.order_source_links for select to authenticated using (
  exists (select 1 from canonical_orders o where o.id = order_id and public.has_permission('view_sales') and public.has_location_access(o.location_id))
);
create policy "scoped order lines" on public.order_lines for select to authenticated using (
  exists (select 1 from canonical_orders o where o.id = order_id and public.has_permission('view_sales') and public.has_location_access(o.location_id))
);
create policy "scoped payments" on public.payment_entries for select to authenticated using (
  exists (select 1 from canonical_orders o where o.id = order_id and public.has_permission('view_sales') and public.has_location_access(o.location_id))
);

create policy "scoped stock" on public.stock_snapshots for select to authenticated using (public.has_permission('view_inventory') and public.has_location_access(location_id));
create policy "scoped waste" on public.waste_entries for select to authenticated using (public.has_permission('view_inventory') and public.has_location_access(location_id));

create policy "guest profiles" on public.guest_profiles for select to authenticated using (public.is_member(org_id) and public.has_permission('view_guests'));
create policy "guest contacts" on public.guest_contacts for select to authenticated using (public.is_member(org_id) and public.has_permission('view_guest_pii'));
create policy "scoped reservations" on public.reservations for select to authenticated using (public.has_permission('view_guests') and public.has_location_access(location_id));

create policy "scoped employees" on public.employees for select to authenticated using (
  public.has_permission('view_people') and (location_id is null and public.is_member(org_id) or public.has_location_access(location_id))
);
create policy "documents" on public.restricted_documents for select to authenticated using (
  public.has_permission('view_people_documents') and exists (select 1 from employees e where e.id = employee_id and public.is_member(e.org_id))
);
create policy "renewal tasks" on public.renewal_tasks for select to authenticated using (public.is_member(org_id) and public.has_permission('view_people_documents'));
create policy "renewal tasks update" on public.renewal_tasks for update to authenticated using (public.is_member(org_id) and public.has_permission('view_people_documents')) with check (public.is_member(org_id) and public.has_permission('view_people_documents'));

create policy "investors visibility" on public.investors for select to authenticated using (
  public.is_member(org_id) and (public.has_permission('manage_investors') or id in (select public.my_investor_ids()))
);
create policy "commitments visibility" on public.capital_commitments for select to authenticated using (
  public.is_member(org_id) and (public.has_permission('manage_investors') or investor_id in (select public.my_investor_ids()))
);
create policy "contributions visibility" on public.contribution_entries for select to authenticated using (
  exists (select 1 from capital_commitments c where c.id = commitment_id and (public.has_permission('manage_investors') or c.investor_id in (select public.my_investor_ids())))
);
create policy "distributions visibility" on public.distribution_entries for select to authenticated using (
  exists (select 1 from capital_commitments c where c.id = commitment_id and (public.has_permission('manage_investors') or c.investor_id in (select public.my_investor_ids())))
);
create policy "valuations visibility" on public.valuations for select to authenticated using (
  public.is_member(org_id) and (
    public.has_permission('manage_investors')
    or (status = 'published' and legal_entity_id in (select public.my_entitled_entity_ids()))
  )
);
create policy "published reports visibility" on public.published_reports for select to authenticated using (
  public.is_member(org_id) and (
    public.has_permission('view_finance')
    or (published_at is not null and legal_entity_id in (select public.my_entitled_entity_ids()))
  )
);
create policy "budgets visibility" on public.budgets for select to authenticated using (
  public.has_permission('view_finance') and public.has_location_access(location_id)
);

create policy "alerts visibility" on public.alerts for select to authenticated using (
  public.has_permission('view_alerts') and (location_id is null and public.is_member(org_id) or public.has_location_access(location_id))
);
create policy "alerts update" on public.alerts for update to authenticated using (
  public.has_permission('view_alerts') and (location_id is null and public.is_member(org_id) or public.has_location_access(location_id))
) with check (
  public.has_permission('view_alerts') and (location_id is null and public.is_member(org_id) or public.has_location_access(location_id))
);

create policy "metric definitions" on public.metric_definitions for select to authenticated using (true);
create policy "audit read" on public.audit_events for select to authenticated using (public.has_permission('manage_access'));

create policy "own chat sessions" on public.chat_sessions for select to authenticated using (user_id = auth.uid());
create policy "own chat sessions insert" on public.chat_sessions for insert to authenticated with check (user_id = auth.uid() and public.is_member(org_id));
create policy "own chat sessions update" on public.chat_sessions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own chat sessions delete" on public.chat_sessions for delete to authenticated using (user_id = auth.uid());
create policy "own chat messages" on public.chat_messages for select to authenticated using (user_id = auth.uid());
create policy "own chat messages insert" on public.chat_messages for insert to authenticated with check (user_id = auth.uid() and public.is_member(org_id));
create policy "own saved views" on public.saved_views for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(org_id));

-- ============ ROLE PERMISSION PRESETS ============
insert into public.role_permissions (role_preset, permission) values
('leadership','view_overview'),('leadership','view_sales'),('leadership','view_menu'),('leadership','view_inventory'),('leadership','view_guests'),('leadership','view_marketing'),('leadership','view_people'),('leadership','view_finance'),('leadership','view_alerts'),('leadership','use_bot'),
('finance','view_overview'),('finance','view_sales'),('finance','view_menu'),('finance','view_finance'),('finance','view_inventory'),('finance','view_alerts'),('finance','use_bot'),
('investor_relations','view_overview'),('investor_relations','view_finance'),('investor_relations','manage_investors'),('investor_relations','publish_valuations'),('investor_relations','view_alerts'),('investor_relations','use_bot'),
('restaurant_manager','view_overview'),('restaurant_manager','view_sales'),('restaurant_manager','view_menu'),('restaurant_manager','view_inventory'),('restaurant_manager','view_guests'),('restaurant_manager','view_people'),('restaurant_manager','view_alerts'),('restaurant_manager','use_bot'),
('inventory_procurement','view_overview'),('inventory_procurement','view_menu'),('inventory_procurement','view_inventory'),('inventory_procurement','view_alerts'),('inventory_procurement','use_bot'),
('marketing','view_overview'),('marketing','view_menu'),('marketing','view_guests'),('marketing','view_marketing'),('marketing','view_alerts'),('marketing','use_bot'),
('hr_pro','view_overview'),('hr_pro','view_people'),('hr_pro','view_people_documents'),('hr_pro','view_alerts'),('hr_pro','use_bot'),
('investor','view_investor_portal'),('investor','use_bot'),
('tech_admin','manage_integrations'),('tech_admin','manage_access'),('tech_admin','view_alerts'),('tech_admin','use_bot');

-- ============ METRIC REGISTRY ============
insert into public.metric_definitions (key, label, formula, version, notes) values
('net_sales','Net sales (excl. tax)','Eligible gross sales excluding tax minus allocated discounts and approved sales reversals. Service charges shown separately.',1,'Only orders from the configured authoritative source for the venue/period are aggregated.'),
('orders','Completed orders','Count of eligible completed canonical orders, deduplicated across providers.',1,'Duplicate provider records for the same economic sale count once.'),
('aov','Average order value','Eligible order sales / eligible completed orders.',1,'Refunded amounts are deducted from sales, not from order counts.'),
('covers','Seated covers','Sum of actual seated covers from matched reservations and recorded walk-ins.',1,'Booking contacts are not covers.'),
('spend_per_cover','Spend per cover','Eligible matched sales / actual matched seated covers.',1,'Coverage percentage is published with the figure.'),
('recipe_contribution','Ingredient contribution','Net item sales excluding tax minus effective recipe ingredient cost.',1,'This is not net profit and not accounting COGS.'),
('theoretical_food_cost','Theoretical ingredient cost %','Effective recipe ingredient cost / net item sales.',1,'Actual food cost requires approved COGS from accounting.'),
('waste_cost','Waste cost','Sum of valued waste entries for the period.',1,'Not subtracted twice where already reflected in stock depletion.'),
('no_show_rate','No-show rate','No-show reservations / eligible reservations.',1,'Denominator excludes cancelled-by-venue reservations.'),
('repeat_guest_rate','Repeat booking-guest rate','Returning identifiable booking guests / identifiable booking guests in window.',1,'Limited to available history.'),
('pct_change','Percentage change','(current - baseline) / baseline over matched periods.',1,'Zero baseline shows N/A or New, never infinity.'),
('stake_value','Indicative stake value','Latest approved equity value x applicable ownership, or eligible shares x approved per-share value.',1,'Not a guaranteed realizable exit price.');
