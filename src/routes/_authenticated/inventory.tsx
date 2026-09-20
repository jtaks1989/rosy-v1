import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-access";
import { useFilters, scopeLabel } from "@/lib/filters";
import { useInventoryRisk } from "@/hooks/use-metrics";
import {
  EmptyState,
  EvidenceFooter,
  KpiCard,
  LoadingRows,
  NoPermission,
  PageHeader,
  Section,
  StatusChip,
} from "@/components/rosy/primitives";
import { money, count, prettyDate, NOT_AVAILABLE } from "@/lib/format";
import { AttentionPanel, type AttentionItem } from "@/components/rosy/attention";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory & procurement — Rosy AI" },
      {
        name: "description",
        content:
          "Latest counted stock, reorder risk, expiry watch and recorded waste for the venues in your scope.",
      },
      { property: "og:title", content: "Inventory & procurement — Rosy AI" },
      { property: "og:description", content: "Counted stock, reorder risk, expiry watch and waste." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Inventory,
});

function Inventory() {
  const { data: access } = useAccess();
  const f = useFilters();
  const allowed = access?.permissions.includes("view_inventory") ?? false;
  const stock = useInventoryRisk(f, allowed);

  const waste = useQuery({
    queryKey: ["waste", f.from, f.to, f.locations.join(",")],
    enabled: allowed,
    queryFn: async () => {
      let q = supabase
        .from("waste_entries")
        .select("id, occurred_on, location_id, reason, quantity, unit, value_aed")
        .gte("occurred_on", f.from)
        .lte("occurred_on", f.to)
        .order("occurred_on", { ascending: false })
        .limit(50);
      if (f.locations.length) q = q.in("location_id", f.locations);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  if (access && !allowed) return <NoPermission what="inventory and procurement" />;

  const rows = stock.data ?? [];
  const low = rows.filter((r) => r["low_stock"]);
  const expiring = rows.filter((r) => {
    const d = r["expiry_date"] as string | null;
    if (!d) return false;
    const days = (new Date(d).getTime() - Date.now()) / 86_400_000;
    return days <= 7;
  });
  const stockValue = rows.reduce((a, r) => a + Number(r["value_aed"] ?? 0), 0);
  const wasteValue = (waste.data ?? []).reduce((a, r: any) => a + Number(r.value_aed ?? 0), 0);
  const names = new Map((access?.locations ?? []).map((l) => [l.id, l.name]));
  const lastCount = rows
    .map((r) => String(r["as_of_date"]))
    .sort()
    .at(-1);
  const outOfCover = rows.filter((r) => r["days_cover"] != null && Number(r["days_cover"]) <= 2);
  const staleCount = lastCount
    ? (Date.now() - new Date(`${lastCount}T00:00:00Z`).getTime()) / 86_400_000 > 3
    : false;

  const attention: AttentionItem[] = [];
  if (expiring.length)
    attention.push({
      severity: "critical",
      headline: "Stock expiring within 7 days",
      metric: count(expiring.length),
      detail: "Use, transfer or write off before these items become waste.",
    });
  if (outOfCover.length)
    attention.push({
      severity: "critical",
      headline: "Two days of cover or less",
      metric: count(outOfCover.length),
      detail: "At current usage these lines run out before the next likely delivery.",
    });
  if (low.length)
    attention.push({
      severity: "warning",
      headline: "At or below reorder level",
      metric: count(low.length),
      detail: "Raise these with the supplier in the next ordering round.",
    });
  if (wasteValue > 0)
    attention.push({
      severity: wasteValue > 3000 ? "warning" : "watch",
      headline: "Recorded waste in period",
      metric: money(wasteValue),
      detail: "Waste value logged against the venues in scope for the selected period.",
    });
  if (staleCount)
    attention.push({
      severity: "watch",
      headline: "Counts are ageing",
      metric: prettyDate(lastCount),
      detail: "The newest stock count in scope is more than three days old, so risk flags may lag reality.",
    });

  return (
    <>
      <PageHeader
        title="Inventory & procurement"
        intro="Read-only stock and waste from the counted snapshots that exist. Nothing here is a live stock ledger, and no purchase order can be raised from this platform."
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusChip tone="warning">Inventory system not connected — demo adapter</StatusChip>
          </div>
        }
      />

      {stock.isLoading ? null : (
        <AttentionPanel
          items={attention}
          description="Stock and waste risks for the venues and period you have selected."
          clearMessage="No stock line in scope is short, expiring or wasteful right now."
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Counted stock value"
          value={rows.length ? money(stockValue) : NOT_AVAILABLE}
          unavailableReason={rows.length ? undefined : "No counted snapshot exists for this scope"}
          note={lastCount ? `latest count ${prettyDate(lastCount)}` : undefined}
        />
        <KpiCard label="At or below reorder level" value={count(low.length)} />
        <KpiCard label="Expiring within 7 days" value={count(expiring.length)} />
        <KpiCard
          label="Recorded waste in period"
          value={money(wasteValue)}
          note={`${count((waste.data ?? []).length)} entries`}
          definition="Value of waste entries recorded against the venues in scope."
        />
      </div>

      <Section
        title="Stock risk"
        description="Latest counted snapshot per venue, worst risk first. A missing snapshot reads as unavailable, never as zero stock."
      >
        {stock.isLoading ? (
          <LoadingRows rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No counted stock in scope"
            description="Connect an inventory system, or record counts, before treating stock levels as reliable."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="py-2 pr-3">Ingredient</th>
                  <th className="py-2 pr-3">Venue</th>
                  <th className="py-2 pr-3 text-right">On hand</th>
                  <th className="py-2 pr-3 text-right">Reorder level</th>
                  <th className="py-2 pr-3 text-right">Days cover</th>
                  <th className="py-2 pr-3 text-right">Value</th>
                  <th className="py-2 pr-3">Expiry</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 60).map((r) => (
                  <tr
                    key={`${String(r["location_id"])}-${String(r["ingredient_id"])}`}
                    className="border-b border-border/60"
                  >
                    <td className="py-2 pr-3">
                      {String(r["ingredient_name"])}
                      <span className="block text-xs text-muted-foreground">
                        counted {prettyDate(r["as_of_date"] as string)} · {String(r["source"])}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{String(r["location_name"])}</td>
                    <td className="num py-2 pr-3 text-right">
                      {Number(r["quantity"])} {String(r["unit"])}
                    </td>
                    <td className="num py-2 pr-3 text-right">
                      {r["reorder_threshold"] == null ? "Not set" : Number(r["reorder_threshold"])}
                    </td>
                    <td className="num py-2 pr-3 text-right">
                      {r["days_cover"] == null ? NOT_AVAILABLE : Number(r["days_cover"])}
                    </td>
                    <td className="num py-2 pr-3 text-right">
                      {r["value_aed"] == null ? NOT_AVAILABLE : money(Number(r["value_aed"]))}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {r["expiry_date"] ? prettyDate(r["expiry_date"] as string) : "—"}
                    </td>
                    <td className="py-2">
                      {r["low_stock"] ? (
                        <StatusChip tone="warning">Reorder</StatusChip>
                      ) : (
                        <StatusChip tone="positive">Healthy</StatusChip>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <EvidenceFooter
          scope={scopeLabel(f, names)}
          period={lastCount ? `Latest counted snapshot (${prettyDate(lastCount)})` : "No snapshot available"}
          sources="Demo inventory adapter. When an inventory system is connected it becomes the source of truth for stock, and this view will label its freshness."
          metric="Reorder flag = counted quantity at or below the recorded reorder level. Days cover is only shown where the source provides it."
          limitations="Synthetic demo data. Stock is a point-in-time count, not a live ledger, and consumption since the count is not reflected."
        />
      </Section>

      <Section title="Recorded waste" description="Waste entries in the selected period, most recent first.">
        {waste.isLoading ? (
          <LoadingRows />
        ) : (waste.data ?? []).length === 0 ? (
          <EmptyState
            title="No waste recorded"
            description="No waste entries exist for this period and scope. That is an absence of records, not proof of zero waste."
          />
        ) : (
          <ul className="divide-y divide-border text-sm">
            {(waste.data ?? []).map((w: any) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {String(w.reason).replace(/_/g, " ")}
                  <span className="block text-xs text-muted-foreground">
                    {prettyDate(w.occurred_on)} · {names.get(w.location_id) ?? "Venue outside your labels"} ·
                    demo waste log
                  </span>
                </span>
                <span className="num">
                  {Number(w.quantity)} {w.unit} · {money(Number(w.value_aed ?? 0))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
