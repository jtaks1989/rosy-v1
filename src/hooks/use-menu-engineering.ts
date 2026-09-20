import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Filters } from "@/lib/filters";
import { locArg } from "@/lib/metrics";
import type { MenuEngConfig, MenuEngRow } from "@/lib/menu-engineering";

export type MenuEngFilters = {
  categories: string[];
  channels: string[];
  fulfilment: string[];
  dayparts: string[];
  dayType: "" | "weekday" | "weekend";
};

export const EMPTY_ME_FILTERS: MenuEngFilters = {
  categories: [],
  channels: [],
  fulfilment: [],
  dayparts: [],
  dayType: "",
};

const arg = (list: string[]) => (list.length ? list : null);

/**
 * Single governed read for the whole Menu Engineering section: classification,
 * thresholds, confidence and the matched previous period all come from the
 * database function so no component invents its own version of a metric.
 */
export function useMenuEngineering(
  f: Filters,
  cfg: MenuEngConfig,
  mf: MenuEngFilters,
  enabled = true,
) {
  const args = {
    p_from: f.from,
    p_to: f.to,
    p_prev_from: f.comparison === "none" ? null : f.prevFrom,
    p_prev_to: f.comparison === "none" ? null : f.prevTo,
    ...locArg(f.locations),
    p_categories: arg(mf.categories),
    p_channels: arg(mf.channels),
    p_fulfilment: arg(mf.fulfilment),
    p_dayparts: arg(mf.dayparts),
    p_day_type: mf.dayType || null,
    p_min_units: cfg.minUnits,
    p_min_days: cfg.minDays,
    p_pop_factor: cfg.popularityFactor,
    p_profit_method: cfg.profitMethod,
    p_fixed_threshold: cfg.profitMethod === "fixed" ? cfg.fixedThreshold : null,
    p_consolidated: cfg.consolidated,
    p_peer_scope: cfg.peerScope,
  };

  return useQuery({
    queryKey: ["rosy_menu_engineering", JSON.stringify(args)],
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("rosy_menu_engineering", args);
      if (error) throw new Error(error.message);
      return (data ?? []) as MenuEngRow[];
    },
  });
}

export function useMenuItemTrend(productId: string | null, f: Filters, enabled = true) {
  return useQuery({
    queryKey: ["rosy_menu_item_trend", productId, f.from, f.to],
    enabled: enabled && Boolean(productId),
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("rosy_menu_item_trend", {
        p_product: productId,
        p_from: f.from,
        p_to: f.to,
        ...locArg(f.locations),
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as Record<string, any>[];
    },
  });
}

export function useMenuItemChannels(productId: string | null, f: Filters, enabled = true) {
  return useQuery({
    queryKey: ["rosy_menu_item_channels", productId, f.from, f.to],
    enabled: enabled && Boolean(productId),
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("rosy_menu_item_channels", {
        p_product: productId,
        p_from: f.from,
        p_to: f.to,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as Record<string, any>[];
    },
  });
}

export function useMenuItemVenues(itemName: string | null, f: Filters, enabled = true) {
  return useQuery({
    queryKey: ["rosy_menu_item_venues", itemName, f.from, f.to, f.locations.join(",")],
    enabled: enabled && Boolean(itemName),
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("rosy_menu_item_venues", {
        p_item_name: itemName,
        p_from: f.from,
        p_to: f.to,
        ...locArg(f.locations),
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as Record<string, any>[];
    },
  });
}

/** Filter options, read under the caller's own row-level security. */
export function useMenuFilterOptions(enabled = true) {
  return useQuery({
    queryKey: ["menu-filter-options"],
    enabled,
    staleTime: 300_000,
    queryFn: async () => {
      const [{ data: products, error: pErr }, { data: orders, error: oErr }] = await Promise.all([
        supabase.from("products").select("category, name").order("category"),
        supabase.from("canonical_orders").select("channel").limit(2000),
      ]);
      if (pErr) throw new Error(pErr.message);
      if (oErr) throw new Error(oErr.message);
      const categories = [...new Set((products ?? []).map((p) => p.category).filter(Boolean))] as string[];
      const items = [...new Set((products ?? []).map((p) => p.name))].sort();
      const channels = [...new Set((orders ?? []).map((o) => o.channel).filter(Boolean))].sort() as string[];
      return { categories: categories.sort(), items, channels };
    },
  });
}
