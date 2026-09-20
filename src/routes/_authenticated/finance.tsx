import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-access";
import { useFilters, scopeLabel } from "@/lib/filters";
import { useSalesSummary, useVenueComparison, first } from "@/hooks/use-metrics";
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
import { money, count, pct, prettyDate, NOT_AVAILABLE } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { title: "Finance & reports — Rosy AI" },
      {
        name: "description",
        content:
          "Revenue against budget, payment mix and published reports, with period close status stated on every figure.",
      },
      { property: "og:title", content: "Finance & reports — Rosy AI" },
      { property: "og:description", content: "Revenue against budget, payment mix and published reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Finance,
});

function Finance() {
  const { data: access } = useAccess();
  const f = useFilters();
  const allowed = access?.permissions.includes("view_finance") ?? false;

  const summary = useSalesSummary(f, allowed);
  const venues = useVenueComparison(f, allowed);

  const payments = useQuery({
    queryKey: ["payments", f.from, f.to, f.locations.join(",")],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rosy_sales_summary" as any, {
        p_from: f.from,
        p_to: f.to,
      });
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const reports = useQuery({
    queryKey: ["published_reports"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("published_reports")
        .select("id, title, period_start, period_end, period_close_status, published_at, revision")
        .order("period_end", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  if (access && !allowed) return <NoPermission what="finance data" />;

  const s = first(summary.data);
  const names = new Map((access?.locations ?? []).map((l) => [l.id, l.name]));
  const budgetTotal = (venues.data ?? []).reduce(
    (a, v) => a + (v["target"] == null ? 0 : Number(v["target"])),
    0,
  );
  const netTotal = (venues.data ?? []).reduce((a, v) => a + Number(v["net_sales"] ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Finance & reports"
        intro="Revenue as this platform can evidence it. Nothing here is reconciled to an accounting ledger, so treat every period as preliminary until a finance system is connected."
        actions={<StatusChip tone="warning">Accounting system not connected</StatusChip>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Net sales" value={money(Number(s?.["net_sales"] ?? 0))} />
        <KpiCard
          label="Customer total collected"
          value={money(Number(s?.["customer_total"] ?? 0))}
          definition="Includes tax and service charges — not revenue."
        />
        <KpiCard label="Tax collected" value={money(Number(s?.["tax"] ?? 0))} />
        <KpiCard
          label="Refunds"
          value={money(Number(s?.["refunds"] ?? 0))}
          note={`${count(Number(s?.["cancelled_orders"] ?? 0))} cancelled orders`}
        />
      </div>

      <Section
        title="Against budget"
        description="Budgets are monthly targets; a partial period is compared against the whole months it touches."
      >
        {venues.isLoading ? (
          <LoadingRows />
        ) : (
          <>
            <p className="mb-3 text-sm">
              {budgetTotal ? (
                <>
                  <span className="num font-semibold">{money(netTotal)}</span> against a recorded target of{" "}
                  <span className="num font-semibold">{money(budgetTotal)}</span> (
                  {pct((netTotal / budgetTotal) * 100)}).
                </>
              ) : (
                <span className="text-muted-foreground">
                  No budget is recorded for the months this period touches, so no target comparison is shown.
                </span>
              )}
            </p>
            <ul className="divide-y divide-border text-sm">
              {(venues.data ?? []).map((v) => (
                <li key={String(v["location_id"])} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    {String(v["location_name"])}
                    <span className="block text-xs text-muted-foreground">{String(v["brand_name"])}</span>
                  </span>
                  <span className="num text-muted-foreground">
                    {money(Number(v["net_sales"]))} ·{" "}
                    {v["target"] == null
                      ? "no budget recorded"
                      : `${pct((Number(v["net_sales"]) / Number(v["target"])) * 100)} of ${money(
                          Number(v["target"]),
                        )}`}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <EvidenceFooter
          scope={scopeLabel(f, names)}
          period={`${f.from} → ${f.to} · period close status: preliminary`}
          sources="Demo POS and delivery adapters, demo budgets"
          metric="Net sales = gross ex tax − discounts − refunds, deduplicated per economic sale."
          limitations="Synthetic demo data, not reconciled to any accounting ledger. Monthly budgets are not pro-rated for partial periods."
        />
      </Section>

      <Section title="Published reports" description="Only reports someone has published appear here.">
        {reports.isLoading ? (
          <LoadingRows />
        ) : (reports.data ?? []).length === 0 ? (
          <EmptyState
            title="No published reports"
            description="Nothing has been published for the entities you can see. Draft numbers are deliberately not shown here."
          />
        ) : (
          <ul className="divide-y divide-border text-sm">
            {(reports.data ?? []).map((r: any) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {r.title}
                  <span className="block text-xs text-muted-foreground">
                    {prettyDate(r.period_start)} → {prettyDate(r.period_end)} · revision {r.revision}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusChip tone={r.period_close_status === "final" ? "positive" : "warning"}>
                    {r.period_close_status === "final" ? "Final" : "Preliminary"}
                  </StatusChip>
                  <span className="num text-xs text-muted-foreground">
                    {r.published_at ? prettyDate(r.published_at.slice(0, 10)) : "Not published"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Payment mix" description="Payment breakdown requires payment-level source data.">
        {payments.isLoading ? (
          <LoadingRows rows={2} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {NOT_AVAILABLE} — payment entries exist in the demo adapter but are not reconciled to a payment
            provider, so a payment-method split would be misleading. This becomes available when a payments or
            accounting source is connected.
          </p>
        )}
      </Section>
    </>
  );
}
