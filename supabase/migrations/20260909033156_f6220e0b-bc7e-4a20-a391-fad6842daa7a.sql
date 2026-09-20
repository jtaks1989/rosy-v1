
-- ORG / STRUCTURE
insert into public.organizations (id, name, is_demo) values
('00000000-0000-4000-8000-000000000001','Rosy Hospitality (Demo)', true);

insert into public.legal_entities (id, org_id, name, jurisdiction) values
('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','Rosy F&B Holding LLC (Demo)','Dubai, UAE'),
('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000001','CQ Brasserie Ventures LLC (Demo)','Dubai, UAE'),
('00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000001','Butter Bakehouse LLC (Demo)','Dubai, UAE');

insert into public.brands (id, org_id, name) values
('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000001','CQ French Brasserie'),
('00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000001','Butter by the Dozen'),
('00000000-0000-4000-8000-000000000023','00000000-0000-4000-8000-000000000001','Girl & the Goose');

insert into public.locations (id, org_id, brand_id, legal_entity_id, name, timezone, business_day_cutoff, opened_on, manager_name) values
('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000012','CQ French Brasserie — JLT','Asia/Dubai','04:00', current_date - 900, 'Demo Manager A'),
('00000000-0000-4000-8000-000000000032','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000012','CQ French Brasserie — Barsha Heights','Asia/Dubai','04:00', current_date - 40, 'Demo Manager B'),
('00000000-0000-4000-8000-000000000033','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000013','Butter by the Dozen — Demo Mall','Asia/Dubai','02:00', current_date - 700, 'Demo Manager C'),
('00000000-0000-4000-8000-000000000034','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000023','00000000-0000-4000-8000-000000000011','Girl & the Goose — Demo Marina','Asia/Dubai','04:00', current_date - 500, 'Demo Manager D');

-- MENU TEMPLATE
create temp table t_items(brand_key text, pos_item_id text, name text, category text, price numeric, cost numeric);
insert into t_items values
('cq','CQ-101','Steak Frites','Mains',132,46),
('cq','CQ-102','Moules Marinière','Mains',96,38),
('cq','CQ-103','Onion Soup Gratinée','Starters',48,11),
('cq','CQ-104','Steak Tartare','Starters',72,26),
('cq','CQ-105','Roast Chicken for Two','Mains',185,58),
('cq','CQ-106','Crème Brûlée','Desserts',42,7),
('cq','CQ-107','House Lemonade','Drinks',28,4),
('cq','CQ-108','Niçoise Salad','Mains',68,22),
('butter','BT-201','Dozen Butter Croissants','Bakery',96,31),
('butter','BT-202','Pain au Chocolat','Bakery',18,5),
('butter','BT-203','Seasonal Tart','Bakery',34,null),
('butter','BT-204','Cardamom Bun','Bakery',22,6),
('butter','BT-205','Flat White','Drinks',24,4),
('butter','BT-206','Breakfast Plate','All Day',64,21),
('goose','GG-301','Goose Confit','Mains',148,54),
('goose','GG-302','Charred Aubergine','Starters',56,14),
('goose','GG-303','Truffle Flatbread','Starters',78,24),
('goose','GG-304','Slow Lamb Shoulder','Mains',210,74),
('goose','GG-305','Basque Cheesecake','Desserts',46,9),
('goose','GG-306','Sparkling Tonic','Drinks',26,3);

insert into public.products (id, org_id, location_id, pos_item_id, name, category)
select gen_random_uuid(), l.org_id, l.id, i.pos_item_id, i.name, i.category
from public.locations l
join public.brands b on b.id = l.brand_id
join t_items i on i.brand_key = case b.name when 'CQ French Brasserie' then 'cq' when 'Butter by the Dozen' then 'butter' else 'goose' end;

create temp table tmp_menu(product_id uuid, location_id uuid, price numeric, cost numeric);
insert into tmp_menu
select p.id, p.location_id, i.price, i.cost
from public.products p
join public.locations l on l.id = p.location_id
join public.brands b on b.id = l.brand_id
join t_items i on i.pos_item_id = p.pos_item_id
 and i.brand_key = case b.name when 'CQ French Brasserie' then 'cq' when 'Butter by the Dozen' then 'butter' else 'goose' end;

-- effective-dated recipe costs (v1 90 days ago, v2 30 days ago at +8%); one item has no recipe cost at all
insert into public.recipe_versions (org_id, product_id, version, effective_from, ingredient_cost)
select '00000000-0000-4000-8000-000000000001', m.product_id, 1, current_date - 90, m.cost
from tmp_menu m where m.cost is not null;
insert into public.recipe_versions (org_id, product_id, version, effective_from, ingredient_cost)
select '00000000-0000-4000-8000-000000000001', m.product_id, 2, current_date - 30, round(m.cost * 1.08, 4)
from tmp_menu m where m.cost is not null and (abs(hashtext(m.product_id::text)) % 3) = 0;

-- ORDERS
create temp table t_orders(id uuid, location_id uuid, business_date date, occurred_at timestamptz, channel text, fulfilment text, status public.order_lifecycle, covers int, src text, seed int);
insert into t_orders
select gen_random_uuid(), l.id, d::date,
       (d + make_interval(hours => 11 + (abs(hashtext(l.id::text || d::text || n::text)) % 12), mins => (abs(hashtext('m' || l.id::text || d::text || n::text)) % 60)))::timestamptz,
       ch.channel, ch.fulfilment,
       case when (abs(hashtext('s' || l.id::text || d::text || n::text)) % 60) = 0 then 'cancelled'::public.order_lifecycle else 'completed'::public.order_lifecycle end,
       case when ch.fulfilment = 'dine_in' then 1 + (abs(hashtext('c' || l.id::text || d::text || n::text)) % 4) else null end,
       case when l.name like 'Girl%' and ch.fulfilment = 'delivery' then 'grubtech' else 'foodics' end,
       abs(hashtext('x' || l.id::text || d::text || n::text))
from public.locations l
cross join generate_series(current_date - 89, current_date - 1, interval '1 day') d
cross join generate_series(1, 20) n
cross join lateral (
  select case when (abs(hashtext('ch' || l.id::text || d::text || n::text)) % 10) < 6 then 'Dine-in'
              when (abs(hashtext('ch' || l.id::text || d::text || n::text)) % 10) < 8 then 'Delivery — Demo Aggregator'
              when (abs(hashtext('ch' || l.id::text || d::text || n::text)) % 10) = 8 then 'Takeaway'
              else 'Delivery — Own Channel' end as channel,
         case when (abs(hashtext('ch' || l.id::text || d::text || n::text)) % 10) < 6 then 'dine_in'
              when (abs(hashtext('ch' || l.id::text || d::text || n::text)) % 10) = 8 then 'pickup'
              else 'delivery' end as fulfilment
) ch
where d::date >= greatest(l.opened_on, current_date - 89);

insert into public.canonical_orders (id, org_id, location_id, business_date, occurred_at, status, channel, fulfilment_type, authoritative_source, covers, counts_in_revenue, reconciliation_status)
select t.id, '00000000-0000-4000-8000-000000000001', t.location_id, t.business_date, t.occurred_at, t.status, t.channel, t.fulfilment, t.src, t.covers,
       t.status <> 'cancelled', 'single_source'
from t_orders t;

-- LINES
insert into public.order_lines (org_id, order_id, product_id, quantity, gross_ex_tax, discount_amount, net_ex_tax)
select '00000000-0000-4000-8000-000000000001', o.id, m.product_id, q.qty,
       round(m.price * q.qty, 2),
       case when (abs(hashtext('d' || o.id::text || m.product_id::text)) % 9) = 0 then round(m.price * q.qty * 0.15, 2) else 0 end,
       round(m.price * q.qty, 2) - case when (abs(hashtext('d' || o.id::text || m.product_id::text)) % 9) = 0 then round(m.price * q.qty * 0.15, 2) else 0 end
from public.canonical_orders o
join lateral (
  select mm.product_id, mm.price
  from tmp_menu mm
  where mm.location_id = o.location_id
  order by md5(o.id::text || mm.product_id::text)
  limit 2
) m on true
cross join lateral (select 1 + (abs(hashtext('q' || o.id::text || m.product_id::text)) % 2) as qty) q;

-- AGGREGATE ORDER TOTALS FROM LINES (single source of truth)
update public.canonical_orders o
set net_sales_ex_tax = agg.net,
    discount_total = agg.disc,
    tax_total = round(agg.net * 0.05, 2),
    charge_total = case when o.fulfilment_type = 'dine_in' then round(agg.net * 0.07, 2) else 0 end,
    customer_total = agg.net + round(agg.net * 0.05, 2) + case when o.fulfilment_type = 'dine_in' then round(agg.net * 0.07, 2) else 0 end
from (select order_id, sum(net_ex_tax) net, sum(discount_amount) disc from public.order_lines group by order_id) agg
where agg.order_id = o.id;

update public.canonical_orders set net_sales_ex_tax = 0, discount_total = 0, tax_total = 0, charge_total = 0, customer_total = 0
where status = 'cancelled';

insert into public.payment_entries (org_id, order_id, tender, amount)
select org_id, id, 'Card — Demo', round(customer_total * 0.6, 2) from public.canonical_orders where customer_total > 0
union all
select org_id, id, 'Cash — Demo', customer_total - round(customer_total * 0.6, 2) from public.canonical_orders where customer_total > 0;

insert into public.order_source_links (org_id, order_id, provider, external_id, raw_status)
select org_id, id, authoritative_source, 'DEMO-' || upper(substr(replace(id::text,'-',''),1,10)), case when status = 'cancelled' then 'CANCELLED' else 'CLOSED' end
from public.canonical_orders;

-- delivery orders also observed by Grubtech (order/channel context), same economic sale
insert into public.order_source_links (org_id, order_id, provider, external_id, raw_status)
select org_id, id, 'grubtech', 'GT-DEMO-' || upper(substr(replace(id::text,'-',''),1,10)), 'COMPLETED'
from public.canonical_orders where fulfilment_type = 'delivery' and authoritative_source = 'foodics';

update public.canonical_orders o set reconciliation_status = 'matched'
where exists (select 1 from public.order_source_links l where l.order_id = o.id and l.provider = 'grubtech')
  and o.authoritative_source = 'foodics';

-- late partial refund on one older completed order
update public.canonical_orders set status = 'partially_refunded', refund_total = round(net_sales_ex_tax * 0.25, 2)
where id = (select id from public.canonical_orders where status = 'completed' and business_date < current_date - 30 order by business_date, id limit 1);

-- after-midnight order that belongs to the previous service day (Dubai cutoff 04:00)
insert into public.canonical_orders (org_id, location_id, business_date, occurred_at, status, channel, fulfilment_type, authoritative_source, net_sales_ex_tax, discount_total, tax_total, charge_total, customer_total, covers, reconciliation_status)
values ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000031', current_date - 2,
 ((current_date - 1)::timestamp + interval '1 hour 30 minutes') at time zone 'Asia/Dubai',
 'completed','Dine-in','dine_in','foodics', 410.00, 0, 20.50, 28.70, 459.20, 4, 'single_source');

-- duplicate economic sale: a Grubtech-only record for a sale already settled in Foodics, excluded from revenue
with keeper as (
  select id, org_id, location_id, business_date, occurred_at, net_sales_ex_tax, discount_total, tax_total, customer_total
  from public.canonical_orders
  where fulfilment_type = 'delivery' and authoritative_source = 'foodics' and status = 'completed'
  order by business_date desc, id limit 1
)
insert into public.canonical_orders (org_id, location_id, business_date, occurred_at, status, channel, fulfilment_type, authoritative_source, net_sales_ex_tax, discount_total, tax_total, charge_total, customer_total, reconciliation_status, counts_in_revenue)
select org_id, location_id, business_date, occurred_at, 'completed','Delivery — Demo Aggregator','delivery','grubtech', net_sales_ex_tax, discount_total, tax_total, 0, customer_total, 'duplicate_excluded', false from keeper;

-- one ambiguous overlap held for review (excluded from headline revenue)
insert into public.canonical_orders (org_id, location_id, business_date, occurred_at, status, channel, fulfilment_type, authoritative_source, net_sales_ex_tax, discount_total, tax_total, charge_total, customer_total, reconciliation_status, counts_in_revenue)
values ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000034', current_date - 3,
 (current_date - 3)::timestamptz + interval '20 hours','completed','Delivery — Own Channel','delivery','grubtech', 268.00, 0, 13.40, 0, 281.40, 'review', false);

-- INGREDIENTS / STOCK / WASTE
insert into public.ingredients (id, org_id, name, unit) values
('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000001','Beef sirloin','kg'),
('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000001','Butter (unsalted)','kg'),
('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000001','Mussels','kg'),
('00000000-0000-4000-8000-000000000104','00000000-0000-4000-8000-000000000001','Gruyère','kg'),
('00000000-0000-4000-8000-000000000105','00000000-0000-4000-8000-000000000001','Baking flour','kg'),
('00000000-0000-4000-8000-000000000106','00000000-0000-4000-8000-000000000001','Whole milk','L'),
('00000000-0000-4000-8000-000000000107','00000000-0000-4000-8000-000000000001','Free-range eggs','pieces'),
('00000000-0000-4000-8000-000000000108','00000000-0000-4000-8000-000000000001','Duck legs','kg'),
('00000000-0000-4000-8000-000000000109','00000000-0000-4000-8000-000000000001','Lamb shoulder','kg'),
('00000000-0000-4000-8000-000000000110','00000000-0000-4000-8000-000000000001','Aubergine','kg'),
('00000000-0000-4000-8000-000000000111','00000000-0000-4000-8000-000000000001','Truffle paste','kg'),
('00000000-0000-4000-8000-000000000112','00000000-0000-4000-8000-000000000001','Lemons','kg');

insert into public.stock_snapshots (org_id, location_id, ingredient_id, as_of_date, quantity, unit, value_aed, reorder_threshold, days_cover, expiry_date, source)
select '00000000-0000-4000-8000-000000000001', l.id, i.id, d::date,
  round((3 + (abs(hashtext(l.id::text || i.id::text || d::text)) % 40))::numeric, 3),
  i.unit,
  round(((3 + (abs(hashtext(l.id::text || i.id::text || d::text)) % 40)) * (12 + (abs(hashtext(i.id::text)) % 60)))::numeric, 2),
  8, round(((abs(hashtext('dc' || l.id::text || i.id::text)) % 90) / 10.0)::numeric, 2),
  case when (abs(hashtext('e' || l.id::text || i.id::text)) % 7) = 0 then d::date + 3 else null end,
  'supy_demo'
from public.locations l
cross join public.ingredients i
cross join generate_series(current_date - 6, current_date, interval '1 day') d;

insert into public.waste_entries (org_id, location_id, ingredient_id, occurred_on, quantity, unit, value_aed, reason)
select '00000000-0000-4000-8000-000000000001', l.id, i.id, d::date,
  round((0.4 + (abs(hashtext('w' || l.id::text || i.id::text || d::text)) % 25) / 10.0)::numeric, 3), i.unit,
  round((10 + (abs(hashtext('wv' || l.id::text || i.id::text || d::text)) % 180))::numeric, 2),
  (array['Spoilage','Prep trim','Over-production','Breakage','Staff error'])[1 + (abs(hashtext('wr' || l.id::text || i.id::text || d::text)) % 5)]
from public.locations l
cross join public.ingredients i
cross join generate_series(current_date - 89, current_date - 1, interval '1 day') d
where (abs(hashtext('wf' || l.id::text || i.id::text || d::text)) % 12) = 0;

-- GUESTS / RESERVATIONS
insert into public.guest_profiles (id, org_id, label, first_seen_on, is_identifiable, behaviour_tag, consent_marketing)
select ('00000000-0000-4000-8000-0000000002' || lpad(n::text, 2, '0'))::uuid,
  '00000000-0000-4000-8000-000000000001',
  'Demo Booking Contact ' || n,
  current_date - (30 + (n * 7) % 300),
  true,
  (array['first_time_booker','returning_diner','frequent_lunch_booker','weekend_diner','large_party_organiser','lapsed_guest'])[1 + (n % 6)],
  (n % 3) = 0
from generate_series(10, 69) n;

insert into public.guest_contacts (org_id, guest_id, masked_email, masked_phone, consent_source)
select org_id, id, 'd***' || substr(replace(id::text,'-',''),1,4) || '@example.invalid', '+9715****' || substr(replace(id::text,'-',''),1,3),
  case when consent_marketing then 'Demo booking form consent' else null end
from public.guest_profiles;

insert into public.reservations (org_id, location_id, business_date, scheduled_at, party_size, expected_covers, seated_covers, status, guest_id, match_confidence)
select '00000000-0000-4000-8000-000000000001', l.id, d::date,
  (d + make_interval(hours => 12 + (abs(hashtext('r' || l.id::text || d::text || n::text)) % 10)))::timestamptz,
  ps.p, ps.p,
  case when st.s = 'seated' then ps.p when st.s = 'no_show' then 0 else null end,
  st.s,
  case when (abs(hashtext('g' || l.id::text || d::text || n::text)) % 5) = 0 then null
       else ('00000000-0000-4000-8000-0000000002' || lpad((10 + (abs(hashtext('g2' || l.id::text || d::text || n::text)) % 60))::text, 2, '0'))::uuid end,
  'none'
from public.locations l
cross join generate_series(current_date - 89, current_date + 13, interval '1 day') d
cross join generate_series(1, 6) n
cross join lateral (select 2 + (abs(hashtext('p' || l.id::text || d::text || n::text)) % 6) as p) ps
cross join lateral (
  select case when d::date > current_date then 'booked'
              when (abs(hashtext('st' || l.id::text || d::text || n::text)) % 20) = 0 then 'no_show'
              when (abs(hashtext('st' || l.id::text || d::text || n::text)) % 13) = 0 then 'cancelled'
              else 'seated' end as s
) st
where d::date >= greatest(l.opened_on, current_date - 89) and l.name not like 'Butter%';

-- match a majority of seated reservations to a same-venue, same-day dine-in order (explicit demo POS sync reference)
update public.reservations r
set matched_order_id = m.oid, match_confidence = 'high'
from (
  select r2.id rid, (select o.id from public.canonical_orders o
                     where o.location_id = r2.location_id and o.business_date = r2.business_date
                       and o.fulfilment_type = 'dine_in' and o.counts_in_revenue
                     order by md5(r2.id::text || o.id::text) limit 1) oid
  from public.reservations r2
  where r2.status = 'seated' and (abs(hashtext('mt' || r2.id::text)) % 10) < 7
) m
where m.rid = r.id and m.oid is not null;

-- PEOPLE
insert into public.employees (id, org_id, location_id, legal_entity_id, source_ref, display_name, role_title, department, joined_on, manager_name)
select ('00000000-0000-4000-8000-0000000003' || lpad(n::text, 2, '0'))::uuid,
  '00000000-0000-4000-8000-000000000001',
  l.id, l.legal_entity_id, 'DEMO-EMP-' || n,
  'Demo Employee ' || n,
  (array['Server','Chef de Partie','Sous Chef','Host','Barista','Runner','Assistant Manager'])[1 + (n % 7)],
  (array['Front of House','Kitchen','Bar','Management'])[1 + (n % 4)],
  current_date - (200 + n * 11),
  l.manager_name
from generate_series(10, 33) n
join public.locations l on l.id = (array['00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000032','00000000-0000-4000-8000-000000000033','00000000-0000-4000-8000-000000000034']::uuid[])[1 + (n % 4)];

insert into public.restricted_documents (org_id, employee_id, doc_type, masked_number, issuing_authority, jurisdiction, issue_date, expiry_date, renewal_target_date, verification_status, status, owner_name, source_timestamp)
select e.org_id, e.id, dt.t,
  '••••' || lpad((abs(hashtext(e.id::text || dt.t)) % 9999)::text, 4, '0'),
  'Demo Issuing Authority', 'Dubai, UAE',
  current_date - 700,
  current_date + ((abs(hashtext('ex' || e.id::text || dt.t)) % 400) - 20),
  current_date + ((abs(hashtext('ex' || e.id::text || dt.t)) % 400) - 50),
  case when (abs(hashtext('v' || e.id::text || dt.t)) % 8) = 0 then 'verification_needed' else 'verified' end,
  'verification_needed', 'Demo PRO Owner', now() - interval '1 day'
from public.employees e
cross join (values ('Residence visa'),('Emirates ID'),('Passport'),('Health insurance')) dt(t);

update public.restricted_documents set status = case
  when expiry_date < current_date then 'expired'
  when verification_status = 'verification_needed' then 'verification_needed'
  when expiry_date <= current_date + 30 then 'action_required'
  when expiry_date <= current_date + 90 then 'upcoming'
  else 'valid' end::public.doc_status;

insert into public.renewal_tasks (org_id, document_id, threshold_days, due_date, status, owner_name, notes)
select d.org_id, d.id, th.t, d.expiry_date - th.t, 'open', d.owner_name,
  'Generated from configured operational reminder threshold. Penalty exposure not calculated — HR review required.'
from public.restricted_documents d
cross join (values (90),(60),(30),(14),(7)) th(t)
where d.verification_status = 'verified'
  and d.expiry_date - th.t between current_date - 3 and current_date + 3
on conflict do nothing;

-- INVESTORS
insert into public.investors (id, org_id, display_name, contact_note) values
('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000001','Demo Investor A',''),
('00000000-0000-4000-8000-000000000042','00000000-0000-4000-8000-000000000001','Demo Investor B','');

insert into public.capital_commitments (id, org_id, investor_id, legal_entity_id, instrument_type, share_class, committed_amount, ownership_pct, effective_from, tranche_label) values
('00000000-0000-4000-8000-000000000051','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000012','equity','Ordinary A', 2000000, 0.125, current_date - 620, 'Tranche 1'),
('00000000-0000-4000-8000-000000000052','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000012','convertible_loan', null, 500000, null, current_date - 200, 'Convertible note'),
('00000000-0000-4000-8000-000000000053','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000042','00000000-0000-4000-8000-000000000013','equity','Ordinary A', 1200000, 0.08, current_date - 400, 'Tranche 1');

insert into public.contribution_entries (org_id, commitment_id, paid_on, amount, reference) values
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000051', current_date - 610, 1200000,'DEMO-CALL-1'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000051', current_date - 300, 500000,'DEMO-CALL-2'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000052', current_date - 195, 500000,'DEMO-NOTE-1'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000053', current_date - 395, 900000,'DEMO-CALL-1');

insert into public.distribution_entries (org_id, commitment_id, paid_on, amount, kind, reference) values
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000051', current_date - 200, 90000,'dividend','DEMO-DIST-1'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000051', current_date - 60, 60000,'dividend','DEMO-DIST-2'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000053', current_date - 120, 25000,'return_of_capital','DEMO-DIST-1');

insert into public.valuations (org_id, legal_entity_id, valuation_date, equity_value, currency, method, basis, assumptions, share_class, status, prepared_by, approved_by, approved_at, published_at, evidence_ref) values
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000012', current_date - 150, 24000000,'AED','Demo EBITDA multiple (illustrative)','Equity value','Synthetic demo assumptions only. Not a real valuation.','Ordinary A','published','Demo Preparer','Demo Approver', now() - interval '150 days', now() - interval '148 days','DEMO-VAL-DOC-1'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000013', current_date - 10, 9000000,'AED','Demo EBITDA multiple (illustrative)','Equity value','Draft — not approved, not visible to investors.','Ordinary A','draft','Demo Preparer', null, null, null, null);

insert into public.published_reports (org_id, legal_entity_id, title, period_start, period_end, period_close_status, body, published_at) values
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000012','Demo entity performance update', date_trunc('month', current_date - 60)::date, (date_trunc('month', current_date - 30) - interval '1 day')::date,'closed','Synthetic demo update for CQ Brasserie Ventures LLC (Demo). Figures are fictional.', now() - interval '25 days');

insert into public.budgets (org_id, location_id, period_month, net_sales_target)
select '00000000-0000-4000-8000-000000000001', l.id, date_trunc('month', d)::date,
  round((300000 + (abs(hashtext(l.id::text || d::text)) % 180000))::numeric, 2)
from public.locations l
cross join generate_series(date_trunc('month', current_date - interval '3 months'), date_trunc('month', current_date), interval '1 month') d;

-- INTEGRATIONS
insert into public.integrations (org_id, provider, location_id, mode, status, credentials_saved, connection_verified, data_reconciled, capability_notes, dependency_note, historical_from, last_success_at, row_count)
select '00000000-0000-4000-8000-000000000001','foodics', l.id,'demo','demo', false, false, false,
 'Planned read-only: GET /orders, /orders/{id}, /branches, /products, /categories, /payment_methods. Rate limit 90 req/min per token per IP (verify current contract).',
 'Needs client-authorized OAuth credentials and confirmed scopes on api.foodics.com/v5. Verify filter, include and status enum semantics before live use.',
 current_date - 89, now() - interval '6 hours', (select count(*) from public.canonical_orders o where o.location_id = l.id)
from public.locations l;

insert into public.integrations (org_id, provider, location_id, mode, status, credentials_saved, connection_verified, capability_notes, dependency_note, historical_from, last_success_at, row_count)
select '00000000-0000-4000-8000-000000000001','grubtech', l.id,'demo', (case when l.name like 'Girl%' then 'stale' else 'demo' end)::public.integration_status, false, false,
 'Planned read-only bulk pull: GET /order-api/orders with fromDate, toDate, page (0-based), size; optional status, locationIds. Historical completed/cancelled coverage only.',
 'Needs client-authorized Data API access, approved authentication and a confirmed production host. Staging host must not be used as production. Live/open orders are not proven available.',
 current_date - 89, case when l.name like 'Girl%' then now() - interval '4 days' else now() - interval '7 hours' end,
 (select count(*) from public.order_source_links sl join public.canonical_orders o on o.id = sl.order_id where sl.provider='grubtech' and o.location_id = l.id)
from public.locations l;

insert into public.integrations (org_id, provider, location_id, mode, status, capability_notes, dependency_note) values
('00000000-0000-4000-8000-000000000001','supy', null,'demo','pending_access','Intended source of truth for stock, recipes, ingredients, units, suppliers, purchases, receipts, transfers, waste and cost history.','Awaiting approved Supy Open API / data-sharing contract, entitlements and verified read datasets. Validated file import can be the approved initial route.'),
('00000000-0000-4000-8000-000000000001','eat_app', null,'demo','pending_access','Intended source for reservations and recorded guest behaviour (restaurant-group access).','Awaiting confirmed restaurant-group/Concierge scopes, verified endpoints, history depth and pagination behaviour.'),
('00000000-0000-4000-8000-000000000001','hr_provider', null,'demo','not_configured','Provider-neutral HR adapter with documented field mapping and controlled import.','HR vendor not yet named. No portal scraping. Payroll and attendance depend on inputs actually supplied.'),
('00000000-0000-4000-8000-000000000001','accounting', null,'demo','not_configured','Approved accounting import for expenses, rent, overhead, cash, debt, depreciation and close status.','Required before actual food cost %, EBITDA, cash balance or investor returns can be shown.');

insert into public.data_quality_issues (org_id, location_id, kind, detail, severity) values
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000033','missing_recipe_mapping','Seasonal Tart (BT-203) has no effective recipe cost. Margin is shown as unavailable, never as 100%.','high'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000034','duplicate_overlap','1 Grubtech record represents a sale already settled in Foodics and is excluded from revenue.','medium'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000034','ambiguous_overlap','1 order held for review: candidate overlap not confirmed by a shared provider reference. Excluded from headline revenue.','medium'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000034','stale_source','Grubtech demo source last refreshed more than 72 hours ago for this venue.','medium'),
('00000000-0000-4000-8000-000000000001',null,'unmatched_reservations','Some seated reservations have no confident order match. They keep their covers and receive no invented spend.','low');

insert into public.alerts (org_id, location_id, kind, severity, title, detail, evidence, owner_name, due_date, source_freshness) values
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000033','margin','high','Seasonal Tart margin cannot be calculated','No effective recipe cost is mapped for BT-203, so contribution is unavailable rather than assumed.','{"metric":"recipe_contribution","item":"BT-203","reason":"missing_recipe_version"}','Demo Inventory Owner', current_date + 3, now() - interval '6 hours'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000031','inventory','high','Low stock on Beef sirloin affects a top seller','Latest Supy demo snapshot is below the configured reorder threshold while Steak Frites remains a leading item.','{"metric":"days_of_cover","ingredient":"Beef sirloin"}','Demo Inventory Owner', current_date + 1, now() - interval '5 hours'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000034','sync','medium','Grubtech demo source is stale for this venue','Last successful refresh was more than 72 hours ago. Figures are labelled stale rather than adjusted.','{"provider":"grubtech","threshold_hours":72}','Demo Technical Admin', current_date, now() - interval '4 days'),
('00000000-0000-4000-8000-000000000001',null,'renewal','medium','Document renewals reaching a configured reminder threshold','Operational reminders only. Penalty exposure not calculated — HR review required.','{"thresholds":[90,60,30,14,7]}','Demo PRO Owner', current_date + 5, now() - interval '1 day'),
('00000000-0000-4000-8000-000000000001',null,'valuation','medium','Butter Bakehouse LLC (Demo) has no approved valuation','Only a draft exists. Investor views show Valuation pending.','{"entity":"Butter Bakehouse LLC (Demo)","status":"draft"}','Demo IR Owner', current_date + 10, now() - interval '10 days'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000032','sales','low','New venue excluded from comparable-period growth','Barsha Heights opened inside the comparison window, so it is reported separately.','{"metric":"pct_change","reason":"no_matched_baseline"}','Demo Leadership Owner', current_date + 7, now() - interval '6 hours');
