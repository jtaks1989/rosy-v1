REVOKE ALL ON FUNCTION public.refresh_mart_menu_engineering_daily() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_refresh_mart_menu_engineering_daily() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_mart_menu_engineering_daily() TO service_role;

CREATE OR REPLACE FUNCTION public.rosy_menu_engineering_period(p_from date, p_to date, p_locations uuid[] DEFAULT NULL::uuid[], p_categories text[] DEFAULT NULL::text[], p_channels text[] DEFAULT NULL::text[], p_fulfilment text[] DEFAULT NULL::text[], p_dayparts text[] DEFAULT NULL::text[], p_day_type text DEFAULT NULL::text, p_min_units numeric DEFAULT 10, p_min_days integer DEFAULT 14, p_pop_factor numeric DEFAULT 0.7, p_profit_method text DEFAULT 'median'::text, p_fixed_threshold numeric DEFAULT NULL::numeric, p_consolidated boolean DEFAULT false, p_peer_scope text DEFAULT 'scope'::text)
 RETURNS TABLE(item_key text, product_id uuid, item_name text, category text, brand_name text, location_id uuid, location_name text, pos_item_id text, units numeric, net_revenue numeric, discounts numeric, avg_price numeric, recipe_cost numeric, contribution_per_unit numeric, contribution_pct numeric, total_contribution numeric, mix_pct numeric, cost_coverage_pct numeric, popularity_threshold_pct numeric, profit_threshold numeric, profit_method text, peer_items integer, peer_label text, quadrant text, confidence text, exclusion_reason text, active_days integer, first_sale date, last_sale date, cost_effective_from date, cost_source text, source_systems text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with allowed as (
    select l.id from public.locations l where public.has_location_access(l.id)
  ),
  f as (
    select m.*
    from public.mart_menu_engineering_daily m
    where m.business_date between p_from and p_to
      and m.location_id in (select id from allowed)
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
$function$;

REVOKE ALL ON FUNCTION public.rosy_menu_engineering_period(date,date,uuid[],text[],text[],text[],text[],text,numeric,integer,numeric,text,numeric,boolean,text) FROM PUBLIC, anon, authenticated;