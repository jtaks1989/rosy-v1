import { useState } from "react";
import { useAccess } from "@/hooks/use-access";
import { useFilters, scopeLabel } from "@/lib/filters";
import { useMenuPerformance } from "@/hooks/use-metrics";
import {
  EmptyState,
  EvidenceFooter,
  KpiCard,
  LoadingRows,
  Section,
  StatusChip,
} from "@/components/rosy/primitives";
import { money, count, pct, NOT_AVAILABLE } from "@/lib/format";
import { Input } from "@/components/ui/input";

type Quadrant = "star" | "workhorse" | "puzzle" | "drop";

function quadrant(mix: number, contribution: number | null, medMix: number, medContribution: number) {
  if (contribution == null) return null;
  const highMix = mix >= medMix;
  const highMargin = contribution >= medContribution;
  return (highMix && highMargin
    ? "star"
    : highMix
      ? "workhorse"
      : highMargin
        ? "puzzle"
        : "drop") as Quadrant;
}

const QUAD_LABEL: Record<Quadrant, { label: string; tone: "positive" | "neutral" | "warning" | "critical" }> =
  {
    star: { label: "Star — popular and profitable", tone: "positive" },
    workhorse: { label: "Workhorse — popular, thin margin", tone: "neutral" },
    puzzle: { label: "Puzzle — profitable, under-sold", tone: "warning" },
    drop: { label: "Review — low sales, low margin", tone: "critical" },
  };

function median(values: number[]) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

export function MenuPerformanceTab() {
  const { data: access } = useAccess();
  const f = useFilters();
  const allowed = access?.permissions.includes("view_menu") ?? false;
  const menu = useMenuPerformance(f, allowed);
  const [q, setQ] = useState("");

  const rows = menu.data ?? [];
  const withCost = rows.filter((r) => r["margin_available"]);
  const medMix = median(rows.map((r) => Number(r["sales_mix_pct"] ?? 0)));
  const medContribution = median(withCost.map((r) => Number(r["contribution_pct"] ?? 0)));
  const totalNet = rows.reduce((a, r) => a + Number(r["net_revenue"] ?? 0), 0);
  const coveredNet = withCost.reduce((a, r) => a + Number(r["net_revenue"] ?? 0), 0);
  const names = new Map((access?.locations ?? []).map((l) => [l.id, l.name]));

  const filtered = rows.filter((r) =>
    q ? String(r["item_name"]).toLowerCase().includes(q.toLowerCase()) : true,
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Items sold" value={count(rows.length)} />
        <KpiCard
          label="Recipe cost coverage"
          value={totalNet ? pct((coveredNet / totalNet) * 100) : NOT_AVAILABLE}
          note={`${count(withCost.length)} of ${count(rows.length)} items costed`}
          definition="Share of net revenue from items that have a recipe cost effective on the day."
        />
        <KpiCard label="Net revenue" value={money(totalNet)} />
        <KpiCard
          label="Median contribution"
          value={withCost.length ? pct(medContribution) : NOT_AVAILABLE}
          unavailableReason={withCost.length ? undefined : "No item in scope has a recipe cost"}
        />
      </div>

      <Section
        title="Items"
        description="Quadrants use the median sales mix and median contribution of costed items in this scope."
        aside={
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search items"
            className="w-48"
            aria-label="Search menu items"
          />
        }
      >
        {menu.isLoading ? (
          <LoadingRows rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No items matched"
            description="No item sold in this period and scope matches your search."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3">Venue</th>
                  <th className="py-2 pr-3 text-right">Units</th>
                  <th className="py-2 pr-3 text-right">Net revenue</th>
                  <th className="py-2 pr-3 text-right">Avg price</th>
                  <th className="py-2 pr-3 text-right">Recipe cost</th>
                  <th className="py-2 pr-3 text-right">Contribution</th>
                  <th className="py-2 pr-3 text-right">Mix</th>
                  <th className="py-2">Read</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 80).map((r) => {
                  const qd = quadrant(
                    Number(r["sales_mix_pct"] ?? 0),
                    r["margin_available"] ? Number(r["contribution_pct"]) : null,
                    medMix,
                    medContribution,
                  );
                  return (
                    <tr key={String(r["product_id"])} className="border-b border-border/60">
                      <td className="py-2 pr-3">
                        {String(r["item_name"])}
                        <span className="block text-xs text-muted-foreground">
                          {String(r["category"] ?? "Uncategorised")} · POS {String(r["pos_item_id"])}
                          {r["available"] ? "" : " · unavailable"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{String(r["location_name"])}</td>
                      <td className="num py-2 pr-3 text-right">{count(Number(r["units"]))}</td>
                      <td className="num py-2 pr-3 text-right">{money(Number(r["net_revenue"]))}</td>
                      <td className="num py-2 pr-3 text-right">{money(Number(r["avg_price"] ?? 0))}</td>
                      <td className="num py-2 pr-3 text-right">
                        {r["margin_available"] ? money(Number(r["recipe_cost"])) : NOT_AVAILABLE}
                      </td>
                      <td className="num py-2 pr-3 text-right">
                        {r["margin_available"]
                          ? `${money(Number(r["contribution_per_unit"]))} · ${pct(
                              Number(r["contribution_pct"]),
                            )}`
                          : "No recipe cost"}
                      </td>
                      <td className="num py-2 pr-3 text-right">{pct(Number(r["sales_mix_pct"] ?? 0))}</td>
                      <td className="py-2">
                        {qd ? (
                          <StatusChip tone={QUAD_LABEL[qd].tone}>{QUAD_LABEL[qd].label}</StatusChip>
                        ) : (
                          <StatusChip tone="muted">Margin unknown</StatusChip>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <EvidenceFooter
          scope={scopeLabel(f, names)}
          period={`${f.from} → ${f.to}`}
          sources="Demo POS order lines joined to the recipe version effective on each business day"
          metric="Contribution per unit = net revenue per unit − recipe ingredient cost effective that day. Sales mix = item net revenue ÷ total net revenue in scope."
          limitations="Synthetic demo data. Items without a costed recipe are excluded from margin views rather than assumed. Table capped at 80 rows."
        />
      </Section>
    </>
  );
}
