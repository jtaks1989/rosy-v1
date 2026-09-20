-- Pre-aggregated daily item snapshot for menu intelligence
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mart_menu_engineering_daily AS
SELECT
  m.org_id,
  m.business_date,
  m.location_id,
  m.location_name,
  m.brand_name,
  m.product_id,
  m.item_name,
  m.category,
  m.pos_item_id,
  m.is_available,
  m.channel,
  m.fulfilment_type,
  m.daypart,
  m.day_type,
  m.recipe_cost_per_unit,
  m.cost_effective_from,
  m.cost_source,
  m.source_system,
  sum(m.units) AS units,
  sum(m.net_revenue) AS net_revenue,
  sum(m.gross_revenue) AS gross_revenue,
  sum(m.discounts) AS discounts
FROM public.mart_menu_engineering m
GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18;

CREATE INDEX IF NOT EXISTS mart_menu_eng_daily_date_loc_idx
  ON public.mart_menu_engineering_daily (business_date, location_id);
CREATE INDEX IF NOT EXISTS mart_menu_eng_daily_product_idx
  ON public.mart_menu_engineering_daily (product_id, business_date);

CREATE INDEX IF NOT EXISTS canonical_orders_business_date_idx
  ON public.canonical_orders (business_date);
CREATE INDEX IF NOT EXISTS recipe_versions_product_effective_idx
  ON public.recipe_versions (product_id, effective_from DESC);

REVOKE ALL ON public.mart_menu_engineering_daily FROM anon, authenticated;
GRANT SELECT ON public.mart_menu_engineering_daily TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_mart_menu_engineering_daily()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$ REFRESH MATERIALIZED VIEW public.mart_menu_engineering_daily; $$;

CREATE OR REPLACE FUNCTION public.trg_refresh_mart_menu_engineering_daily()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.mart_menu_engineering_daily;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS refresh_menu_mart_order_lines ON public.order_lines;
CREATE TRIGGER refresh_menu_mart_order_lines
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.order_lines
FOR EACH STATEMENT EXECUTE FUNCTION public.trg_refresh_mart_menu_engineering_daily();

DROP TRIGGER IF EXISTS refresh_menu_mart_orders ON public.canonical_orders;
CREATE TRIGGER refresh_menu_mart_orders
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.canonical_orders
FOR EACH STATEMENT EXECUTE FUNCTION public.trg_refresh_mart_menu_engineering_daily();

DROP TRIGGER IF EXISTS refresh_menu_mart_recipes ON public.recipe_versions;
CREATE TRIGGER refresh_menu_mart_recipes
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.recipe_versions
FOR EACH STATEMENT EXECUTE FUNCTION public.trg_refresh_mart_menu_engineering_daily();

DROP TRIGGER IF EXISTS refresh_menu_mart_products ON public.products;
CREATE TRIGGER refresh_menu_mart_products
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.products
FOR EACH STATEMENT EXECUTE FUNCTION public.trg_refresh_mart_menu_engineering_daily();