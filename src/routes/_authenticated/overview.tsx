import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAccess } from "@/hooks/use-access";
import { useFilters, scopeLabel } from "@/lib/filters";
import {
  useSalesSummary,
  useComparisonSummary,
  useTrend,
  useChannelMix,
  useVenueComparison,
  useRenewalQueue,
  useInventoryRisk,
  first,
} from "@/hooks/use-metrics";
import {
  EvidenceFooter,
  KpiCard,
  LoadingRows,
  NoPermission,
  PageHeader,
  Section,
  StatusChip,
  EmptyState,
} from "@/components/rosy/primitives";
import { money, count, pct, change, NOT_AVAILABLE, freshness } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/overview")({
  head: () => ({
    meta: [
      { title: "Leadership overview — Rosy AI" },
      {
        name: "description",
        content:
          "Group performance across every Rosy Hospitality venue: net sales, orders, covers, channel mix and the venues that need attention.",
      },
      { property: "og:title", content: "Leadership overview — Rosy AI" },
      { property: "og:description", content: "Group performance across every Rosy Hospitality venue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { data: access } = useAccess();
  const f = useFilters();
  const allowed = access?.permissions.includes("view_overview") ?? false;

  const summary = useSalesSummary(f, allowed);
  const prev = useComparisonSummary(f, allowed && f.comparison !== "none");
  const trend = useTrend(f, allowed);
  const mix = useChannelMix(f, allowed);
  const venues = useVenueComparison(f, allowed);
  const renewals = useRenewalQueue(60, allowed && (access?.permissions.includes("view_people") ?? false));
  const stock = useInventoryRisk(f, allowed && (access?.permissions.includes("view_inventory") ?? false));

  if (access && !allowed) return <NoPermission what="the group overview" />;

  const s = first(summary.data);
  const p = first(prev.data);
  const names = new Map((access?.locations ?? []).map((l) => [l.id, l.name]));
  const scope = scopeLabel(f, names);
  const period = `${f.from} → ${f.to} (${f.span} business days)`;
  const lastRefresh = (venues.data ?? [])
    .map((v) => v["last_source_refresh"] as string | null)
    .filter(Boolean)
    .sort()
    .at(-1);

  const netChange = change(s ? Number(s["net_sales"]) : null, p ? Number(p["net_sales"]) : null);
  const mixTotal = (mix.data ?? []).reduce((a, r) => a + Number(r["net_sales"] ?? 0), 0);
  const lowStock = (stock.data ?? []).filter((r) => r["low_stock"]).length;
  const dueRenewals = (renewals.data ?? []).filter((r) => Number(r["days_to_expiry"]) <= 30).length;

  return (
    <>
      <PageHeader
        title="Leadership overview"
        intro="Group performance for the selected period, deduplicated to one canonical order per economic sale. Every figure here can be opened down to the venue, the day and the underlying orders."
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusChip tone="muted">Demo dataset</StatusChip>
            <StatusChip tone={lastRefresh ? "neutral" : "warning"}>
              {lastRefresh ? `Refreshed ${freshness(lastRefresh).label}` : "No successful sync recorded"}
            </StatusChip>
          </div>
        }
      />

      {summary.isLoading ? (
        <LoadingRows rows={2} />
      ) : summary.isError ? (
        <EmptyState
          title="Sales figures could not be loaded"
          description="The request was refused or failed. Nothing has been estimated in its place — reload, or narrow the period and try again."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Net sales"
            value={money(Number(s?.["net_sales"] ?? 0))}
            changeLabel={netChange.label}
            direction={netChange.direction}
            note={f.comparison === "none" ? "no comparison" : `vs ${f.prevFrom} → ${f.prevTo}`}
            definition="Sales excluding tax, after discounts and refunds, counting each canonical order once."
          />
          <KpiCard
            label="Orders"
            value={count(Number(s?.["orders"] ?? 0))}
            note={`${count(Number(s?.["excluded_orders"] ?? 0))} excluded as duplicates`}
            definition="Completed or partially refunded canonical orders. Duplicate provider records are excluded."
          />
          <KpiCard
            label="Average order value"
            value={s?.["aov"] == null ? NOT_AVAILABLE : money(Number(s["aov"]))}
            definition="Net sales divided by counted orders."
          />
          <KpiCard
            label="Spend per cover"
            value={s?.["spend_per_cover"] == null ? NOT_AVAILABLE : money(Number(s["spend_per_cover"]))}
            unavailableReason={
              s?.["spend_per_cover"] == null
                ? "Only high-confidence reservation-to-order matches count here, and none were found."
                : undefined
            }
            note={
              s?.["cover_coverage_pct"] == null
                ? undefined
                : `${pct(Number(s["cover_coverage_pct"]))} of covers matched`
            }
            definition="Matched net sales divided by matched seated covers. Never orders divided by reservations."
          />
        </div>
      )}

      <Section
        title="Net sales trend"
        description="Daily net sales on the Dubai business day, so late-night trade lands on the day it was earned."
        aside={
          <StatusChip tone="neutral">
            {count((trend.data ?? []).length)} days with recorded trade
          </StatusChip>
        }
      >
        {trend.isLoading ? (
          <LoadingRows rows={5} />
        ) : (trend.data ?? []).length === 0 ? (
          <EmptyState
            title="No trade recorded in this period"
            description="This is an empty result, not a zero. Check the period and venue filters, or whether the source has synced."
          />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={(trend.data ?? []).map((r) => ({
                  date: String(r["business_date"]).slice(5),
                  net: Number(r["net_sales"]),
                  orders: Number(r["orders"]),
                }))}
              >
                <defs>
                  <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--color-muted-foreground)"
                  tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                    fontSize: 12,
                  }}
                  formatter={(v: any, n: any) => (n === "net" ? money(Number(v)) : count(Number(v)))}
                />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#netFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <EvidenceFooter
          scope={scope}
          period={period}
          sources="Demo POS adapter (Foodics-shaped) and demo delivery adapter (Grubtech-shaped), deduplicated"
          freshness={lastRefresh ? freshness(lastRefresh).label : "No successful sync recorded"}
          metric="Net sales = gross ex tax − discounts − refunds, one canonical order per economic sale."
          limitations="Synthetic demo data. Delivery coverage is historical only, so recent delivery trade may be understated."
        />
      </Section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Section
          title="Venue comparison"
          description="Like-for-like growth is only shown where the venue was already open for the whole comparison period."
        >
          {venues.isLoading ? (
            <LoadingRows />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                    <th className="py-2 pr-3">Venue</th>
                    <th className="py-2 pr-3 text-right">Net sales</th>
                    <th className="py-2 pr-3 text-right">Change</th>
                    <th className="py-2 pr-3 text-right">Orders</th>
                    <th className="py-2 pr-3 text-right">Food cost</th>
                    <th className="py-2 pr-3 text-right">Waste</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {(venues.data ?? []).map((v) => {
                    const ch = change(
                      Number(v["net_sales"]),
                      v["prev_net_sales"] == null ? null : Number(v["prev_net_sales"]),
                    );
                    return (
                      <tr key={String(v["location_id"])} className="border-b border-border/60">
                        <td className="py-2 pr-3">
                          <span className="font-medium text-foreground">{String(v["location_name"])}</span>
                          <span className="block text-xs text-muted-foreground">
                            {String(v["brand_name"])}
                            {v["comparable"] ? "" : " · new venue, not comparable"}
                          </span>
                        </td>
                        <td className="num py-2 pr-3 text-right">{money(Number(v["net_sales"]))}</td>
                        <td
                          className={`num py-2 pr-3 text-right ${
                            ch.direction === "up"
                              ? "text-positive"
                              : ch.direction === "down"
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }`}
                        >
                          {v["comparable"] ? ch.label : "Not comparable"}
                        </td>
                        <td className="num py-2 pr-3 text-right">{count(Number(v["orders"]))}</td>
                        <td className="num py-2 pr-3 text-right">
                          {v["theoretical_cost_pct"] == null
                            ? NOT_AVAILABLE
                            : `${pct(Number(v["theoretical_cost_pct"]))} theoretical`}
                        </td>
                        <td className="num py-2 pr-3 text-right">{money(Number(v["waste_cost"] ?? 0))}</td>
                        <td className="py-2 text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link
                              to="/restaurants/$locationId"
                              params={{ locationId: String(v["location_id"]) }}
                              search={{ from: f.from, to: f.to, cmp: f.comparison }}
                            >
                              Open
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(venues.data ?? []).length === 0 ? (
                <EmptyState
                  title="No venues in your scope reported trade"
                  description="Either your grants cover no venue with recorded orders in this period, or the source has not synced."
                />
              ) : null}
            </div>
          )}
          <EvidenceFooter
            scope="All venues you are granted (venue filter does not apply to this comparison)"
            period={period}
            sources="Demo POS and delivery adapters; recipe versions effective on each business day; demo budgets"
            metric="Theoretical food cost only covers items with a recipe cost effective on the day; recipe coverage is shown on each venue page."
            limitations="Synthetic demo data. Waste is only as complete as the demo inventory adapter."
          />
        </Section>

        <div className="space-y-6">
          <Section title="Channel mix" description="Where the money actually came from.">
            {mix.isLoading ? (
              <LoadingRows rows={3} />
            ) : (
              <ul className="space-y-3">
                {(mix.data ?? []).map((r) => {
                  const share = mixTotal ? (Number(r["net_sales"]) / mixTotal) * 100 : 0;
                  return (
                    <li key={`${r["channel"]}-${r["fulfilment_type"]}`}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="capitalize">
                          {String(r["channel"]).replace(/_/g, " ")}
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            · {String(r["fulfilment_type"]).replace(/_/g, " ")}
                          </span>
                        </span>
                        <span className="num text-muted-foreground">
                          {money(Number(r["net_sales"]))} · {pct(share)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-primary"
                          style={{ width: `${Math.max(share, 1)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title="Needs attention" description="Only signals with a verified source behind them.">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start justify-between gap-3">
                <span>Ingredients at or below reorder level</span>
                {access?.permissions.includes("view_inventory") ? (
                  <StatusChip tone={lowStock ? "warning" : "positive"}>{count(lowStock)}</StatusChip>
                ) : (
                  <StatusChip tone="muted">No access</StatusChip>
                )}
              </li>
              <li className="flex items-start justify-between gap-3">
                <span>Verified documents expiring within 30 days</span>
                {access?.permissions.includes("view_people") ? (
                  <StatusChip tone={dueRenewals ? "warning" : "positive"}>{count(dueRenewals)}</StatusChip>
                ) : (
                  <StatusChip tone="muted">No access</StatusChip>
                )}
              </li>
              <li className="flex items-start justify-between gap-3">
                <span>Orders excluded as provider duplicates</span>
                <StatusChip tone="neutral">{count(Number(s?.["excluded_orders"] ?? 0))}</StatusChip>
              </li>
              <li className="flex items-start justify-between gap-3">
                <span>Refunds in period</span>
                <StatusChip tone="neutral">{money(Number(s?.["refunds"] ?? 0))}</StatusChip>
              </li>
            </ul>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/alerts" search={{ from: f.from, to: f.to, cmp: f.comparison }}>
                  Open alerts
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link
                  to="/integrations"
                  search={{ from: f.from, to: f.to, cmp: f.comparison }}
                >
                  Data quality
                </Link>
              </Button>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
