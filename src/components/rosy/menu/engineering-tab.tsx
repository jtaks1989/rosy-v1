import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAccess } from "@/hooks/use-access";
import { useFilters, scopeLabel } from "@/lib/filters";
import {
  EMPTY_ME_FILTERS,
  useMenuEngineering,
  useMenuFilterOptions,
  type MenuEngFilters,
} from "@/hooks/use-menu-engineering";
import {
  DEFAULT_CONFIG,
  DAYPARTS,
  FULFILMENTS,
  PROFIT_METHODS,
  QUADRANT_META,
  SOURCE_NOTE,
  UNCLASSIFIED_COLOUR,
  downloadCsv,
  exclusionLabel,
  movementDriver,
  movementOf,
  quadrantLabel,
  toCsv,
  type MenuEngConfig,
  type MenuEngRow,
  type Quadrant,
} from "@/lib/menu-engineering";
import { QuadrantChart } from "./quadrant-chart";
import { MenuItemDrawer } from "./item-drawer";
import {
  EmptyState,
  EvidenceFooter,
  KpiCard,
  LoadingRows,
  Section,
  StatusChip,
} from "@/components/rosy/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { money, count, pct, NOT_AVAILABLE } from "@/lib/format";

const field =
  "mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

const QUADRANT_ORDER: Quadrant[] = ["star", "plowhorse", "puzzle", "dog"];

type SortKey =
  | "item_name"
  | "units"
  | "mix_pct"
  | "net_revenue"
  | "avg_price"
  | "recipe_cost"
  | "contribution_per_unit"
  | "contribution_pct"
  | "total_contribution";

function multi(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Chips({
  options,
  selected,
  onToggle,
  label,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  label: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              aria-pressed={on}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MenuEngineeringTab() {
  const { data: access } = useAccess();
  const f = useFilters();
  const isAdmin = (access?.permissions ?? []).includes("manage_workspace");
  const [cfg, setCfg] = useState<MenuEngConfig>(DEFAULT_CONFIG);
  const [mf, setMf] = useState<MenuEngFilters>(EMPTY_ME_FILTERS);
  const [itemQuery, setItemQuery] = useState("");
  const [quadrantFilter, setQuadrantFilter] = useState<"" | Quadrant | "unclassified">("");
  const [coverage, setCoverage] = useState<"" | "costed" | "missing">("");
  const [confidence, setConfidence] = useState<"" | "high" | "medium" | "low">("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "total_contribution",
    dir: "desc",
  });
  const [selected, setSelected] = useState<MenuEngRow | null>(null);
  const [showMethod, setShowMethod] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showMovement, setShowMovement] = useState(false);

  const allowed = (access?.permissions ?? []).includes("view_menu");
  const query = useMenuEngineering(f, cfg, mf, allowed);
  const options = useMenuFilterOptions(allowed);
  const names = new Map((access?.locations ?? []).map((l) => [l.id, l.name]));

  const rows = query.data ?? [];

  const visible = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (itemQuery && !r.item_name.toLowerCase().includes(itemQuery.toLowerCase())) return false;
      if (quadrantFilter === "unclassified" && r.quadrant) return false;
      if (quadrantFilter && quadrantFilter !== "unclassified" && r.quadrant !== quadrantFilter) return false;
      if (coverage === "costed" && r.recipe_cost === null) return false;
      if (coverage === "missing" && r.recipe_cost !== null) return false;
      if (confidence && r.confidence !== confidence) return false;
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "string" || typeof bv === "string")
        return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
      return ((Number(av ?? 0) - Number(bv ?? 0)) as number) * dir;
    });
  }, [rows, itemQuery, quadrantFilter, coverage, confidence, sort]);

  const classified = rows.filter((r) => r.quadrant);
  const unclassified = rows.filter((r) => !r.quadrant);
  const totalNet = rows.reduce((a, r) => a + Number(r.net_revenue ?? 0), 0);
  const analysedNet = classified.reduce((a, r) => a + Number(r.net_revenue ?? 0), 0);
  const costedNet = rows
    .filter((r) => r.recipe_cost !== null)
    .reduce((a, r) => a + Number(r.net_revenue ?? 0), 0);
  const totalContribution = classified.reduce((a, r) => a + Number(r.total_contribution ?? 0), 0);
  const medianCpu = (() => {
    const list = classified
      .map((r) => Number(r.contribution_per_unit ?? 0))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    return list.length ? list[Math.floor(list.length / 2)]! : null;
  })();
  const byQuadrant = (q: Quadrant) => classified.filter((r) => r.quadrant === q);

  /**
   * Opportunity = contribution each below-benchmark item would have added in this
   * period if its contribution per unit had merely reached its own category
   * benchmark. It is a size-of-the-gap figure, not a forecast.
   */
  const opportunity = classified
    .filter((r) => r.profit_threshold !== null && (r.contribution_per_unit ?? 0) < (r.profit_threshold ?? 0))
    .reduce((a, r) => a + ((r.profit_threshold ?? 0) - (r.contribution_per_unit ?? 0)) * r.units, 0);

  const thresholds = classified[0];
  const popThreshold = thresholds?.popularity_threshold_pct ?? null;
  const profitThreshold = thresholds?.profit_threshold ?? null;
  const mixedThresholds =
    new Set(classified.map((r) => `${r.popularity_threshold_pct}|${r.profit_threshold}`)).size > 1;

  const movement = useMemo(
    () =>
      rows
        .map((r) => ({ row: r, move: movementOf(r), driver: movementDriver(r) }))
        .filter((m) => m.move.kind !== "unchanged" || m.row.quadrant !== m.row.prev_quadrant),
    [rows],
  );

  const exportCsv = () => {
    const header = {
      Report: "Rosy AI — Menu Engineering",
      "Date range": `${f.from} → ${f.to} (Asia/Dubai)`,
      "Comparison period": f.comparison === "none" ? "none" : `${f.prevFrom} → ${f.prevTo}`,
      Scope: scopeLabel(f, names),
      Currency: "AED",
      "Menu categories": mf.categories.join("; ") || "all granted",
      "Order channels": mf.channels.join("; ") || "all",
      Fulfilment: mf.fulfilment.join("; ") || "all",
      Dayparts: mf.dayparts.join("; ") || "all",
      "Day type": mf.dayType || "all",
      "Popularity threshold": `expected share x ${cfg.popularityFactor} (category-relative)`,
      "Profitability threshold": cfg.profitMethod,
      "Minimum data rule": `${cfg.minUnits} eligible units and ${cfg.minDays} selling days`,
      "Peer group": cfg.peerScope === "venue" ? "category within venue" : "category within selected scope",
      "Data freshness": "Demo dataset — no live source connected",
      Sources: SOURCE_NOTE,
    };
    downloadCsv(`rosy-menu-engineering-${f.from}-to-${f.to}.csv`, toCsv(visible, header));
  };

  if (!allowed) return null;

  const sortBtn = (key: SortKey, label: string, align = "text-right") => (
    <th className={`py-2 pr-3 ${align}`}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() =>
          setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }))
        }
      >
        {label}
        {sort.key === key ? <ChevronDown className={`size-3 ${sort.dir === "asc" ? "rotate-180" : ""}`} /> : null}
      </button>
    </th>
  );

  return (
    <div className="space-y-6">
      <Section
        title="Menu Engineering filters"
        description="These sit on top of the global date, brand and venue filters. Every option respects your existing access."
        aside={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowMethod((v) => !v)}>
              {showMethod ? "Hide methodology" : "Methodology"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowConfig((v) => !v)}>
              {showConfig ? "Hide thresholds" : "Threshold settings"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMf(EMPTY_ME_FILTERS)}>
              Reset
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Chips
            label="Menu category"
            options={(options.data?.categories ?? []).map((c) => ({ value: c, label: c }))}
            selected={mf.categories}
            onToggle={(v) => setMf((p) => ({ ...p, categories: multi(p.categories, v) }))}
          />
          <Chips
            label="Order channel"
            options={(options.data?.channels ?? []).map((c) => ({ value: c, label: c }))}
            selected={mf.channels}
            onToggle={(v) => setMf((p) => ({ ...p, channels: multi(p.channels, v) }))}
          />
          <Chips
            label="Dine-in, takeaway or delivery"
            options={FULFILMENTS.map((x) => ({ value: x.value, label: x.label }))}
            selected={mf.fulfilment}
            onToggle={(v) => setMf((p) => ({ ...p, fulfilment: multi(p.fulfilment, v) }))}
          />
          <Chips
            label="Daypart"
            options={DAYPARTS.map((x) => ({ value: x.value, label: x.label }))}
            selected={mf.dayparts}
            onToggle={(v) => setMf((p) => ({ ...p, dayparts: multi(p.dayparts, v) }))}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Weekday / weekend
            <select
              className={field}
              value={mf.dayType}
              onChange={(e) => setMf((p) => ({ ...p, dayType: e.target.value as MenuEngFilters["dayType"] }))}
            >
              <option value="">Both</option>
              <option value="weekday">Weekday only</option>
              <option value="weekend">Weekend only</option>
            </select>
          </label>
          <label className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Menu item
            <Input
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              placeholder="Search item"
              className="mt-1 h-[34px] text-xs"
            />
          </label>
          <label className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Cost-coverage status
            <select className={field} value={coverage} onChange={(e) => setCoverage(e.target.value as typeof coverage)}>
              <option value="">All items</option>
              <option value="costed">Costed recipe only</option>
              <option value="missing">Missing recipe cost</option>
            </select>
          </label>
          <label className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Quadrant
            <select
              className={field}
              value={quadrantFilter}
              onChange={(e) => setQuadrantFilter(e.target.value as typeof quadrantFilter)}
            >
              <option value="">All</option>
              {QUADRANT_ORDER.map((q) => (
                <option key={q} value={q}>
                  {QUADRANT_META[q].label}
                </option>
              ))}
              <option value="unclassified">Unclassified / needs data</option>
            </select>
          </label>
          <label className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Data confidence
            <select
              className={field}
              value={confidence}
              onChange={(e) => setConfidence(e.target.value as typeof confidence)}
            >
              <option value="">Any</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>

        {showConfig ? (
          <div className="mt-4 rounded-lg border border-border bg-surface p-3">
            {!isAdmin ? (
              <p className="mb-2 text-[11px] text-muted-foreground">
                Threshold methodology is administrator-configurable. You can see the values in use but not change them.
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Popularity factor
                <Input
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="1.5"
                  disabled={!isAdmin}
                  value={cfg.popularityFactor}
                  onChange={(e) => setCfg((c) => ({ ...c, popularityFactor: Number(e.target.value || 0.7) }))}
                  className="mt-1 h-[34px] text-xs"
                />
              </label>
              <label className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Profitability threshold method
                <select
                  className={field}
                  disabled={!isAdmin}
                  value={cfg.profitMethod}
                  onChange={(e) => setCfg((c) => ({ ...c, profitMethod: e.target.value as MenuEngConfig["profitMethod"] }))}
                >
                  {PROFIT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Fixed threshold (AED per unit)
                <Input
                  type="number"
                  step="1"
                  disabled={!isAdmin || cfg.profitMethod !== "fixed"}
                  value={cfg.fixedThreshold ?? ""}
                  onChange={(e) =>
                    setCfg((c) => ({ ...c, fixedThreshold: e.target.value === "" ? null : Number(e.target.value) }))
                  }
                  className="mt-1 h-[34px] text-xs"
                />
              </label>
              <label className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Minimum eligible units
                <Input
                  type="number"
                  step="1"
                  disabled={!isAdmin}
                  value={cfg.minUnits}
                  onChange={(e) => setCfg((c) => ({ ...c, minUnits: Number(e.target.value || 0) }))}
                  className="mt-1 h-[34px] text-xs"
                />
              </label>
              <label className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Minimum selling days
                <Input
                  type="number"
                  step="1"
                  disabled={!isAdmin}
                  value={cfg.minDays}
                  onChange={(e) => setCfg((c) => ({ ...c, minDays: Number(e.target.value || 0) }))}
                  className="mt-1 h-[34px] text-xs"
                />
              </label>
              <label className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Peer group for popularity
                <select
                  className={field}
                  disabled={!isAdmin}
                  value={cfg.peerScope}
                  onChange={(e) => setCfg((c) => ({ ...c, peerScope: e.target.value as MenuEngConfig["peerScope"] }))}
                >
                  <option value="venue">Category within each venue</option>
                  <option value="scope">Category across the selected scope</option>
                </select>
              </label>
              <label className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Multi-venue view
                <select
                  className={field}
                  value={cfg.consolidated ? "consolidated" : "venue"}
                  onChange={(e) => setCfg((c) => ({ ...c, consolidated: e.target.value === "consolidated" }))}
                >
                  <option value="venue">One row per item per venue</option>
                  <option value="consolidated">Consolidated across selected venues</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}

        {showMethod ? (
          <div className="mt-4 space-y-2 rounded-lg border border-border bg-surface p-4 text-xs text-muted-foreground">
            <p className="text-sm font-semibold text-foreground">How every figure here is calculated</p>
            <p>
              <strong className="text-foreground">Eligible units sold</strong> — fulfilled or closed item quantities on
              orders that count in revenue. Cancelled, rejected, refunded-in-full, duplicate and excluded orders are left
              out, matching the approved net-sales method.
            </p>
            <p>
              <strong className="text-foreground">Net item revenue</strong> — item revenue after item-level discounts.
              VAT, service charges, delivery fees and tips are excluded.
            </p>
            <p>
              <strong className="text-foreground">Average realized price</strong> = net item revenue ÷ eligible units
              sold.
            </p>
            <p>
              <strong className="text-foreground">Effective recipe cost</strong> — the recipe version in force on the
              business date the item sold. Today's cost is never applied backwards. Items with no costed recipe are never
              treated as zero cost.
            </p>
            <p>
              <strong className="text-foreground">Contribution per unit</strong> = average realized price − effective
              recipe cost. <strong className="text-foreground">Contribution %</strong> = contribution per unit ÷ average
              realized price. <strong className="text-foreground">Total contribution</strong> = contribution per unit ×
              eligible units.
            </p>
            <p>
              <strong className="text-foreground">Popularity</strong> = item units ÷ total eligible units in the same
              category peer group ({cfg.peerScope === "venue" ? "category within each venue" : "category across the selected scope"}
              ). Categories are never compared against each other.
            </p>
            <p>
              <strong className="text-foreground">Popularity threshold</strong> = (1 ÷ number of eligible items in the
              category) × {cfg.popularityFactor}, expressed as a percentage. In this scope that is{" "}
              {popThreshold === null ? NOT_AVAILABLE : pct(popThreshold)}
              {mixedThresholds ? " for the first peer group — each category and venue carries its own." : "."}
            </p>
            <p>
              <strong className="text-foreground">Profitability threshold</strong> —{" "}
              {PROFIT_METHODS.find((m) => m.value === cfg.profitMethod)?.label}. In this scope that is{" "}
              {profitThreshold === null ? NOT_AVAILABLE : money(profitThreshold, { precise: true })} per unit.
            </p>
            <p>
              <strong className="text-foreground">Classification</strong> — inclusive at the threshold: an item exactly
              on a threshold counts as being at or above it. Star = popular and profitable, Plowhorse = popular and below
              the margin benchmark, Puzzle = profitable but under-sold, Dog / Review = below both.
            </p>
            <p>
              <strong className="text-foreground">Not classified</strong> — an item is left out of the quadrants when it
              has no costed recipe, fewer than {cfg.minUnits} eligible units, fewer than {cfg.minDays} selling days, no
              eligible units, invalid data, or sits in a category with fewer than three comparable items. Uncosted items
              are never described as profitable or unprofitable.
            </p>
            <p>{SOURCE_NOTE}</p>
          </div>
        ) : null}
      </Section>

      {query.isLoading ? (
        <LoadingRows rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No eligible menu sales in this scope"
          description="Nothing sold in the selected period, venues and filters. Widen the date range or clear a filter."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Eligible items analysed"
              value={count(classified.length)}
              note={`${count(rows.length)} items sold in scope`}
              definition="Items that passed the minimum-data rule, have a costed recipe and sit in a category with at least three comparable items."
            />
            <KpiCard
              label="Revenue analysed"
              value={totalNet ? pct((analysedNet / totalNet) * 100) : NOT_AVAILABLE}
              note={`${money(analysedNet)} of ${money(totalNet)}`}
              definition="Share of net item revenue in scope that belongs to classified items."
            />
            <KpiCard
              label="Recipe-cost coverage"
              value={totalNet ? pct((costedNet / totalNet) * 100) : NOT_AVAILABLE}
              note="Demo Supy costs"
              definition="Share of net item revenue from items with a recipe cost effective on the day of sale."
            />
            <KpiCard
              label="Total menu contribution"
              value={money(totalContribution)}
              definition="Sum of contribution per unit x eligible units for classified items. Ingredient contribution only — not net profit."
            />
            <KpiCard
              label="Median contribution / unit"
              value={medianCpu === null ? NOT_AVAILABLE : money(medianCpu, { precise: true })}
              definition="Median contribution per unit across classified items in this scope."
            />
            <KpiCard
              label="Stars"
              value={count(byQuadrant("star").length)}
              onClick={() => setQuadrantFilter("star")}
              definition="Popular and above the category margin benchmark."
            />
            <KpiCard
              label="Plowhorses"
              value={count(byQuadrant("plowhorse").length)}
              onClick={() => setQuadrantFilter("plowhorse")}
              definition="Popular but below the category margin benchmark."
            />
            <KpiCard
              label="Puzzles"
              value={count(byQuadrant("puzzle").length)}
              onClick={() => setQuadrantFilter("puzzle")}
              definition="Above the margin benchmark but under-sold."
            />
            <KpiCard
              label="Dogs / Review"
              value={count(byQuadrant("dog").length)}
              onClick={() => setQuadrantFilter("dog")}
              definition="Below both benchmarks. Review in context before proposing removal."
            />
            <KpiCard
              label="Unclassified items"
              value={count(unclassified.length)}
              onClick={() => setQuadrantFilter("unclassified")}
              definition="Items deliberately left out of the quadrants because a required input is missing."
            />
            <KpiCard
              label="Improvement opportunity"
              value={money(opportunity)}
              note="Gap to category benchmark, not a forecast"
              definition="Contribution that below-benchmark classified items would have added in this period had their contribution per unit merely reached their own category benchmark. A size-of-gap estimate, not a projection."
            />
          </div>

          <Section
            title="Four-quadrant view"
            description="Bubble size is net item revenue. Click a bubble to open the item."
            aside={
              <div className="flex flex-wrap gap-2">
                {quadrantFilter ? (
                  <Button variant="outline" size="sm" onClick={() => setQuadrantFilter("")}>
                    Clear quadrant filter
                  </Button>
                ) : null}
                <StatusChip tone="muted">{visible.length} items shown</StatusChip>
              </div>
            }
          >
            <QuadrantChart
              rows={visible}
              popularityThreshold={mixedThresholds ? null : popThreshold}
              profitThreshold={mixedThresholds ? null : profitThreshold}
              onSelect={setSelected}
            />
            {mixedThresholds ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Threshold lines are hidden because this scope mixes several category peer groups, each with its own
                thresholds. Filter to one category to see the lines, or read the per-item thresholds in the table.
              </p>
            ) : null}
          </Section>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {QUADRANT_ORDER.map((q) => {
              const items = byQuadrant(q);
              const meta = QUADRANT_META[q];
              const rev = items.reduce((a, r) => a + Number(r.net_revenue ?? 0), 0);
              const contrib = items.reduce((a, r) => a + Number(r.total_contribution ?? 0), 0);
              const top = [...items]
                .sort((a, b) => Number(b.total_contribution ?? 0) - Number(a.total_contribution ?? 0))
                .slice(0, 3);
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuadrantFilter(quadrantFilter === q ? "" : q)}
                  className={`lift rounded-lg border bg-card p-4 text-left shadow-[var(--shadow-card)] ${
                    quadrantFilter === q ? "border-primary" : "border-border"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="inline-block size-2.5 rounded-full" style={{ background: meta.colour }} />
                    <span className="text-sm font-semibold text-foreground">{meta.label}</span>
                  </span>
                  <p className="mt-1 text-[11px] text-muted-foreground">{meta.definition}</p>
                  <dl className="num mt-3 space-y-0.5 text-[11px] text-muted-foreground">
                    <div className="flex justify-between">
                      <dt>Items</dt>
                      <dd className="text-foreground">
                        {count(items.length)} ({classified.length ? pct((items.length / classified.length) * 100) : NOT_AVAILABLE})
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Share of net revenue</dt>
                      <dd className="text-foreground">{totalNet ? pct((rev / totalNet) * 100) : NOT_AVAILABLE}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Share of contribution</dt>
                      <dd className="text-foreground">
                        {totalContribution ? pct((contrib / totalContribution) * 100) : NOT_AVAILABLE}
                      </dd>
                    </div>
                  </dl>
                  {top.length ? (
                    <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                      {top.map((t) => (
                        <li key={t.item_key}>
                          {t.item_name} — {money(t.total_contribution)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      No item in this scope falls here. With evenly selling demo menus this can be genuinely empty rather
                      than missing.
                    </p>
                  )}
                  <p className="mt-2 text-[11px] font-medium text-foreground">{meta.focus}</p>
                </button>
              );
            })}
          </div>

          <Section
            title="Items"
            description="Sort any column. Export covers exactly the rows and scope you are permitted to see."
            aside={
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowMovement((v) => !v)}>
                  {showMovement ? "Hide quadrant movement" : "Quadrant movement"}
                </Button>
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  Export CSV
                </Button>
              </div>
            }
          >
            {showMovement ? (
              <div className="mb-5 rounded-lg border border-border bg-surface p-3">
                <p className="text-xs font-semibold text-foreground">
                  Movement against {f.comparison === "none" ? "the previous period (disabled)" : `${f.prevFrom} → ${f.prevTo}`}
                </p>
                {f.comparison === "none" ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Comparison is switched off in the global filters, so no previous classification is available.
                  </p>
                ) : movement.length === 0 ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    No item changed quadrant between the two matched periods.
                  </p>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-left text-[10px] tracking-wide text-muted-foreground uppercase">
                          <th className="py-1.5 pr-3">Item</th>
                          <th className="py-1.5 pr-3">Movement</th>
                          <th className="py-1.5 pr-3">Largest input change</th>
                          <th className="py-1.5 pr-3 text-right">Units</th>
                          <th className="py-1.5 pr-3 text-right">Price</th>
                          <th className="py-1.5 pr-3 text-right">Cost</th>
                          <th className="py-1.5 text-right">Contribution / unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movement.map((m) => (
                          <tr key={m.row.item_key} className="border-b border-border/60">
                            <td className="py-1.5 pr-3">
                              {m.row.item_name}
                              <span className="block text-[10px] text-muted-foreground">{m.row.location_name}</span>
                            </td>
                            <td className="py-1.5 pr-3">{m.move.label}</td>
                            <td className="py-1.5 pr-3 text-muted-foreground">{m.driver.driver}</td>
                            <td className="num py-1.5 pr-3 text-right">{pct(m.driver.unitsChangePct)}</td>
                            <td className="num py-1.5 pr-3 text-right">{pct(m.driver.priceChangePct)}</td>
                            <td className="num py-1.5 pr-3 text-right">{pct(m.driver.costChangePct)}</td>
                            <td className="num py-1.5 text-right">
                              {m.row.contribution_per_unit === null
                                ? NOT_AVAILABLE
                                : money(m.row.contribution_per_unit, { precise: true })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      These are movements and coincident input changes. They do not establish cause.
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {visible.length === 0 ? (
              <EmptyState title="No items matched" description="Clear a Menu Engineering filter to see items again." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                      {sortBtn("item_name", "Item", "text-left")}
                      <th className="py-2 pr-3">Venue</th>
                      {sortBtn("units", "Units")}
                      {sortBtn("mix_pct", "Mix")}
                      {sortBtn("net_revenue", "Net revenue")}
                      {sortBtn("avg_price", "Price")}
                      {sortBtn("recipe_cost", "Recipe cost")}
                      {sortBtn("contribution_per_unit", "Contribution / unit")}
                      {sortBtn("contribution_pct", "Contribution %")}
                      {sortBtn("total_contribution", "Total contribution")}
                      <th className="py-2 pr-3">Thresholds</th>
                      <th className="py-2 pr-3">Quadrant</th>
                      <th className="py-2 pr-3">Movement</th>
                      <th className="py-2">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => {
                      const meta = r.quadrant ? QUADRANT_META[r.quadrant] : null;
                      const move = movementOf(r);
                      return (
                        <tr
                          key={r.item_key}
                          className="cursor-pointer border-b border-border/60 hover:bg-muted/40"
                          onClick={() => setSelected(r)}
                        >
                          <td className="py-2 pr-3">
                            {r.item_name}
                            <span className="block text-xs text-muted-foreground">
                              {r.category ?? "Uncategorised"} · POS {r.pos_item_id ?? "n/a"}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-xs text-muted-foreground">
                            {r.location_name}
                            <span className="block">{r.brand_name}</span>
                          </td>
                          <td className="num py-2 pr-3 text-right">{count(r.units)}</td>
                          <td className="num py-2 pr-3 text-right">{pct(r.mix_pct)}</td>
                          <td className="num py-2 pr-3 text-right">{money(r.net_revenue)}</td>
                          <td className="num py-2 pr-3 text-right">{money(r.avg_price, { precise: true })}</td>
                          <td className="num py-2 pr-3 text-right">
                            {r.recipe_cost === null ? "No recipe cost" : money(r.recipe_cost, { precise: true })}
                          </td>
                          <td className="num py-2 pr-3 text-right">
                            {r.contribution_per_unit === null
                              ? NOT_AVAILABLE
                              : money(r.contribution_per_unit, { precise: true })}
                          </td>
                          <td className="num py-2 pr-3 text-right">{pct(r.contribution_pct)}</td>
                          <td className="num py-2 pr-3 text-right">
                            {r.total_contribution === null ? NOT_AVAILABLE : money(r.total_contribution)}
                          </td>
                          <td className="num py-2 pr-3 text-[11px] text-muted-foreground">
                            {pct(r.popularity_threshold_pct)} /{" "}
                            {r.profit_threshold === null ? NOT_AVAILABLE : money(r.profit_threshold, { precise: true })}
                            <span className="block">{r.peer_label}</span>
                          </td>
                          <td className="py-2 pr-3">
                            {meta ? (
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-[0.15rem] text-[10px] font-semibold tracking-[0.08em] uppercase"
                                style={{ color: meta.colour, borderColor: meta.colour }}
                              >
                                {quadrantLabel(r.quadrant)}
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full border px-2 py-[0.15rem] text-[10px] font-semibold tracking-[0.08em] uppercase"
                                style={{ color: UNCLASSIFIED_COLOUR, borderColor: UNCLASSIFIED_COLOUR }}
                                title="Left out of the quadrants on purpose"
                              >
                                {exclusionLabel(r.exclusion_reason)}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-[11px] text-muted-foreground">{move.label}</td>
                          <td className="py-2 text-[11px] text-muted-foreground">{r.confidence}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <EvidenceFooter
              scope={scopeLabel(f, names)}
              period={`${f.from} → ${f.to}${f.comparison === "none" ? "" : ` vs ${f.prevFrom} → ${f.prevTo}`}`}
              sources={SOURCE_NOTE}
              freshness="Demo dataset — the governed reporting layer reads canonical orders, menu items and effective recipe costs only"
              metric="Contribution per unit = average realized price − effective recipe cost. Popularity = item units ÷ category peer-group units. Thresholds are category-relative and shown per item."
              limitations="Synthetic demo data. Ingredient contribution is not net profit. Items without an effective recipe cost, with too little history or in categories with fewer than three comparable items stay unclassified rather than assumed. Simulated scenarios are estimates, never forecasts."
            />
          </Section>
        </>
      )}

      <MenuItemDrawer row={selected} f={f} onClose={() => setSelected(null)} />
    </div>
  );
}
