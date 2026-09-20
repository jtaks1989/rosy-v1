import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-access";
import { useFilters } from "@/lib/filters";
import {
  useSalesSummary,
  useComparisonSummary,
  useTrend,
  useChannelMix,
  useMenuPerformance,
  useInventoryRisk,
  useGuestCohorts,
  first,
} from "@/hooks/use-metrics";
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
import { money, count, pct, change, NOT_AVAILABLE, prettyDate, freshness } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/restaurants/$locationId")({
  head: () => ({
    meta: [
      { title: "Venue detail — Rosy AI" },
      {
        name: "description",
        content:
          "One venue in full: trade by day, channel mix, menu contribution, stock risk, guests and the orders behind every figure.",
      },
      { property: "og:title", content: "Venue detail — Rosy AI" },
      { property: "og:description", content: "One venue in full, down to the orders behind each figure." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VenueDetail,
});

function VenueDetail() {
  const { locationId } = Route.useParams();
  const { data: access } = useAccess();
  const base = useFilters();
  const f = { ...base, locations: [locationId], locationsParam: [locationId] } as typeof base;

  const allowed = access?.permissions.includes("view_sales") ?? false;
  const granted = (access?.locations ?? []).some((l) => l.id === locationId);
  const venue = (access?.locations ?? []).find((l) => l.id === locationId);

  const summary = useSalesSummary(f, allowed && granted);
  const prev = useComparisonSummary(f, allowed && granted);
  const trend = useTrend(f, allowed && granted);
  const mix = useChannelMix(f, allowed && granted);
  const menu = useMenuPerformance(f, allowed && granted && (access?.permissions.includes("view_menu") ?? false));
  const stock = useInventoryRisk(f, granted && (access?.permissions.includes("view_inventory") ?? false));
  const guests = useGuestCohorts(f, granted && (access?.permissions.includes("view_guests") ?? false));

  const orders = useQuery({
    queryKey: ["orders", locationId, f.from, f.to],
    enabled: allowed && granted,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("canonical_orders")
        .select(
          "id, business_date, occurred_at, channel, fulfilment_type, status, net_sales_ex_tax, refund_total, discount_total, covers, counts_in_revenue, reconciliation_status, authoritative_source",
        )
        .eq("location_id", locationId)
        .gte("business_date", f.from)
        .lte("business_date", f.to)
        .order("occurred_at", { ascending: false })
        .limit(60);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  if (access && !allowed) return <NoPermission what="venue performance" />;
  if (access && !granted) return <NoPermission what="this venue" />;

  const s = first(summary.data);
  const p = first(prev.data);
  const g = first(guests.data);
  const netChange = change(s ? Number(s["net_sales"]) : null, p ? Number(p["net_sales"]) : null);
  const lowStock = (stock.data ?? []).filter((r) => r["low_stock"]);
  const period = `${f.from} → ${f.to} (${f.span} business days)`;

  return (
    <>
      <PageHeader
        title={venue?.name ?? "Venue"}
        intro={`${venue?.brand ?? "Brand not recorded"} · business day cutoff ${
          venue?.cutoff?.slice(0, 5) ?? "not recorded"
        } Asia/Dubai · opened ${prettyDate(venue?.openedOn)}${
          venue?.manager ? ` · manager ${venue.manager}` : ""
        }`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/restaurants" search={{ from: f.from, to: f.to, cmp: f.comparison }}>
              All venues
            </Link>
          </Button>
        }
      />

      {summary.isLoading ? (
        <LoadingRows rows={2} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Net sales"
            value={money(Number(s?.["net_sales"] ?? 0))}
            changeLabel={netChange.label}
            direction={netChange.direction}
            note={`vs ${f.prevFrom} → ${f.prevTo}`}
            definition="Gross ex tax − discounts − refunds, one canonical order per economic sale."
          />
          <KpiCard
            label="Orders"
            value={count(Number(s?.["orders"] ?? 0))}
            note={`${count(Number(s?.["cancelled_orders"] ?? 0))} cancelled · ${count(
              Number(s?.["excluded_orders"] ?? 0),
            )} excluded`}
          />
          <KpiCard
            label="Average order value"
            value={s?.["aov"] == null ? NOT_AVAILABLE : money(Number(s["aov"]))}
          />
          <KpiCard
            label="Discounts &amp; refunds"
            value={`${money(Number(s?.["discounts"] ?? 0))} / ${money(Number(s?.["refunds"] ?? 0))}`}
            definition="Discounts and refunds already deducted from net sales."
          />
        </div>
      )}

      <Section title="Trade by business day" description="Bars show net sales per Dubai business day.">
        {trend.isLoading ? (
          <LoadingRows rows={5} />
        ) : (trend.data ?? []).length === 0 ? (
          <EmptyState
            title="No trade recorded"
            description="No canonical orders fall in this period for this venue. That is an empty result, not a zero-sales day."
          />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(trend.data ?? []).map((r) => ({
                  date: String(r["business_date"]).slice(5),
                  net: Number(r["net_sales"]),
                }))}
              >
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
                  formatter={(v: any) => money(Number(v))}
                />
                <Bar dataKey="net" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="guests">Guests</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-4">
          <Section
            title="Orders behind the numbers"
            description="The most recent 60 canonical orders, including the ones deliberately excluded from revenue."
          >
            {orders.isLoading ? (
              <LoadingRows />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                      <th className="py-2 pr-3">Business day</th>
                      <th className="py-2 pr-3">Opened</th>
                      <th className="py-2 pr-3">Channel</th>
                      <th className="py-2 pr-3">Source</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3 text-right">Net</th>
                      <th className="py-2 pr-3 text-right">Covers</th>
                      <th className="py-2">Counted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(orders.data ?? []).map((o: any) => (
                      <tr key={o.id} className="border-b border-border/60">
                        <td className="num py-2 pr-3">{o.business_date}</td>
                        <td className="num py-2 pr-3 text-muted-foreground">
                          {new Date(o.occurred_at).toLocaleString("en-GB", {
                            timeZone: "Asia/Dubai",
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "short",
                          })}
                        </td>
                        <td className="py-2 pr-3 capitalize">
                          {String(o.channel).replace(/_/g, " ")}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{o.authoritative_source ?? "—"}</td>
                        <td className="py-2 pr-3 capitalize">{String(o.status).replace(/_/g, " ")}</td>
                        <td className="num py-2 pr-3 text-right">
                          {money(Number(o.net_sales_ex_tax) - Number(o.refund_total ?? 0))}
                        </td>
                        <td className="num py-2 pr-3 text-right">{o.covers ?? "—"}</td>
                        <td className="py-2">
                          {o.counts_in_revenue ? (
                            <StatusChip tone="positive">Counted</StatusChip>
                          ) : (
                            <StatusChip tone="warning" title={o.reconciliation_status ?? undefined}>
                              Excluded
                            </StatusChip>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(orders.data ?? []).length === 0 ? (
                  <EmptyState
                    title="No orders in this period"
                    description="Nothing has been synthesised to fill the gap."
                  />
                ) : null}
              </div>
            )}
            <EvidenceFooter
              scope={venue?.name ?? "This venue"}
              period={period}
              sources="Demo POS adapter (authoritative) and demo delivery adapter (historical), linked to one canonical order"
              metric="Excluded orders are duplicate provider records or non-revenue events, kept visible rather than deleted."
              limitations="Synthetic demo data, capped at 60 rows for readability."
            />
          </Section>
        </TabsContent>

        <TabsContent value="menu" className="mt-4">
          <Section
            title="Menu contribution"
            description="Contribution needs a recipe cost effective on the day. Items without one are marked, not estimated."
          >
            {!access?.permissions.includes("view_menu") ? (
              <NoPermission what="menu profitability" />
            ) : menu.isLoading ? (
              <LoadingRows />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                      <th className="py-2 pr-3">Item</th>
                      <th className="py-2 pr-3 text-right">Units</th>
                      <th className="py-2 pr-3 text-right">Net revenue</th>
                      <th className="py-2 pr-3 text-right">Contribution / unit</th>
                      <th className="py-2 pr-3 text-right">Contribution %</th>
                      <th className="py-2 pr-3 text-right">Mix %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(menu.data ?? []).slice(0, 25).map((r) => (
                      <tr key={String(r["product_id"])} className="border-b border-border/60">
                        <td className="py-2 pr-3">
                          {String(r["item_name"])}
                          <span className="block text-xs text-muted-foreground">
                            {String(r["category"] ?? "Uncategorised")}
                            {r["available"] ? "" : " · currently unavailable"}
                          </span>
                        </td>
                        <td className="num py-2 pr-3 text-right">{count(Number(r["units"]))}</td>
                        <td className="num py-2 pr-3 text-right">{money(Number(r["net_revenue"]))}</td>
                        <td className="num py-2 pr-3 text-right">
                          {r["margin_available"] ? money(Number(r["contribution_per_unit"])) : NOT_AVAILABLE}
                        </td>
                        <td className="num py-2 pr-3 text-right">
                          {r["margin_available"] ? pct(Number(r["contribution_pct"])) : "No recipe cost"}
                        </td>
                        <td className="num py-2 pr-3 text-right">{pct(Number(r["sales_mix_pct"] ?? 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="stock" className="mt-4">
          <Section
            title="Stock risk"
            description="Latest counted snapshot for this venue. Inventory is read-only until an inventory system is connected."
          >
            {!access?.permissions.includes("view_inventory") ? (
              <NoPermission what="inventory" />
            ) : stock.isLoading ? (
              <LoadingRows />
            ) : (stock.data ?? []).length === 0 ? (
              <EmptyState
                title="No stock snapshot for this venue"
                description="No counted snapshot exists, so stock levels are unavailable rather than shown as zero."
              />
            ) : (
              <>
                <p className="mb-3 text-xs text-muted-foreground">
                  {count(lowStock.length)} of {count((stock.data ?? []).length)} tracked ingredients are at
                  or below reorder level.
                </p>
                <ul className="divide-y divide-border text-sm">
                  {(stock.data ?? []).slice(0, 20).map((r) => (
                    <li key={String(r["ingredient_id"])} className="flex items-center justify-between py-2">
                      <span>
                        {String(r["ingredient_name"])}
                        <span className="block text-xs text-muted-foreground">
                          counted {prettyDate(r["as_of_date"] as string)} · source {String(r["source"])}
                          {r["expiry_date"] ? ` · expires ${prettyDate(r["expiry_date"] as string)}` : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="num text-muted-foreground">
                          {Number(r["quantity"])} {String(r["unit"])}
                        </span>
                        {r["low_stock"] ? (
                          <StatusChip tone="warning">At reorder level</StatusChip>
                        ) : (
                          <StatusChip tone="positive">Above level</StatusChip>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="guests" className="mt-4">
          <Section
            title="Guests and reservations"
            description="Reservations, covers and orders are separate counts and are never mixed."
          >
            {!access?.permissions.includes("view_guests") ? (
              <NoPermission what="guest and reservation data" />
            ) : guests.isLoading ? (
              <LoadingRows rows={2} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Reservations" value={count(Number(g?.["reservations"] ?? 0))} />
                <KpiCard label="Seated covers" value={count(Number(g?.["seated_covers"] ?? 0))} />
                <KpiCard
                  label="No-show rate"
                  value={g?.["no_show_rate"] == null ? NOT_AVAILABLE : pct(Number(g["no_show_rate"]))}
                  unavailableReason={
                    g?.["no_show_rate"] == null ? "No seated or no-show reservations to measure" : undefined
                  }
                  definition="No-shows divided by seated plus no-show reservations."
                />
                <KpiCard
                  label="Repeat guest rate"
                  value={g?.["repeat_rate"] == null ? NOT_AVAILABLE : pct(Number(g["repeat_rate"]))}
                  note={
                    g?.["identification_coverage_pct"] == null
                      ? undefined
                      : `${pct(Number(g["identification_coverage_pct"]))} of reservations identifiable`
                  }
                  definition="Guests with more than one reservation, among identifiable guests only."
                />
              </div>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="channels" className="mt-4">
          <Section title="Channel mix" description="Dine-in, delivery and pickup for this venue.">
            {mix.isLoading ? (
              <LoadingRows rows={3} />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {(mix.data ?? []).map((r) => (
                  <li
                    key={`${r["channel"]}-${r["fulfilment_type"]}`}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="capitalize">
                      {String(r["channel"]).replace(/_/g, " ")} ·{" "}
                      <span className="text-muted-foreground">
                        {String(r["fulfilment_type"]).replace(/_/g, " ")}
                      </span>
                    </span>
                    <span className="num">
                      {money(Number(r["net_sales"]))} · {count(Number(r["orders"]))} orders
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <EvidenceFooter
              scope={venue?.name ?? "This venue"}
              period={period}
              sources="Demo POS and delivery adapters"
              freshness={freshness(null).label}
              limitations="Delivery figures come from a historical demo adapter, so the most recent days may be incomplete."
            />
          </Section>
        </TabsContent>
      </Tabs>
    </>
  );
}
