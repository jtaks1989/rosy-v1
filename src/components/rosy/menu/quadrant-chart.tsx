import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  QUADRANT_META,
  UNCLASSIFIED_COLOUR,
  exclusionLabel,
  quadrantLabel,
  type MenuEngRow,
  type Quadrant,
} from "@/lib/menu-engineering";
import { money, count, pct } from "@/lib/format";

type Point = MenuEngRow & { x: number; y: number; z: number };

const GROUPS: (Quadrant | "unclassified")[] = ["star", "plowhorse", "puzzle", "dog", "unclassified"];

function colourOf(group: Quadrant | "unclassified") {
  return group === "unclassified" ? UNCLASSIFIED_COLOUR : QUADRANT_META[group].colour;
}

function PointTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  const row = active && payload && payload.length ? payload[0]!.payload : null;
  if (!row) return null;
  const line = (label: string, value: string) => (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="num font-medium text-foreground">{value}</span>
    </div>
  );
  return (
    <div className="max-w-[19rem] rounded-lg border border-border bg-card p-3 text-[11px] shadow-[var(--shadow-card)]">
      <p className="text-sm font-semibold text-foreground">{row.item_name}</p>
      <p className="mb-2 text-muted-foreground">
        {row.category ?? "Uncategorised"} · {row.brand_name ?? "No brand"} · {row.location_name ?? "Multiple venues"}
      </p>
      <div className="space-y-0.5">
        {line("Eligible units", count(row.units))}
        {line("Menu mix", pct(row.mix_pct))}
        {line("Net revenue", money(row.net_revenue))}
        {line("Average realized price", money(row.avg_price, { precise: true }))}
        {line("Effective recipe cost", row.recipe_cost === null ? "Not available" : money(row.recipe_cost, { precise: true }))}
        {line(
          "Contribution per unit",
          row.contribution_per_unit === null ? "Not available" : money(row.contribution_per_unit, { precise: true }),
        )}
        {line("Contribution %", pct(row.contribution_pct))}
        {line("Total contribution", row.total_contribution === null ? "Not available" : money(row.total_contribution))}
        {line("Quadrant", row.quadrant ? quadrantLabel(row.quadrant) : exclusionLabel(row.exclusion_reason))}
        {line("Data confidence", row.confidence ?? "Not available")}
        {line("Cost effective from", row.cost_effective_from ?? "No costed recipe")}
      </div>
      <p className="mt-2 border-t border-border pt-2 text-muted-foreground">
        Sources: {row.source_systems ?? "demo"} (demo) · recipe cost {row.cost_source ?? "not mapped"}
      </p>
    </div>
  );
}

export function QuadrantChart({
  rows,
  popularityThreshold,
  profitThreshold,
  onSelect,
}: {
  rows: MenuEngRow[];
  popularityThreshold: number | null;
  profitThreshold: number | null;
  onSelect: (row: MenuEngRow) => void;
}) {
  const points: Point[] = rows
    .filter((r) => r.mix_pct !== null)
    .map((r) => ({
      ...r,
      x: Number(r.mix_pct ?? 0),
      y: Number(r.contribution_per_unit ?? 0),
      z: Math.max(Number(r.net_revenue ?? 0), 1),
    }));

  const grouped = GROUPS.map((g) => ({
    group: g,
    data: points.filter((p) => (p.quadrant ?? "unclassified") === g),
  })).filter((g) => g.data.length > 0);

  return (
    <div className="w-full">
      <div className="h-[22rem] w-full sm:h-[26rem]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 8 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name="Menu mix %"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              stroke="var(--border)"
              label={{
                value: "Popularity — menu mix % within category",
                position: "insideBottom",
                offset: -16,
                fontSize: 11,
                fill: "var(--muted-foreground)",
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Contribution per unit"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              stroke="var(--border)"
              label={{
                value: "Contribution per unit (AED)",
                angle: -90,
                position: "insideLeft",
                fontSize: 11,
                fill: "var(--muted-foreground)",
              }}
            />
            <ZAxis type="number" dataKey="z" range={[60, 620]} name="Net revenue" />
            {popularityThreshold !== null ? (
              <ReferenceLine
                x={popularityThreshold}
                stroke="var(--muted-foreground)"
                strokeDasharray="5 4"
                label={{ value: "Popularity threshold", fontSize: 10, fill: "var(--muted-foreground)", position: "top" }}
              />
            ) : null}
            {profitThreshold !== null ? (
              <ReferenceLine
                y={profitThreshold}
                stroke="var(--muted-foreground)"
                strokeDasharray="5 4"
                label={{
                  value: "Profitability threshold",
                  fontSize: 10,
                  fill: "var(--muted-foreground)",
                  position: "insideTopRight",
                }}
              />
            ) : null}
            <Tooltip content={<PointTooltip />} />
            {grouped.map((g) => (
              <Scatter
                key={g.group}
                name={g.group === "unclassified" ? "Unclassified" : QUADRANT_META[g.group].label}
                data={g.data}
                fill={colourOf(g.group)}
                fillOpacity={0.72}
                stroke={colourOf(g.group)}
                onClick={(p: unknown) => {
                  const point = (p as { payload?: Point } | undefined)?.payload;
                  if (point) onSelect(point);
                }}
                className="cursor-pointer"
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {GROUPS.map((g) => (
          <span key={g} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block size-2.5 rounded-full"
              style={{ background: colourOf(g) }}
            />
            {g === "unclassified" ? "Unclassified / needs data" : QUADRANT_META[g].label}
          </span>
        ))}
        <span>Bubble size = net item revenue</span>
      </div>
    </div>
  );
}
