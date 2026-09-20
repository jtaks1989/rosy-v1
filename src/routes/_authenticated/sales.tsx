import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CartesianGrid,
  Line,
  LineChart,
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
  useChannelMixByLocation,
  useEodByLocation,
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
import { money, count, pct, change, NOT_AVAILABLE } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Sales & channels — Rosy AI" },
      {
        name: "description",
        content:
          "Net sales, discounts, taxes, refunds and channel mix for the selected venues and period, counted once per economic sale.",
      },
      { property: "og:title", content: "Sales & channels — Rosy AI" },
      { property: "og:description", content: "Net sales, discounts, refunds and channel mix." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Sales,
});

const EOD_SECTIONS: { key: string; label: string }[] = [
  { key: "general", label: "General" },
  { key: "charges", label: "# Order Charges" },
  { key: "order_types", label: "# Order Types" },
  { key: "payments", label: "# Payments" },
  { key: "net_payments_by_type", label: "# Net Payments by Type" },
];

function Sales() {
  const { data: access } = useAccess();
  const f = useFilters();
  const allowed = access?.permissions.includes("view_sales") ?? false;

  const summary = useSalesSummary(f, allowed);
  const prev = useComparisonSummary(f, allowed);
  const trend = useTrend(f, allowed);
  const mix = useChannelMix(f, allowed);
  const byOutlet = useChannelMixByLocation(f, allowed);
  const eod = useEodByLocation(f, allowed);

  if (access && !allowed) return <NoPermission what="sales data" />;

  const s = first(summary.data);
  const p = first(prev.data);
  const names = new Map((access?.locations ?? []).map((l) => [l.id, l.name]));
  const netChange = change(s ? Number(s["net_sales"]) : null, p ? Number(p["net_sales"]) : null);
  const mixTotal = (mix.data ?? []).reduce((a, r) => a + Number(r["net_sales"] ?? 0), 0);

  type OutletGroup = {
    id: string;
    name: string;
    brand: string;
    net: number;
    orders: number;
    rows: Record<string, any>[];
  };
  const outletMap = new Map<string, OutletGroup>();
  for (const r of byOutlet.data ?? []) {
    const id = String(r["location_id"]);
    const group =
      outletMap.get(id) ??
      ({ id, name: String(r["location_name"]), brand: String(r["brand_name"]), net: 0, orders: 0, rows: [] } as OutletGroup);
    group.net += Number(r["net_sales"] ?? 0);
    group.orders += Number(r["orders"] ?? 0);
    group.rows.push(r);
    outletMap.set(id, group);
  }
  const outletGroups = [...outletMap.values()].sort((a, b) => b.net - a.net);

  type EodOutlet = {
    id: string;
    name: string;
    brand: string;
    net: number;
    sections: Record<string, Record<string, any>[]>;
  };
  const eodMap = new Map<string, EodOutlet>();
  for (const r of eod.data ?? []) {
    const id = String(r["location_id"]);
    const o =
      eodMap.get(id) ??
      ({
        id,
        name: String(r["location_name"]),
        brand: String(r["brand_name"]),
        net: 0,
        sections: {},
      } as EodOutlet);
    const key = String(r["section"]);
    (o.sections[key] ??= []).push(r);
    if (key === "general" && r["name"] === "Net Sales") o.net = Number(r["amount"] ?? 0);
    eodMap.set(id, o);
  }
  const eodOutlets = [...eodMap.values()].sort((a, b) => b.net - a.net);

  return (
    <>
      <PageHeader
        title="Sales & channels"
        intro="The full revenue picture for the venues in scope: what guests paid, what was given away, what came back as refunds, and which channel it arrived through."
        actions={<StatusChip tone="muted">Demo dataset</StatusChip>}
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
            definition="Gross ex tax − discounts − refunds."
          />
          <KpiCard
            label="Customer total collected"
            value={money(Number(s?.["customer_total"] ?? 0))}
            definition="What guests actually paid, including tax and service charges."
          />
          <KpiCard
            label="Discounts"
            value={money(Number(s?.["discounts"] ?? 0))}
            note={
              Number(s?.["net_sales"] ?? 0) > 0
                ? `${pct((Number(s?.["discounts"] ?? 0) / Number(s?.["net_sales"])) * 100)} of net sales`
                : undefined
            }
          />
          <KpiCard label="Refunds" value={money(Number(s?.["refunds"] ?? 0))} />
          <KpiCard label="Tax collected" value={money(Number(s?.["tax"] ?? 0))} />
          <KpiCard label="Service charges" value={money(Number(s?.["charges"] ?? 0))} />
          <KpiCard
            label="Excluded duplicates"
            value={`${count(Number(s?.["excluded_orders"] ?? 0))} orders`}
            note={`${money(Number(s?.["excluded_amount"] ?? 0))} kept out of revenue`}
            definition="Provider records recognised as the same economic sale, or non-revenue events."
          />
          <KpiCard
            label="Average order value"
            value={s?.["aov"] == null ? NOT_AVAILABLE : money(Number(s["aov"]))}
          />
        </div>
      )}

      <Section
        title="Daily net sales"
        description="One point per Dubai business day, so trade after midnight belongs to the trading night that earned it."
      >
        {trend.isLoading ? (
          <LoadingRows rows={5} />
        ) : (trend.data ?? []).length === 0 ? (
          <EmptyState
            title="No trade recorded in this period"
            description="No canonical orders were found. Check the venue and date filters before reading anything into it."
          />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={(trend.data ?? []).map((r) => ({
                  date: String(r["business_date"]).slice(5),
                  net: Number(r["net_sales"]),
                  orders: Number(r["orders"]),
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
                  formatter={(v: any, n: any) => (n === "net" ? money(Number(v)) : count(Number(v)))}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <EvidenceFooter
          scope={scopeLabel(f, names)}
          period={`${f.from} → ${f.to} (${f.span} business days)`}
          sources="Demo POS adapter (authoritative) and demo delivery adapter (historical), deduplicated per economic sale"
          metric="Net sales = gross ex tax − discounts − refunds."
          limitations="Synthetic demo data. Delivery coverage is historical only, so very recent delivery trade may be missing."
        />
      </Section>

      <Section
        title="Sales & channels by outlet"
        description="Each outlet on its own terms — a delivery-only kitchen and a dine-in brasserie are never mixed into one line."
      >
        {byOutlet.isLoading ? (
          <LoadingRows rows={6} />
        ) : outletGroups.length === 0 ? (
          <EmptyState
            title="No outlet trade in this period"
            description="No canonical orders were recorded for the outlets in scope. Check the venue and date filters."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {outletGroups.map((g) => (
              <article key={g.id} className="rounded-xl border border-border bg-card p-4">
                <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link
                      to="/restaurants/$locationId"
                      params={{ locationId: g.id }}
                      className="font-semibold hover:underline"
                    >
                      {g.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{g.brand}</span>
                  </div>
                  <div className="text-right">
                    <span className="num block font-semibold">{money(g.net)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {count(g.orders)} orders ·{" "}
                      {mixTotal ? `${pct((g.net / mixTotal) * 100)} of group` : NOT_AVAILABLE}
                    </span>
                  </div>
                </header>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                      <th className="py-1.5 pr-3">Channel</th>
                      <th className="py-1.5 pr-3">Fulfilment</th>
                      <th className="py-1.5 pr-3 text-right">Net sales</th>
                      <th className="py-1.5 pr-3 text-right">Orders</th>
                      <th className="py-1.5 pr-3 text-right">Share of outlet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={`${r["channel"]}-${r["fulfilment_type"]}`} className="border-b border-border/60">
                        <td className="py-1.5 pr-3">{String(r["channel"]).replace(/_/g, " ")}</td>
                        <td className="py-1.5 pr-3 capitalize text-muted-foreground">
                          {String(r["fulfilment_type"]).replace(/_/g, " ")}
                        </td>
                        <td className="num py-1.5 pr-3 text-right">{money(Number(r["net_sales"]))}</td>
                        <td className="num py-1.5 pr-3 text-right">{count(Number(r["orders"]))}</td>
                        <td className="num py-1.5 pr-3 text-right">
                          {g.net ? pct((Number(r["net_sales"]) / g.net) * 100) : NOT_AVAILABLE}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            ))}
          </div>
        )}
        <EvidenceFooter
          scope={scopeLabel(f, names)}
          period={`${f.from} → ${f.to}`}
          sources="Demo POS adapter (authoritative) and demo delivery adapter, deduplicated per economic sale"
          metric="Outlet net sales = gross ex tax − discounts − refunds for orders counted in revenue."
          limitations="Synthetic demo data. Butter by the Dozen is delivery-only, so it shows no dine-in or covers. Outlets that opened mid-period are not like-for-like."
        />
      </Section>


      <Section
        title="End-of-day breakdown by outlet"
        description="The same lines the point-of-sale end-of-day report prints: general totals, order charges, order types, payments and net payments by type."
      >
        {eod.isLoading ? (
          <LoadingRows rows={8} />
        ) : eodOutlets.length === 0 ? (
          <EmptyState
            title="No end-of-day figures in this period"
            description="No orders were recorded for the outlets in scope. Check the venue and date filters."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {eodOutlets.map((o) => (
              <article key={o.id} className="rounded-xl border border-border bg-card p-4">
                <header className="mb-3">
                  <Link
                    to="/restaurants/$locationId"
                    params={{ locationId: o.id }}
                    className="font-semibold hover:underline"
                  >
                    {o.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {o.brand} · Business dates {f.from} → {f.to}
                  </span>
                </header>
                <div className="space-y-4">
                  {EOD_SECTIONS.filter((sec) => (o.sections[sec.key] ?? []).length > 0).map((sec) => (
                    <div key={sec.key}>
                      <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                        {sec.label}
                      </p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                            <th className="py-1 pr-3">Name</th>
                            <th className="py-1 pr-3 text-right">Quantity</th>
                            <th className="py-1 pr-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(o.sections[sec.key] ?? []).map((r) => (
                            <tr key={`${sec.key}-${r["name"]}`} className="border-b border-border/60">
                              <td className="py-1 pr-3">{String(r["name"])}</td>
                              <td className="num py-1 pr-3 text-right">
                                {r["quantity"] == null ? "–" : count(Number(r["quantity"]))}
                              </td>
                              <td className="num py-1 pr-3 text-right">
                                {r["amount"] == null ? "–" : money(Number(r["amount"]))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
        <EvidenceFooter
          scope={scopeLabel(f, names)}
          period={`${f.from} → ${f.to}`}
          sources="Demo POS adapter, laid out in the same end-of-day format the point-of-sale prints"
          metric="Gross sales = net sales + discounts + taxes. Average per order = net sales ÷ orders. Average per guest = net sales ÷ guests."
          limitations="Synthetic demo data. Named discount reasons and per-charge names are not carried by the demo adapter, so discounts and charges show as totals only. Aggregator payments appear as third party."
        />
      </Section>

      <Section title="Channel and fulfilment mix" description="Sorted by contribution to net sales.">

        {mix.isLoading ? (
          <LoadingRows />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="py-2 pr-3">Channel</th>
                  <th className="py-2 pr-3">Fulfilment</th>
                  <th className="py-2 pr-3 text-right">Net sales</th>
                  <th className="py-2 pr-3 text-right">Orders</th>
                  <th className="py-2 pr-3 text-right">Average order</th>
                  <th className="py-2 pr-3 text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {(mix.data ?? []).map((r) => (
                  <tr key={`${r["channel"]}-${r["fulfilment_type"]}`} className="border-b border-border/60">
                    <td className="py-2 pr-3 capitalize">{String(r["channel"]).replace(/_/g, " ")}</td>
                    <td className="py-2 pr-3 capitalize text-muted-foreground">
                      {String(r["fulfilment_type"]).replace(/_/g, " ")}
                    </td>
                    <td className="num py-2 pr-3 text-right">{money(Number(r["net_sales"]))}</td>
                    <td className="num py-2 pr-3 text-right">{count(Number(r["orders"]))}</td>
                    <td className="num py-2 pr-3 text-right">
                      {Number(r["orders"]) > 0
                        ? money(Number(r["net_sales"]) / Number(r["orders"]))
                        : NOT_AVAILABLE}
                    </td>
                    <td className="num py-2 pr-3 text-right">
                      {mixTotal ? pct((Number(r["net_sales"]) / mixTotal) * 100) : NOT_AVAILABLE}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
