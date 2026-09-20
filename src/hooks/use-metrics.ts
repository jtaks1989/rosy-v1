import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { locArg } from "@/lib/metrics";
import type { Filters } from "@/lib/filters";

type Row = Record<string, any>;

function rpc<T = Row[]>(name: string, args: Record<string, unknown>, key: unknown[], enabled = true) {
  return {
    queryKey: [name, ...key],
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(name, args);
      if (error) throw new Error(error.message);
      return (data ?? []) as T;
    },
  };
}

export function useSalesSummary(f: Filters, enabled = true) {
  return useQuery(
    rpc<Row[]>(
      "rosy_sales_summary",
      { p_from: f.from, p_to: f.to, ...locArg(f.locations) },
      [f.from, f.to, f.locations.join(",")],
      enabled,
    ),
  );
}

export function useComparisonSummary(f: Filters, enabled = true) {
  return useQuery(
    rpc<Row[]>(
      "rosy_sales_summary",
      { p_from: f.prevFrom, p_to: f.prevTo, ...locArg(f.locations) },
      ["prev", f.prevFrom, f.prevTo, f.locations.join(",")],
      enabled,
    ),
  );
}

export function useTrend(f: Filters, enabled = true) {
  return useQuery(
    rpc<Row[]>(
      "rosy_sales_trend",
      { p_from: f.from, p_to: f.to, ...locArg(f.locations) },
      [f.from, f.to, f.locations.join(",")],
      enabled,
    ),
  );
}

export function useChannelMix(f: Filters, enabled = true) {
  return useQuery(
    rpc<Row[]>(
      "rosy_channel_mix",
      { p_from: f.from, p_to: f.to, ...locArg(f.locations) },
      [f.from, f.to, f.locations.join(",")],
      enabled,
    ),
  );
}

export function useChannelMixByLocation(f: Filters, enabled = true) {
  return useQuery(
    rpc<Row[]>(
      "rosy_channel_mix_by_location",
      { p_from: f.from, p_to: f.to, ...locArg(f.locations) },
      [f.from, f.to, f.locations.join(",")],
      enabled,
    ),
  );
}

export function useEodByLocation(f: Filters, enabled = true) {
  return useQuery(
    rpc<Row[]>(
      "rosy_eod_by_location",
      { p_from: f.from, p_to: f.to, ...locArg(f.locations) },
      [f.from, f.to, f.locations.join(",")],
      enabled,
    ),
  );
}

export function useVenueComparison(f: Filters, enabled = true) {
  return useQuery(
    rpc<Row[]>(
      "rosy_venue_comparison",
      { p_from: f.from, p_to: f.to, p_prev_from: f.prevFrom, p_prev_to: f.prevTo },
      [f.from, f.to, f.prevFrom],
      enabled,
    ),
  );
}

export function useMenuPerformance(f: Filters, enabled = true) {
  return useQuery(
    rpc<Row[]>(
      "rosy_menu_performance",
      { p_from: f.from, p_to: f.to, ...locArg(f.locations) },
      [f.from, f.to, f.locations.join(",")],
      enabled,
    ),
  );
}

export function useInventoryRisk(f: Filters, enabled = true) {
  return useQuery(
    rpc<Row[]>("rosy_inventory_risk", { ...locArg(f.locations) }, [f.locations.join(",")], enabled),
  );
}

export function useGuestCohorts(f: Filters, enabled = true) {
  return useQuery(
    rpc<Row[]>(
      "rosy_guest_cohorts",
      { p_from: f.from, p_to: f.to, ...locArg(f.locations) },
      [f.from, f.to, f.locations.join(",")],
      enabled,
    ),
  );
}

export function useDemandHeatmap(f: Filters, enabled = true) {
  return useQuery(
    rpc<Row[]>(
      "rosy_demand_heatmap",
      { p_from: f.from, p_to: f.to, ...locArg(f.locations) },
      [f.from, f.to, f.locations.join(",")],
      enabled,
    ),
  );
}

export function useRenewalQueue(days: number, enabled = true) {
  return useQuery(rpc<Row[]>("rosy_renewal_queue", { p_days: days }, [days], enabled));
}

export function useMyInvestments(enabled = true) {
  return useQuery(rpc<Row[]>("rosy_my_investments", {}, ["mine"], enabled));
}

export function useTable(
  key: string,
  build: () => any,
  deps: unknown[] = [],
  enabled = true,
) {
  return useQuery({
    queryKey: [key, ...deps],
    enabled,
    queryFn: async () => {
      const { data, error } = await build();
      if (error) throw new Error(error.message);
      return (data ?? []) as Row[];
    },
  });
}

export const first = (rows: Row[] | undefined) => (rows && rows.length ? rows[0]! : undefined);
