UPDATE public.payment_entries p
SET tender = 'Aggregator Paid — Demo'
FROM public.canonical_orders c
WHERE c.id = p.order_id AND c.channel = 'Delivery — Demo Aggregator';

CREATE OR REPLACE FUNCTION public.rosy_eod_by_location(p_from date, p_to date, p_locations uuid[] DEFAULT NULL)
RETURNS TABLE(
  location_id uuid,
  location_name text,
  brand_name text,
  section text,
  section_order integer,
  line_order integer,
  name text,
  quantity numeric,
  amount numeric,
  amount_is_null boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH scope AS (
  SELECT l.id, l.name, b.name AS brand
  FROM public.locations l
  JOIN public.brands b ON b.id = l.brand_id
  WHERE public.has_permission('view_sales')
    AND public.has_location_access(l.id)
    AND (p_locations IS NULL OR l.id = ANY(p_locations))
),
o AS (
  SELECT c.*
  FROM public.canonical_orders c
  JOIN scope s ON s.id = c.location_id
  WHERE c.business_date BETWEEN p_from AND p_to
),
rev AS (SELECT * FROM o WHERE counts_in_revenue),
agg AS (
  SELECT s.id, s.name, s.brand,
    COALESCE(SUM(r.net_sales_ex_tax), 0) AS net,
    COALESCE(SUM(r.discount_total), 0) AS disc,
    COALESCE(SUM(r.tax_total), 0) AS tax,
    COALESCE(SUM(r.charge_total), 0) AS chg,
    COALESCE(SUM(r.refund_total), 0) AS refunds,
    COUNT(r.id) AS orders,
    COALESCE(SUM(r.covers), 0) AS covers,
    COUNT(r.id) FILTER (WHERE r.charge_total > 0) AS charge_orders
  FROM scope s LEFT JOIN rev r ON r.location_id = s.id
  GROUP BY s.id, s.name, s.brand
),
voids AS (
  SELECT s.id,
    COUNT(v.id) AS qty,
    COALESCE(SUM(v.net_sales_ex_tax), 0) AS amount
  FROM scope s
  LEFT JOIN o v ON v.location_id = s.id AND v.status IN ('cancelled', 'rejected')
  GROUP BY s.id
),
general AS (
  SELECT a.id, a.name, a.brand, 'general'::text AS section, 1 AS section_order, x.line_order, x.nm, x.qty, x.amt, x.qty_null
  FROM agg a
  LEFT JOIN voids v ON v.id = a.id
  CROSS JOIN LATERAL (VALUES
    (1, 'Gross Sales', a.orders::numeric, a.net + a.disc + a.tax, false),
    (2, 'Gross Sales Without Tax', a.orders::numeric, a.net + a.disc, false),
    (3, 'Total Discounts', a.orders::numeric, a.disc, false),
    (4, 'Total Charges', a.charge_orders::numeric, a.chg, false),
    (5, 'Total Taxes', NULL::numeric, a.tax, true),
    (6, 'Net Sales', a.orders::numeric, a.net, false),
    (7, 'Guest Count', a.covers::numeric, NULL::numeric, false),
    (8, 'Average Per Order', NULL::numeric, CASE WHEN a.orders > 0 THEN a.net / a.orders END, true),
    (9, 'Average Per Guest', NULL::numeric, CASE WHEN a.covers > 0 THEN a.net / a.covers END, true),
    (10, 'Total Void', COALESCE(v.qty, 0)::numeric, COALESCE(v.amount, 0), false),
    (11, 'Total Refunds', NULL::numeric, a.refunds, true),
    (12, 'Rounding', 0::numeric, 0::numeric, false)
  ) AS x(line_order, nm, qty, amt, qty_null)
),
charges AS (
  SELECT a.id, a.name, a.brand, 'charges'::text, 2, 1, 'Service Charge'::text, a.charge_orders::numeric, a.chg, false
  FROM agg a
),
types AS (
  SELECT a.id, a.name, a.brand, 'order_types'::text, 3, t.line_order, t.label,
    COALESCE(COUNT(r.id), 0)::numeric,
    COALESCE(SUM(r.net_sales_ex_tax), 0),
    false
  FROM agg a
  CROSS JOIN (VALUES (1, 'Dine In', 'dine_in'), (2, 'Pick Up', 'pickup'), (3, 'Delivery', 'delivery'), (4, 'Drive Thru', 'drive_thru')) AS t(line_order, label, ft)
  LEFT JOIN rev r ON r.location_id = a.id AND r.fulfilment_type = t.ft
  GROUP BY a.id, a.name, a.brand, t.line_order, t.label
),
pay AS (
  SELECT a.id, a.name, a.brand, 'payments'::text AS section, 4 AS section_order,
    ROW_NUMBER() OVER (PARTITION BY a.id ORDER BY SUM(pe.amount) DESC)::int AS line_order,
    pe.tender AS nm, COUNT(pe.id)::numeric AS qty, SUM(pe.amount) AS amt, false AS qty_null
  FROM agg a
  JOIN rev r ON r.location_id = a.id
  JOIN public.payment_entries pe ON pe.order_id = r.id
  GROUP BY a.id, a.name, a.brand, pe.tender
),
pay_total AS (
  SELECT a.id, a.name, a.brand, 'payments'::text, 4, 90, 'Total Payments'::text, NULL::numeric,
    COALESCE((SELECT SUM(pe.amount) FROM rev r JOIN public.payment_entries pe ON pe.order_id = r.id WHERE r.location_id = a.id), 0), true
  FROM agg a
  UNION ALL
  SELECT a.id, a.name, a.brand, 'payments'::text, 4, 91, 'Total Return'::text, NULL::numeric, a.refunds, true
  FROM agg a
  UNION ALL
  SELECT a.id, a.name, a.brand, 'payments'::text, 4, 92, 'Net Payments'::text, NULL::numeric,
    COALESCE((SELECT SUM(pe.amount) FROM rev r JOIN public.payment_entries pe ON pe.order_id = r.id WHERE r.location_id = a.id), 0) - a.refunds, true
  FROM agg a
),
by_type AS (
  SELECT a.id, a.name, a.brand, 'net_payments_by_type'::text, 5, t.line_order, t.label,
    NULL::numeric,
    COALESCE((
      SELECT SUM(pe.amount) FROM rev r JOIN public.payment_entries pe ON pe.order_id = r.id
      WHERE r.location_id = a.id
        AND CASE
          WHEN pe.tender ILIKE '%cash%' THEN 'cash'
          WHEN pe.tender ILIKE '%card%' AND pe.tender NOT ILIKE '%gift%' THEN 'card'
          WHEN pe.tender ILIKE '%gift%' THEN 'gift'
          WHEN pe.tender ILIKE '%house%' THEN 'house'
          WHEN pe.tender ILIKE '%aggregator%' OR pe.tender ILIKE '%deliveroo%' OR pe.tender ILIKE '%talabat%' THEN 'third'
          ELSE 'other' END = t.bucket
    ), 0),
    true
  FROM agg a
  CROSS JOIN (VALUES (1, 'Cash', 'cash'), (2, 'Card', 'card'), (3, 'Third Party', 'third'), (4, 'Gift Card', 'gift'), (5, 'House Account', 'house'), (6, 'Other', 'other')) AS t(line_order, label, bucket)
)
SELECT * FROM (
  SELECT * FROM general
  UNION ALL SELECT * FROM charges
  UNION ALL SELECT * FROM types
  UNION ALL SELECT * FROM pay
  UNION ALL SELECT * FROM pay_total
  UNION ALL SELECT * FROM by_type
) u
ORDER BY 2, 5, 6;
$$;

REVOKE ALL ON FUNCTION public.rosy_eod_by_location(date, date, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rosy_eod_by_location(date, date, uuid[]) TO authenticated;