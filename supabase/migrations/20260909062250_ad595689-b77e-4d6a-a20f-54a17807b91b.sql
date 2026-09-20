
create or replace function public.rosy_channel_mix_by_location(p_from date, p_to date, p_locations uuid[] default null)
returns table(location_id uuid, location_name text, brand_name text, channel text, fulfilment_type text, net_sales numeric, orders bigint, covers bigint)
language sql
stable
set search_path to 'public'
as $$
  select o.location_id, l.name, b.name, o.channel, o.fulfilment_type,
         sum(o.net_sales_ex_tax - o.refund_total),
         count(*)::bigint,
         coalesce(sum(o.covers),0)::bigint
  from canonical_orders o
  join locations l on l.id = o.location_id
  join brands b on b.id = l.brand_id
  where o.business_date between p_from and p_to
    and (p_locations is null or o.location_id = any(p_locations))
    and o.counts_in_revenue and o.status in ('completed','partially_refunded')
  group by o.location_id, l.name, b.name, o.channel, o.fulfilment_type
  order by l.name, 6 desc;
$$;

revoke all on function public.rosy_channel_mix_by_location(date, date, uuid[]) from public, anon;
grant execute on function public.rosy_channel_mix_by_location(date, date, uuid[]) to authenticated, service_role;
