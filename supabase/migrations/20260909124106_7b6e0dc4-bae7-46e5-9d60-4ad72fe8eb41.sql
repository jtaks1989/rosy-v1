-- Menu Engineering governed reporting layer (additive, read-only)

create or replace view public.mart_menu_engineering as
select
  o.org_id,
  o.business_date,
  o.location_id,
  l.name as location_name,
  b.name as brand_name,
  p.id as product_id,
  p.name as item_name,
  p.category,
  p.pos_item_id,
  p.is_available,
  o.channel,
  o.fulfilment_type,
  case
    when extract(hour from (o.occurred_at at time zone l.timezone)) < 11 then 'breakfast'
    when extract(hour from (o.occurred_at at time zone l.timezone)) < 16 then 'lunch'
    when extract(hour from (o.occurred_at at time zone l.timezone)) < 23 then 'dinner'
    else 'late_night'
  end as daypart,
  case when extract(isodow from o.business_date) in (6, 7) then 'weekend' else 'weekday' end as day_type,
  ol.quantity as units,
  ol.net_ex_tax as net_revenue,
  ol.gross_ex_tax as gross_revenue,
  ol.discount_amount as discounts,
  rc.cost as recipe_cost_per_unit,
  rc.effective_from as cost_effective_from,
  rc.source as cost_source,
  o.authoritative_source as source_system,
  o.reconciliation_status,
  ol.order_id,
  ol.id as order_line_id
from public.order_lines ol
join public.canonical_orders o on o.id = ol.order_id
join public.products p on p.id = ol.product_id
join public.locations l on l.id = p.location_id
left join public.brands b on b.id = l.brand_id
left join lateral (
  select rv.ingredient_cost as cost, rv.effective_from, rv.source
  from public.recipe_versions rv
  where rv.product_id = ol.product_id
    and rv.effective_from <= o.business_date
    and rv.ingredient_cost is not null
  order by rv.effective_from desc
  limit 1
) rc on true
where o.counts_in_revenue
  and o.status in ('completed', 'partially_refunded');

grant select on public.mart_menu_engineering to authenticated;

create or replace function public.rosy_menu_engineering_period(
  p_from date,
  p_to date,
  p_locations uuid[] default null,
  p_categories text[] default null,
  p_channels text[] default null,
  p_fulfilment text[] default null,
  p_dayparts text[] default null,
  p_day_type text default null,
  p_min_units numeric default 10,
  p_min_days integer default 14,
  p_pop_factor numeric default 0.7,
  p_profit_method text default 'median',
  p_fixed_threshold numeric default null,
  p_consolidated boolean default false,
  p_peer_scope text default 'scope'
)
returns table (
  item_key text,
  product_id uuid,
  item_name text,
  category text,
  brand_name text,
  location_id uuid,
  location_name text,
  pos_item_id text,
  units numeric,
  net_revenue numeric,
  discounts numeric,
  avg_price numeric,
  recipe_cost numeric,
  contribution_per_unit numeric,
  contribution_pct numeric,
  total_contribution numeric,
  mix_pct numeric,
  cost_coverage_pct numeric,
  popularity_threshold_pct numeric,
  profit_threshold numeric,
  profit_method text,
  peer_items integer,
  peer_label text,
  quadrant text,
  confidence text,
  exclusion_reason text,
  active_days integer,
  first_sale date,
  last_sale date,
  cost_effective_from date,
  cost_source text,
  source_systems text
)
language sql
stable
set search_path = public
as $$
  with f as (
    select m.*
    from public.mart_menu_engineering m
    where m.business_date between p_from and p_to
      and (p_locations is null or m.location_id = any(p_locations))
      and (p_categories is null or m.category = any(p_categories))
      and (p_channels is null or m.channel = any(p_channels))
      and (p_fulfilment is null or m.fulfilment_type = any(p_fulfilment))
      and (p_dayparts is null or m.daypart = any(p_dayparts))
      and (p_day_type is null or m.day_type = p_day_type)
  ),
  agg as (
    select
      case when p_consolidated
        then lower(m.item_name) || '|' || coalesce(lower(m.category), '')
        else m.product_id::text end as item_key,
      case when p_consolidated then null else max(m.product_id::text)::uuid end as product_id,
      max(m.item_name) as item_name,
      max(m.category) as category,
      case when count(distinct m.brand_name) > 1 then 'Multiple brands' else max(m.brand_name) end as brand_name,
      case when p_consolidated and count(distinct m.location_id) > 1 then null else max(m.location_id::text)::uuid end as location_id,
      case when count(distinct m.location_id) > 1
        then count(distinct m.location_id)::text || ' venues'
        else max(m.location_name) end as location_name,
      string_agg(distinct m.pos_item_id, ', ') as pos_item_id,
      sum(m.units) as units,
      sum(m.net_revenue) as net_revenue,
      sum(m.discounts) as discounts,
      sum(case when m.recipe_cost_per_unit is not null then m.recipe_cost_per_unit * m.units end) as costed_cost,
      sum(case when m.recipe_cost_per_unit is not null then m.units end) as costed_units,
      max(m.cost_effective_from) as cost_effective_from,
      string_agg(distinct m.cost_source, ', ') as cost_source,
      count(distinct m.business_date)::int as active_days,
      min(m.business_date) as first_sale,
      max(m.business_date) as last_sale,
      string_agg(distinct m.source_system, ', ') as source_systems,
      case
        when p_peer_scope = 'venue' and not p_consolidated
          then max(m.location_name) || ' · ' || coalesce(max(m.category), 'Uncategorised')
        else coalesce(max(m.category), 'Uncategorised')
      end as peer_label
    from f m
    group by case when p_consolidated
      then lower(m.item_name) || '|' || coalesce(lower(m.category), '')
      else m.product_id::text end
  ),
  calc as (
    select
      a.*,
      case when a.units > 0 then round(a.net_revenue / a.units, 4) end as avg_price,
      case when coalesce(a.costed_units, 0) > 0 then round(a.costed_cost / a.costed_units, 4) end as cost_per_unit,
      case when a.units > 0 then round(100.0 * coalesce(a.costed_units, 0) / a.units, 1) else 0 end as cost_coverage_pct
    from agg a
  ),
  calc2 as (
    select
      c.*,
      case when c.cost_per_unit is not null and c.avg_price is not null
        then round(c.avg_price - c.cost_per_unit, 4) end as cpu,
      case
        when c.units <= 0 then 'no_eligible_units'
        when c.avg_price is null or c.avg_price <= 0 then 'invalid_data'
        when c.cost_per_unit is null then 'missing_recipe_cost'
        when c.units < p_min_units then 'insufficient_sales_history'
        when c.active_days < p_min_days then 'insufficient_availability_history'
      end as base_exclusion
    from calc c
  ),
  peers as (
    select
      peer_label,
      sum(units) as peer_units,
      count(*)::int as peer_items,
      (percentile_cont(0.5) within group (order by cpu))::numeric as median_cpu,
      sum(cpu * units) / nullif(sum(units), 0) as weighted_cpu
    from calc2
    where base_exclusion is null
    group by peer_label
  ),
  joined as (
    select
      c.*,
      p.peer_units,
      coalesce(p.peer_items, 0) as peer_items_n,
      case
        when p_profit_method = 'fixed' then p_fixed_threshold
        when p_profit_method = 'weighted' then round(p.weighted_cpu, 4)
        else round(p.median_cpu, 4)
      end as profit_threshold_v,
      case when p.peer_items > 0 then round(100.0 * p_pop_factor / p.peer_items, 4) end as pop_threshold,
      case when p.peer_units > 0 then round(100.0 * c.units / p.peer_units, 4) end as mix
    from calc2 c
    left join peers p on p.peer_label = c.peer_label
  )
  select
    j.item_key,
    j.product_id,
    j.item_name,
    j.category,
    j.brand_name,
    j.location_id,
    j.location_name,
    j.pos_item_id,
    j.units,
    round(j.net_revenue, 2) as net_revenue,
    round(j.discounts, 2) as discounts,
    round(j.avg_price, 2) as avg_price,
    round(j.cost_per_unit, 2) as recipe_cost,
    round(j.cpu, 2) as contribution_per_unit,
    case when j.cpu is not null and j.avg_price > 0 then round(100.0 * j.cpu / j.avg_price, 1) end as contribution_pct,
    case when j.cpu is not null then round(j.cpu * j.units, 2) end as total_contribution,
    j.mix as mix_pct,
    j.cost_coverage_pct,
    j.pop_threshold as popularity_threshold_pct,
    j.profit_threshold_v as profit_threshold,
    p_profit_method as profit_method,
    j.peer_items_n as peer_items,
    j.peer_label,
    case
      when j.base_exclusion is not null then null
      when j.peer_items_n < 3 then null
      when j.profit_threshold_v is null or j.pop_threshold is null or j.mix is null then null
      when j.mix >= j.pop_threshold and j.cpu >= j.profit_threshold_v then 'star'
      when j.mix >= j.pop_threshold then 'plowhorse'
      when j.cpu >= j.profit_threshold_v then 'puzzle'
      else 'dog'
    end as quadrant,
    case
      when j.base_exclusion is not null or j.peer_items_n < 3 then 'insufficient'
      when j.units >= p_min_units * 2 and j.active_days >= p_min_days and j.cost_coverage_pct >= 99 then 'high'
      when j.units >= p_min_units * 1.5 and j.cost_coverage_pct >= 90 then 'medium'
      else 'low'
    end as confidence,
    case
      when j.base_exclusion is not null then j.base_exclusion
      when j.peer_items_n < 3 then 'category_too_few_comparable_items'
    end as exclusion_reason,
    j.active_days,
    j.first_sale,
    j.last_sale,
    j.cost_effective_from,
    j.cost_source,
    j.source_systems
  from joined j
  order by j.net_revenue desc;
$$;

create or replace function public.rosy_menu_engineering(
  p_from date,
  p_to date,
  p_prev_from date default null,
  p_prev_to date default null,
  p_locations uuid[] default null,
  p_categories text[] default null,
  p_channels text[] default null,
  p_fulfilment text[] default null,
  p_dayparts text[] default null,
  p_day_type text default null,
  p_min_units numeric default 10,
  p_min_days integer default 14,
  p_pop_factor numeric default 0.7,
  p_profit_method text default 'median',
  p_fixed_threshold numeric default null,
  p_consolidated boolean default false,
  p_peer_scope text default 'scope'
)
returns table (
  item_key text,
  product_id uuid,
  item_name text,
  category text,
  brand_name text,
  location_id uuid,
  location_name text,
  pos_item_id text,
  units numeric,
  net_revenue numeric,
  discounts numeric,
  avg_price numeric,
  recipe_cost numeric,
  contribution_per_unit numeric,
  contribution_pct numeric,
  total_contribution numeric,
  mix_pct numeric,
  cost_coverage_pct numeric,
  popularity_threshold_pct numeric,
  profit_threshold numeric,
  profit_method text,
  peer_items integer,
  peer_label text,
  quadrant text,
  confidence text,
  exclusion_reason text,
  active_days integer,
  first_sale date,
  last_sale date,
  cost_effective_from date,
  cost_source text,
  source_systems text,
  prev_quadrant text,
  prev_units numeric,
  prev_avg_price numeric,
  prev_recipe_cost numeric,
  prev_contribution_per_unit numeric,
  prev_mix_pct numeric,
  prev_total_contribution numeric
)
language sql
stable
set search_path = public
as $$
  with cur as (
    select * from public.rosy_menu_engineering_period(
      p_from, p_to, p_locations, p_categories, p_channels, p_fulfilment, p_dayparts, p_day_type,
      p_min_units, p_min_days, p_pop_factor, p_profit_method, p_fixed_threshold, p_consolidated, p_peer_scope)
  ),
  prev as (
    select * from public.rosy_menu_engineering_period(
      coalesce(p_prev_from, p_from), coalesce(p_prev_to, p_to), p_locations, p_categories, p_channels,
      p_fulfilment, p_dayparts, p_day_type, p_min_units, p_min_days, p_pop_factor, p_profit_method,
      p_fixed_threshold, p_consolidated, p_peer_scope)
    where p_prev_from is not null and p_prev_to is not null
  )
  select
    c.item_key, c.product_id, c.item_name, c.category, c.brand_name, c.location_id, c.location_name,
    c.pos_item_id, c.units, c.net_revenue, c.discounts, c.avg_price, c.recipe_cost, c.contribution_per_unit,
    c.contribution_pct, c.total_contribution, c.mix_pct, c.cost_coverage_pct, c.popularity_threshold_pct,
    c.profit_threshold, c.profit_method, c.peer_items, c.peer_label, c.quadrant, c.confidence,
    c.exclusion_reason, c.active_days, c.first_sale, c.last_sale, c.cost_effective_from, c.cost_source,
    c.source_systems,
    p.quadrant, p.units, p.avg_price, p.recipe_cost, p.contribution_per_unit, p.mix_pct, p.total_contribution
  from cur c
  left join prev p on p.item_key = c.item_key
  order by c.net_revenue desc;
$$;

create or replace function public.rosy_menu_item_trend(
  p_product uuid,
  p_from date,
  p_to date,
  p_locations uuid[] default null
)
returns table (
  business_date date,
  units numeric,
  net_revenue numeric,
  avg_price numeric,
  recipe_cost numeric,
  contribution_per_unit numeric,
  total_contribution numeric
)
language sql
stable
set search_path = public
as $$
  select
    m.business_date,
    sum(m.units),
    round(sum(m.net_revenue), 2),
    case when sum(m.units) > 0 then round(sum(m.net_revenue) / sum(m.units), 2) end,
    case when sum(case when m.recipe_cost_per_unit is not null then m.units end) > 0
      then round(sum(case when m.recipe_cost_per_unit is not null then m.recipe_cost_per_unit * m.units end)
        / sum(case when m.recipe_cost_per_unit is not null then m.units end), 2) end,
    case when sum(case when m.recipe_cost_per_unit is not null then m.units end) > 0 and sum(m.units) > 0
      then round(sum(m.net_revenue) / sum(m.units)
        - sum(case when m.recipe_cost_per_unit is not null then m.recipe_cost_per_unit * m.units end)
        / sum(case when m.recipe_cost_per_unit is not null then m.units end), 2) end,
    case when sum(case when m.recipe_cost_per_unit is not null then m.units end) > 0 and sum(m.units) > 0
      then round((sum(m.net_revenue) / sum(m.units)
        - sum(case when m.recipe_cost_per_unit is not null then m.recipe_cost_per_unit * m.units end)
        / sum(case when m.recipe_cost_per_unit is not null then m.units end)) * sum(m.units), 2) end
  from public.mart_menu_engineering m
  where m.product_id = p_product
    and m.business_date between p_from and p_to
    and (p_locations is null or m.location_id = any(p_locations))
  group by m.business_date
  order by m.business_date;
$$;

create or replace function public.rosy_menu_item_channels(
  p_product uuid,
  p_from date,
  p_to date
)
returns table (
  channel text,
  fulfilment_type text,
  units numeric,
  net_revenue numeric,
  avg_price numeric,
  recipe_cost numeric,
  contribution_per_unit numeric
)
language sql
stable
set search_path = public
as $$
  select
    m.channel,
    m.fulfilment_type,
    sum(m.units),
    round(sum(m.net_revenue), 2),
    case when sum(m.units) > 0 then round(sum(m.net_revenue) / sum(m.units), 2) end,
    case when sum(case when m.recipe_cost_per_unit is not null then m.units end) > 0
      then round(sum(case when m.recipe_cost_per_unit is not null then m.recipe_cost_per_unit * m.units end)
        / sum(case when m.recipe_cost_per_unit is not null then m.units end), 2) end,
    case when sum(case when m.recipe_cost_per_unit is not null then m.units end) > 0 and sum(m.units) > 0
      then round(sum(m.net_revenue) / sum(m.units)
        - sum(case when m.recipe_cost_per_unit is not null then m.recipe_cost_per_unit * m.units end)
        / sum(case when m.recipe_cost_per_unit is not null then m.units end), 2) end
  from public.mart_menu_engineering m
  where m.product_id = p_product
    and m.business_date between p_from and p_to
  group by m.channel, m.fulfilment_type
  order by sum(m.net_revenue) desc;
$$;

create or replace function public.rosy_menu_item_venues(
  p_item_name text,
  p_from date,
  p_to date,
  p_locations uuid[] default null
)
returns table (
  location_id uuid,
  location_name text,
  brand_name text,
  units numeric,
  net_revenue numeric,
  avg_price numeric,
  recipe_cost numeric,
  contribution_per_unit numeric,
  category_mix_pct numeric
)
language sql
stable
set search_path = public
as $$
  with base as (
    select m.location_id, m.location_name, m.brand_name, m.category,
      sum(m.units) units, sum(m.net_revenue) net,
      sum(case when m.recipe_cost_per_unit is not null then m.recipe_cost_per_unit * m.units end) cost,
      sum(case when m.recipe_cost_per_unit is not null then m.units end) costed_units
    from public.mart_menu_engineering m
    where lower(m.item_name) = lower(p_item_name)
      and m.business_date between p_from and p_to
      and (p_locations is null or m.location_id = any(p_locations))
    group by m.location_id, m.location_name, m.brand_name, m.category
  ),
  cat as (
    select m.location_id, m.category, sum(m.units) cat_units
    from public.mart_menu_engineering m
    where m.business_date between p_from and p_to
      and (p_locations is null or m.location_id = any(p_locations))
    group by m.location_id, m.category
  )
  select b.location_id, b.location_name, b.brand_name, b.units, round(b.net, 2),
    case when b.units > 0 then round(b.net / b.units, 2) end,
    case when b.costed_units > 0 then round(b.cost / b.costed_units, 2) end,
    case when b.costed_units > 0 and b.units > 0 then round(b.net / b.units - b.cost / b.costed_units, 2) end,
    case when c.cat_units > 0 then round(100.0 * b.units / c.cat_units, 2) end
  from base b
  left join cat c on c.location_id = b.location_id and c.category is not distinct from b.category
  order by b.net desc;
$$;