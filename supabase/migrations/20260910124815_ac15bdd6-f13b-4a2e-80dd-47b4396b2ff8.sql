create or replace function public.rosy_scope_locations(_perm text, _locations uuid[] default null)
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select l.id
  from public.locations l
  where public.is_member(l.org_id)
    and public.has_permission(_perm)
    and public.has_location_access(l.id)
    and (_locations is null or l.id = any(_locations));
$$;

revoke all on function public.rosy_scope_locations(text, uuid[]) from public;
revoke all on function public.rosy_scope_locations(text, uuid[]) from anon;
grant execute on function public.rosy_scope_locations(text, uuid[]) to authenticated, service_role;

create or replace function public.rosy_sales_summary(p_from date, p_to date, p_locations uuid[] default null::uuid[])
returns table(net_sales numeric, orders bigint, discounts numeric, tax numeric, charges numeric, refunds numeric, customer_total numeric, covers bigint, aov numeric, cancelled_orders bigint, excluded_orders bigint, excluded_amount numeric, matched_sales numeric, matched_covers bigint, spend_per_cover numeric, cover_coverage_pct numeric)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with scope as (select public.rosy_scope_locations('view_sales', p_locations) id),
  o as (
    select c.* from canonical_orders c
    join scope s on s.id = c.location_id
    where c.business_date between p_from and p_to
  ), inc as (
    select * from o where counts_in_revenue and status in ('completed','partially_refunded')
  ), m as (
    select coalesce(sum(r.seated_covers),0)::bigint mc,
           coalesce(sum(i.net_sales_ex_tax - i.refund_total),0) ms
    from reservations r join inc i on i.id = r.matched_order_id
    where r.match_confidence = 'high'
  )
  select
    coalesce(sum(i.net_sales_ex_tax - i.refund_total),0),
    count(*)::bigint,
    coalesce(sum(i.discount_total),0),
    coalesce(sum(i.tax_total),0),
    coalesce(sum(i.charge_total),0),
    coalesce(sum(i.refund_total),0),
    coalesce(sum(i.customer_total),0),
    coalesce(sum(i.covers),0)::bigint,
    case when count(*) = 0 then null else round(coalesce(sum(i.net_sales_ex_tax - i.refund_total),0) / count(*), 2) end,
    (select count(*) from o where status = 'cancelled')::bigint,
    (select count(*) from o where not counts_in_revenue)::bigint,
    (select coalesce(sum(net_sales_ex_tax),0) from o where not counts_in_revenue),
    (select ms from m),
    (select mc from m),
    case when (select mc from m) = 0 then null else round((select ms from m) / (select mc from m), 2) end,
    case when coalesce(sum(i.covers),0) = 0 then null else round(100.0 * (select mc from m) / sum(i.covers), 1) end
  from inc i;
$function$;

create or replace function public.rosy_sales_trend(p_from date, p_to date, p_locations uuid[] default null::uuid[])
returns table(business_date date, net_sales numeric, orders bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with scope as (select public.rosy_scope_locations('view_sales', p_locations) id)
  select c.business_date, sum(c.net_sales_ex_tax - c.refund_total), count(*)::bigint
  from canonical_orders c
  join scope s on s.id = c.location_id
  where c.business_date between p_from and p_to
    and c.counts_in_revenue and c.status in ('completed','partially_refunded')
  group by c.business_date order by c.business_date;
$function$;

create or replace function public.rosy_channel_mix(p_from date, p_to date, p_locations uuid[] default null::uuid[])
returns table(channel text, fulfilment_type text, net_sales numeric, orders bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with scope as (select public.rosy_scope_locations('view_sales', p_locations) id)
  select c.channel, c.fulfilment_type, sum(c.net_sales_ex_tax - c.refund_total), count(*)::bigint
  from canonical_orders c
  join scope s on s.id = c.location_id
  where c.business_date between p_from and p_to
    and c.counts_in_revenue and c.status in ('completed','partially_refunded')
  group by c.channel, c.fulfilment_type order by 3 desc;
$function$;

create or replace function public.rosy_channel_mix_by_location(p_from date, p_to date, p_locations uuid[] default null::uuid[])
returns table(location_id uuid, location_name text, brand_name text, channel text, fulfilment_type text, net_sales numeric, orders bigint, covers bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with scope as (select public.rosy_scope_locations('view_sales', p_locations) id)
  select o.location_id, l.name, b.name, o.channel, o.fulfilment_type,
         sum(o.net_sales_ex_tax - o.refund_total),
         count(*)::bigint,
         coalesce(sum(o.covers),0)::bigint
  from canonical_orders o
  join scope s on s.id = o.location_id
  join locations l on l.id = o.location_id
  join brands b on b.id = l.brand_id
  where o.business_date between p_from and p_to
    and o.counts_in_revenue and o.status in ('completed','partially_refunded')
  group by o.location_id, l.name, b.name, o.channel, o.fulfilment_type
  order by l.name, 6 desc;
$function$;

create or replace function public.rosy_demand_heatmap(p_from date, p_to date, p_locations uuid[] default null::uuid[])
returns table(weekday integer, hour integer, reservations bigint, seated_covers bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with scope as (select public.rosy_scope_locations('view_guests', p_locations) id)
  select extract(dow from (r.scheduled_at at time zone 'Asia/Dubai'))::int,
         extract(hour from (r.scheduled_at at time zone 'Asia/Dubai'))::int,
         count(*)::bigint, coalesce(sum(r.seated_covers),0)::bigint
  from reservations r
  join scope s on s.id = r.location_id
  where r.business_date between p_from and p_to
  group by 1,2 order by 1,2;
$function$;

create or replace function public.rosy_guest_cohorts(p_from date, p_to date, p_locations uuid[] default null::uuid[])
returns table(reservations bigint, expected_covers bigint, seated_covers bigint, no_shows bigint, cancellations bigint, no_show_rate numeric, identifiable_contacts bigint, returning_contacts bigint, repeat_rate numeric, identification_coverage_pct numeric, matched_reservations bigint, unmatched_seated bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with scope as (select public.rosy_scope_locations('view_guests', p_locations) id),
  r as (
    select v.* from reservations v
    join scope s on s.id = v.location_id
    where v.business_date between p_from and p_to
  ), elig as (select * from r where status in ('seated','no_show'))
  select
    count(*)::bigint,
    coalesce(sum(r.expected_covers),0)::bigint,
    coalesce(sum(r.seated_covers),0)::bigint,
    (select count(*) from r where status = 'no_show')::bigint,
    (select count(*) from r where status = 'cancelled')::bigint,
    case when (select count(*) from elig) = 0 then null
         else round(100.0 * (select count(*) from r where status='no_show') / (select count(*) from elig), 1) end,
    (select count(distinct guest_id) from r where guest_id is not null)::bigint,
    (select count(*) from (select guest_id from r where guest_id is not null group by guest_id having count(*) > 1) x)::bigint,
    case when (select count(distinct guest_id) from r where guest_id is not null) = 0 then null
         else round(100.0 * (select count(*) from (select guest_id from r where guest_id is not null group by guest_id having count(*) > 1) x)
              / (select count(distinct guest_id) from r where guest_id is not null), 1) end,
    case when count(*) = 0 then null else round(100.0 * (select count(*) from r where guest_id is not null) / count(*), 1) end,
    (select count(*) from r where matched_order_id is not null)::bigint,
    (select count(*) from r where status = 'seated' and matched_order_id is null)::bigint
  from r;
$function$;

create or replace function public.rosy_inventory_risk(p_locations uuid[] default null::uuid[])
returns table(location_id uuid, location_name text, ingredient_id uuid, ingredient_name text, as_of_date date, quantity numeric, unit text, value_aed numeric, reorder_threshold numeric, days_cover numeric, expiry_date date, source text, low_stock boolean)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with scope as (select public.rosy_scope_locations('view_inventory', p_locations) id)
  select s.location_id, l.name, s.ingredient_id, i.name, s.as_of_date, s.quantity, s.unit, s.value_aed,
         s.reorder_threshold, s.days_cover, s.expiry_date, s.source,
         (s.reorder_threshold is not null and s.quantity <= s.reorder_threshold)
  from stock_snapshots s
  join scope sc on sc.id = s.location_id
  join locations l on l.id = s.location_id
  join ingredients i on i.id = s.ingredient_id
  where s.as_of_date = (select max(as_of_date) from stock_snapshots s2 where s2.location_id = s.location_id)
  order by (s.reorder_threshold is not null and s.quantity <= s.reorder_threshold) desc, s.days_cover nulls last;
$function$;

create or replace function public.rosy_venue_comparison(p_from date, p_to date, p_prev_from date, p_prev_to date)
returns table(location_id uuid, location_name text, brand_name text, opened_on date, net_sales numeric, prev_net_sales numeric, growth_pct numeric, comparable boolean, orders bigint, covers bigint, aov numeric, waste_cost numeric, theoretical_cost_pct numeric, recipe_coverage_pct numeric, target numeric, excluded_orders bigint, last_source_refresh timestamp with time zone)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with scope as (select public.rosy_scope_locations('view_sales', null) id),
  inv_scope as (select public.rosy_scope_locations('view_inventory', null) id),
  fin_scope as (select public.rosy_scope_locations('view_finance', null) id),
  cur as (
    select c.location_id, sum(c.net_sales_ex_tax - c.refund_total) net, count(*)::bigint ord, coalesce(sum(c.covers),0)::bigint cov
    from canonical_orders c join scope s on s.id = c.location_id
    where c.business_date between p_from and p_to and c.counts_in_revenue and c.status in ('completed','partially_refunded')
    group by c.location_id
  ), prev as (
    select c.location_id, sum(c.net_sales_ex_tax - c.refund_total) net
    from canonical_orders c join scope s on s.id = c.location_id
    where c.business_date between p_prev_from and p_prev_to and c.counts_in_revenue and c.status in ('completed','partially_refunded')
    group by c.location_id
  ), excl as (
    select c.location_id, count(*)::bigint n
    from canonical_orders c join scope s on s.id = c.location_id
    where c.business_date between p_from and p_to and not c.counts_in_revenue
    group by c.location_id
  ), w as (
    select e.location_id, sum(e.value_aed) v
    from waste_entries e join inv_scope s on s.id = e.location_id
    where e.occurred_on between p_from and p_to group by e.location_id
  ), lines as (
    select o.location_id,
           sum(ol.net_ex_tax) net,
           sum(case when rc.cost is not null then ol.net_ex_tax else 0 end) covered_net,
           sum(case when rc.cost is not null then rc.cost * ol.quantity else 0 end) cost
    from order_lines ol
    join canonical_orders o on o.id = ol.order_id
    join scope s on s.id = o.location_id
    left join lateral (
      select rv.ingredient_cost cost from recipe_versions rv
      where rv.product_id = ol.product_id and rv.effective_from <= o.business_date and rv.ingredient_cost is not null
      order by rv.effective_from desc limit 1
    ) rc on true
    where o.business_date between p_from and p_to and o.counts_in_revenue and o.status in ('completed','partially_refunded')
    group by o.location_id
  ), tgt as (
    select bu.location_id, sum(bu.net_sales_target) t
    from budgets bu join fin_scope s on s.id = bu.location_id
    where bu.period_month between date_trunc('month', p_from)::date and date_trunc('month', p_to)::date
    group by bu.location_id
  ), fresh as (
    select i.location_id, max(i.last_success_at) ts from integrations i where i.location_id is not null group by i.location_id
  )
  select l.id, l.name, b.name, l.opened_on,
    coalesce(cur.net,0), prev.net,
    case when prev.net is null or prev.net = 0 or l.opened_on > p_prev_from then null
         else round(100.0 * (coalesce(cur.net,0) - prev.net) / prev.net, 1) end,
    (l.opened_on <= p_prev_from),
    coalesce(cur.ord,0), coalesce(cur.cov,0),
    case when coalesce(cur.ord,0) = 0 then null else round(cur.net / cur.ord, 2) end,
    coalesce(w.v,0),
    case when coalesce(lines.covered_net,0) = 0 then null else round(100.0 * lines.cost / lines.covered_net, 1) end,
    case when coalesce(lines.net,0) = 0 then null else round(100.0 * lines.covered_net / lines.net, 1) end,
    tgt.t, coalesce(excl.n,0), fresh.ts
  from locations l
  join scope sc on sc.id = l.id
  join brands b on b.id = l.brand_id
  left join cur on cur.location_id = l.id
  left join prev on prev.location_id = l.id
  left join excl on excl.location_id = l.id
  left join w on w.location_id = l.id
  left join lines on lines.location_id = l.id
  left join tgt on tgt.location_id = l.id
  left join fresh on fresh.location_id = l.id
  order by coalesce(cur.net,0) desc;
$function$;

revoke all on function public.rosy_sales_summary(date, date, uuid[]) from anon;
revoke all on function public.rosy_sales_trend(date, date, uuid[]) from anon;
revoke all on function public.rosy_channel_mix(date, date, uuid[]) from anon;
revoke all on function public.rosy_channel_mix_by_location(date, date, uuid[]) from anon;
revoke all on function public.rosy_demand_heatmap(date, date, uuid[]) from anon;
revoke all on function public.rosy_guest_cohorts(date, date, uuid[]) from anon;
revoke all on function public.rosy_inventory_risk(uuid[]) from anon;
revoke all on function public.rosy_venue_comparison(date, date, date, date) from anon;
grant execute on function public.rosy_sales_summary(date, date, uuid[]) to authenticated, service_role;
grant execute on function public.rosy_sales_trend(date, date, uuid[]) to authenticated, service_role;
grant execute on function public.rosy_channel_mix(date, date, uuid[]) to authenticated, service_role;
grant execute on function public.rosy_channel_mix_by_location(date, date, uuid[]) to authenticated, service_role;
grant execute on function public.rosy_demand_heatmap(date, date, uuid[]) to authenticated, service_role;
grant execute on function public.rosy_guest_cohorts(date, date, uuid[]) to authenticated, service_role;
grant execute on function public.rosy_inventory_risk(uuid[]) to authenticated, service_role;
grant execute on function public.rosy_venue_comparison(date, date, date, date) to authenticated, service_role;

create index if not exists canonical_orders_revenue_date_idx on public.canonical_orders (business_date, location_id) where counts_in_revenue;
create index if not exists waste_entries_loc_date_idx on public.waste_entries (location_id, occurred_on);
create index if not exists payment_entries_order_id_idx on public.payment_entries (order_id);
create index if not exists reservations_matched_order_idx on public.reservations (matched_order_id) where matched_order_id is not null;
analyze public.canonical_orders;
analyze public.order_lines;
analyze public.reservations;
analyze public.waste_entries;
analyze public.payment_entries;