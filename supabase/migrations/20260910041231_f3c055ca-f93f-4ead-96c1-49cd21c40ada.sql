CREATE OR REPLACE FUNCTION public.rosy_menu_performance(p_from date, p_to date, p_locations uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(product_id uuid, item_name text, category text, pos_item_id text, location_id uuid, location_name text, units numeric, net_revenue numeric, discounts numeric, avg_price numeric, recipe_cost numeric, contribution_per_unit numeric, contribution_pct numeric, sales_mix_pct numeric, margin_available boolean, available boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with allowed as (
    select l.id from public.locations l where public.has_location_access(l.id)
  ),
  base as (
    select
      m.product_id,
      max(m.item_name) as item_name,
      max(m.category) as category,
      max(m.pos_item_id) as pos_item_id,
      max(m.location_id::text)::uuid as location_id,
      max(m.location_name) as location_name,
      bool_or(m.is_available) as is_available,
      sum(m.units) as units,
      sum(m.net_revenue) as net,
      sum(m.discounts) as disc,
      sum(case when m.recipe_cost_per_unit is not null then m.recipe_cost_per_unit * m.units else 0 end) as cost,
      bool_or(m.recipe_cost_per_unit is not null) as has_cost
    from public.mart_menu_engineering_daily m
    where m.business_date between p_from and p_to
      and m.location_id in (select id from allowed)
      and (p_locations is null or m.location_id = any(p_locations))
    group by m.product_id
  ), total as (select sum(net) n from base)
  select b.product_id, b.item_name, b.category, b.pos_item_id, b.location_id, b.location_name,
    b.units, b.net, b.disc,
    case when b.units = 0 then null else round(b.net / b.units, 2) end,
    case when b.has_cost then round(b.cost / nullif(b.units,0), 2) else null end,
    case when b.has_cost then round((b.net - b.cost) / nullif(b.units,0), 2) else null end,
    case when b.has_cost and b.net <> 0 then round(100.0 * (b.net - b.cost) / b.net, 1) else null end,
    case when (select n from total) > 0 then round(100.0 * b.net / (select n from total), 2) else null end,
    b.has_cost, b.is_available
  from base b
  order by b.net desc;
$function$;

REVOKE ALL ON FUNCTION public.rosy_menu_performance(date,date,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rosy_menu_performance(date,date,uuid[]) TO authenticated, service_role;