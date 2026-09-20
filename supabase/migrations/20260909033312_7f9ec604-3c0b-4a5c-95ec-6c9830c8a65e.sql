
create or replace function public.rosy_sales_summary(p_from date, p_to date, p_locations uuid[] default null)
returns table (
  net_sales numeric, orders bigint, discounts numeric, tax numeric, charges numeric,
  refunds numeric, customer_total numeric, covers bigint, aov numeric,
  cancelled_orders bigint, excluded_orders bigint, excluded_amount numeric,
  matched_sales numeric, matched_covers bigint, spend_per_cover numeric, cover_coverage_pct numeric
) language sql stable set search_path = public as $$
  with o as (
    select * from canonical_orders
    where business_date between p_from and p_to
      and (p_locations is null or location_id = any(p_locations))
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
$$;

create or replace function public.rosy_sales_trend(p_from date, p_to date, p_locations uuid[] default null)
returns table (business_date date, net_sales numeric, orders bigint)
language sql stable set search_path = public as $$
  select business_date, sum(net_sales_ex_tax - refund_total), count(*)::bigint
  from canonical_orders
  where business_date between p_from and p_to
    and (p_locations is null or location_id = any(p_locations))
    and counts_in_revenue and status in ('completed','partially_refunded')
  group by business_date order by business_date;
$$;

create or replace function public.rosy_channel_mix(p_from date, p_to date, p_locations uuid[] default null)
returns table (channel text, fulfilment_type text, net_sales numeric, orders bigint)
language sql stable set search_path = public as $$
  select channel, fulfilment_type, sum(net_sales_ex_tax - refund_total), count(*)::bigint
  from canonical_orders
  where business_date between p_from and p_to
    and (p_locations is null or location_id = any(p_locations))
    and counts_in_revenue and status in ('completed','partially_refunded')
  group by channel, fulfilment_type order by 3 desc;
$$;

create or replace function public.rosy_venue_comparison(p_from date, p_to date, p_prev_from date, p_prev_to date)
returns table (
  location_id uuid, location_name text, brand_name text, opened_on date,
  net_sales numeric, prev_net_sales numeric, growth_pct numeric, comparable boolean,
  orders bigint, covers bigint, aov numeric, waste_cost numeric,
  theoretical_cost_pct numeric, recipe_coverage_pct numeric,
  target numeric, excluded_orders bigint, last_source_refresh timestamptz
) language sql stable set search_path = public as $$
  with cur as (
    select location_id, sum(net_sales_ex_tax - refund_total) net, count(*)::bigint ord, coalesce(sum(covers),0)::bigint cov
    from canonical_orders
    where business_date between p_from and p_to and counts_in_revenue and status in ('completed','partially_refunded')
    group by location_id
  ), prev as (
    select location_id, sum(net_sales_ex_tax - refund_total) net
    from canonical_orders
    where business_date between p_prev_from and p_prev_to and counts_in_revenue and status in ('completed','partially_refunded')
    group by location_id
  ), excl as (
    select location_id, count(*)::bigint n from canonical_orders
    where business_date between p_from and p_to and not counts_in_revenue group by location_id
  ), w as (
    select location_id, sum(value_aed) v from waste_entries where occurred_on between p_from and p_to group by location_id
  ), lines as (
    select o.location_id,
           sum(ol.net_ex_tax) net,
           sum(case when rc.cost is not null then ol.net_ex_tax else 0 end) covered_net,
           sum(case when rc.cost is not null then rc.cost * ol.quantity else 0 end) cost
    from order_lines ol
    join canonical_orders o on o.id = ol.order_id
    left join lateral (
      select rv.ingredient_cost cost from recipe_versions rv
      where rv.product_id = ol.product_id and rv.effective_from <= o.business_date and rv.ingredient_cost is not null
      order by rv.effective_from desc limit 1
    ) rc on true
    where o.business_date between p_from and p_to and o.counts_in_revenue and o.status in ('completed','partially_refunded')
    group by o.location_id
  ), tgt as (
    select location_id, sum(net_sales_target) t from budgets
    where period_month between date_trunc('month', p_from)::date and date_trunc('month', p_to)::date
    group by location_id
  ), fresh as (
    select location_id, max(last_success_at) ts from integrations where location_id is not null group by location_id
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
  join brands b on b.id = l.brand_id
  left join cur on cur.location_id = l.id
  left join prev on prev.location_id = l.id
  left join excl on excl.location_id = l.id
  left join w on w.location_id = l.id
  left join lines on lines.location_id = l.id
  left join tgt on tgt.location_id = l.id
  left join fresh on fresh.location_id = l.id
  order by coalesce(cur.net,0) desc;
$$;

create or replace function public.rosy_menu_performance(p_from date, p_to date, p_locations uuid[] default null)
returns table (
  product_id uuid, item_name text, category text, pos_item_id text, location_id uuid, location_name text,
  units numeric, net_revenue numeric, discounts numeric, avg_price numeric,
  recipe_cost numeric, contribution_per_unit numeric, contribution_pct numeric, sales_mix_pct numeric,
  margin_available boolean, available boolean
) language sql stable set search_path = public as $$
  with base as (
    select ol.product_id, sum(ol.quantity) units, sum(ol.net_ex_tax) net, sum(ol.discount_amount) disc,
           sum(ol.gross_ex_tax) gross,
           sum(case when rc.cost is not null then rc.cost * ol.quantity else 0 end) cost,
           bool_or(rc.cost is not null) has_cost
    from order_lines ol
    join canonical_orders o on o.id = ol.order_id
    left join lateral (
      select rv.ingredient_cost cost from recipe_versions rv
      where rv.product_id = ol.product_id and rv.effective_from <= o.business_date and rv.ingredient_cost is not null
      order by rv.effective_from desc limit 1
    ) rc on true
    where o.business_date between p_from and p_to
      and (p_locations is null or o.location_id = any(p_locations))
      and o.counts_in_revenue and o.status in ('completed','partially_refunded')
    group by ol.product_id
  ), total as (select sum(net) n from base)
  select p.id, p.name, p.category, p.pos_item_id, p.location_id, l.name,
    b.units, b.net, b.disc,
    case when b.units = 0 then null else round(b.net / b.units, 2) end,
    case when b.has_cost then round(b.cost / nullif(b.units,0), 2) else null end,
    case when b.has_cost then round((b.net - b.cost) / nullif(b.units,0), 2) else null end,
    case when b.has_cost and b.net <> 0 then round(100.0 * (b.net - b.cost) / b.net, 1) else null end,
    case when (select n from total) > 0 then round(100.0 * b.net / (select n from total), 2) else null end,
    b.has_cost, p.is_available
  from base b
  join products p on p.id = b.product_id
  join locations l on l.id = p.location_id
  order by b.net desc;
$$;

create or replace function public.rosy_inventory_risk(p_locations uuid[] default null)
returns table (
  location_id uuid, location_name text, ingredient_id uuid, ingredient_name text,
  as_of_date date, quantity numeric, unit text, value_aed numeric,
  reorder_threshold numeric, days_cover numeric, expiry_date date, source text, low_stock boolean
) language sql stable set search_path = public as $$
  select s.location_id, l.name, s.ingredient_id, i.name, s.as_of_date, s.quantity, s.unit, s.value_aed,
         s.reorder_threshold, s.days_cover, s.expiry_date, s.source,
         (s.reorder_threshold is not null and s.quantity <= s.reorder_threshold)
  from stock_snapshots s
  join locations l on l.id = s.location_id
  join ingredients i on i.id = s.ingredient_id
  where (p_locations is null or s.location_id = any(p_locations))
    and s.as_of_date = (select max(as_of_date) from stock_snapshots s2 where s2.location_id = s.location_id)
  order by (s.reorder_threshold is not null and s.quantity <= s.reorder_threshold) desc, s.days_cover nulls last;
$$;

create or replace function public.rosy_guest_cohorts(p_from date, p_to date, p_locations uuid[] default null)
returns table (
  reservations bigint, expected_covers bigint, seated_covers bigint, no_shows bigint, cancellations bigint,
  no_show_rate numeric, identifiable_contacts bigint, returning_contacts bigint, repeat_rate numeric,
  identification_coverage_pct numeric, matched_reservations bigint, unmatched_seated bigint
) language sql stable set search_path = public as $$
  with r as (
    select * from reservations
    where business_date between p_from and p_to
      and (p_locations is null or location_id = any(p_locations))
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
$$;

create or replace function public.rosy_demand_heatmap(p_from date, p_to date, p_locations uuid[] default null)
returns table (weekday int, hour int, reservations bigint, seated_covers bigint)
language sql stable set search_path = public as $$
  select extract(dow from (scheduled_at at time zone 'Asia/Dubai'))::int,
         extract(hour from (scheduled_at at time zone 'Asia/Dubai'))::int,
         count(*)::bigint, coalesce(sum(seated_covers),0)::bigint
  from reservations
  where business_date between p_from and p_to
    and (p_locations is null or location_id = any(p_locations))
  group by 1,2 order by 1,2;
$$;

create or replace function public.rosy_renewal_queue(p_days int default 60)
returns table (
  document_id uuid, employee_name text, location_name text, doc_type text, masked_number text,
  expiry_date date, days_to_expiry int, status public.doc_status, verification_status text,
  owner_name text, task_threshold int, task_due_date date, task_status text
) language sql stable set search_path = public as $$
  select d.id, e.display_name, l.name, d.doc_type, d.masked_number, d.expiry_date,
         (d.expiry_date - current_date)::int, d.status, d.verification_status, d.owner_name,
         t.threshold_days, t.due_date, t.status
  from restricted_documents d
  join employees e on e.id = d.employee_id
  left join locations l on l.id = e.location_id
  left join renewal_tasks t on t.document_id = d.id
  where d.expiry_date <= current_date + p_days
  order by d.expiry_date;
$$;

create or replace function public.rosy_my_investments()
returns table (
  commitment_id uuid, investor_name text, entity_name text, instrument_type text, share_class text,
  committed numeric, funded numeric, unfunded numeric, ownership_pct numeric, distributions numeric,
  distributions_dividend numeric, distributions_return_of_capital numeric,
  valuation_status text, valuation_date date, equity_value numeric, indicative_stake_value numeric,
  stake_value_note text
) language sql stable set search_path = public as $$
  select c.id, i.display_name, le.name, c.instrument_type, c.share_class,
    c.committed_amount,
    coalesce((select sum(amount) from contribution_entries ce where ce.commitment_id = c.id),0),
    c.committed_amount - coalesce((select sum(amount) from contribution_entries ce where ce.commitment_id = c.id),0),
    c.ownership_pct,
    coalesce((select sum(amount) from distribution_entries de where de.commitment_id = c.id),0),
    coalesce((select sum(amount) from distribution_entries de where de.commitment_id = c.id and de.kind = 'dividend'),0),
    coalesce((select sum(amount) from distribution_entries de where de.commitment_id = c.id and de.kind = 'return_of_capital'),0),
    case when v.id is null then 'pending' else 'published' end,
    v.valuation_date, v.equity_value,
    case when v.id is null or c.instrument_type <> 'equity' or c.ownership_pct is null then null
         else round(v.equity_value * c.ownership_pct, 2) end,
    case when v.id is null then 'Valuation pending — no approved and published valuation for this entity.'
         when c.instrument_type <> 'equity' then 'Instrument-specific approved value required; a simple ownership formula does not apply.'
         when c.ownership_pct is null then 'Ownership interest not recorded for this instrument.'
         else 'Latest approved equity value x recorded ownership. Indicative only, not a realizable exit price.' end
  from capital_commitments c
  join investors i on i.id = c.investor_id
  join legal_entities le on le.id = c.legal_entity_id
  left join lateral (
    select v2.* from valuations v2
    where v2.legal_entity_id = c.legal_entity_id and v2.status = 'published' and v2.published_at is not null
    order by v2.valuation_date desc limit 1
  ) v on true
  order by le.name, c.effective_from;
$$;

revoke all on function public.rosy_sales_summary(date,date,uuid[]) from public, anon;
revoke all on function public.rosy_sales_trend(date,date,uuid[]) from public, anon;
revoke all on function public.rosy_channel_mix(date,date,uuid[]) from public, anon;
revoke all on function public.rosy_venue_comparison(date,date,date,date) from public, anon;
revoke all on function public.rosy_menu_performance(date,date,uuid[]) from public, anon;
revoke all on function public.rosy_inventory_risk(uuid[]) from public, anon;
revoke all on function public.rosy_guest_cohorts(date,date,uuid[]) from public, anon;
revoke all on function public.rosy_demand_heatmap(date,date,uuid[]) from public, anon;
revoke all on function public.rosy_renewal_queue(int) from public, anon;
revoke all on function public.rosy_my_investments() from public, anon;

grant execute on function public.rosy_sales_summary(date,date,uuid[]), public.rosy_sales_trend(date,date,uuid[]),
  public.rosy_channel_mix(date,date,uuid[]), public.rosy_venue_comparison(date,date,date,date),
  public.rosy_menu_performance(date,date,uuid[]), public.rosy_inventory_risk(uuid[]),
  public.rosy_guest_cohorts(date,date,uuid[]), public.rosy_demand_heatmap(date,date,uuid[]),
  public.rosy_renewal_queue(int), public.rosy_my_investments() to authenticated;
