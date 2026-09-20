import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusChip, LoadingRows, EmptyState } from "@/components/rosy/primitives";
import { money, count, pct, NOT_AVAILABLE } from "@/lib/format";
import type { Filters } from "@/lib/filters";
import { useAccess } from "@/hooks/use-access";
import { useMenuItemChannels, useMenuItemTrend, useMenuItemVenues } from "@/hooks/use-menu-engineering";
import {
  ACTION_TYPES,
  EMPTY_SCENARIO,
  QUADRANT_META,
  REMOVAL_CONSIDERATIONS,
  SOURCE_NOTE,
  exclusionLabel,
  movementOf,
  quadrantLabel,
  recommendation,
  simulate,
  type MenuEngRow,
  type ScenarioInputs,
} from "@/lib/menu-engineering";

const field =
  "mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function Row({ label, value, note }: { label: string; value: string; note?: string | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="num text-right font-medium text-foreground">
        {value}
        {note ? <span className="block text-[10px] font-normal text-muted-foreground">{note}</span> : null}
      </span>
    </div>
  );
}

function Block({ title, children, description }: { title: string; children: React.ReactNode; description?: string }) {
  return (
    <section className="mt-5">
      <p className="eyebrow mb-1">{title}</p>
      {description ? <p className="mb-2 text-[11px] text-muted-foreground">{description}</p> : null}
      {children}
    </section>
  );
}

function Simulator({ row }: { row: MenuEngRow }) {
  const [s, setS] = useState<ScenarioInputs>(EMPTY_SCENARIO);
  const p = simulate(row, s);
  const set = (k: keyof ScenarioInputs) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setS((prev) => ({ ...prev, [k]: Number(e.target.value || 0) }));

  return (
    <div className="rounded-lg border border-dashed border-border bg-surface p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[11px] text-muted-foreground">
          Selling price change (%)
          <Input type="number" step="0.5" value={s.priceDeltaPct} onChange={set("priceDeltaPct")} className="mt-1" />
        </label>
        <label className="text-[11px] text-muted-foreground">
          Recipe / supplier cost change (%)
          <Input type="number" step="0.5" value={s.costDeltaPct} onChange={set("costDeltaPct")} className="mt-1" />
        </label>
        <label className="text-[11px] text-muted-foreground">
          Expected unit change (%) — your assumption only
          <Input type="number" step="1" value={s.unitsDeltaPct} onChange={set("unitsDeltaPct")} className="mt-1" />
        </label>
        <label className="text-[11px] text-muted-foreground">
          Modifier attachment uplift (AED per unit)
          <Input
            type="number"
            step="0.5"
            value={s.modifierUpliftPerUnit}
            onChange={set("modifierUpliftPerUnit")}
            className="mt-1"
          />
        </label>
      </div>

      <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
        <Row label="Projected realized price" value={money(p.price, { precise: true })} />
        <Row label="Projected units" value={count(Math.round(p.units))} />
        <Row label="Projected net revenue" value={money(p.revenue)} />
        <Row
          label="Projected contribution per unit"
          value={p.contributionPerUnit === null ? NOT_AVAILABLE : money(p.contributionPerUnit, { precise: true })}
        />
        <Row label="Projected contribution %" value={pct(p.contributionPct)} />
        <Row
          label="Projected total contribution"
          value={p.totalContribution === null ? NOT_AVAILABLE : money(p.totalContribution)}
          note={
            p.deltaContribution === null
              ? undefined
              : `${p.deltaContribution >= 0 ? "+" : ""}${money(p.deltaContribution)} versus the actual period`
          }
        />
        <Row
          label="Quadrant if margin changed this way"
          value={p.projectedQuadrant ? quadrantLabel(p.projectedQuadrant) : NOT_AVAILABLE}
          note="Popularity is held constant — price elasticity is not in the data"
        />
      </div>

      <p className="mt-3 text-[11px] font-medium text-warning-foreground">
        This is a scenario estimate, not a forecast or approved menu change.
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Nothing here writes to menus, recipes, prices or any external platform. Save it as a proposed action if you want
        it reviewed.
      </p>
    </div>
  );
}

function ProposeAction({ row, f, onDone }: { row: MenuEngRow; f: Filters; onDone: () => void }) {
  const { data: access } = useAccess();
  const [type, setType] = useState<string>(ACTION_TYPES[0]);
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");
  const [impact, setImpact] = useState("");
  const rec = recommendation(row);

  const create = useMutation({
    mutationFn: async () => {
      if (!access?.orgId) throw new Error("No workspace membership");
      const { error } = await supabase.from("rosy_actions").insert({
        org_id: access.orgId,
        location_id: row.location_id,
        title: `${type}: ${row.item_name}${row.location_name ? ` — ${row.location_name}` : ""}`,
        why_it_matters: `${quadrantLabel(row.quadrant)} in ${row.peer_label ?? "its category"}. ${rec.evidence}`,
        source_kind: "menu_engineering",
        source_ref: row.item_key,
        department: "menu",
        severity: row.quadrant === "dog" || row.quadrant === "plowhorse" ? "high" : "medium",
        status: "open",
        owner_name: owner || null,
        due_date: due || null,
        success_metric: impact || null,
        evidence: {
          period: `${f.from} → ${f.to}`,
          scope: row.location_name ?? "Selected scope",
          quadrant: row.quadrant,
          previous_quadrant: row.prev_quadrant,
          units: row.units,
          menu_mix_pct: row.mix_pct,
          net_revenue: row.net_revenue,
          avg_realized_price: row.avg_price,
          recipe_cost: row.recipe_cost,
          contribution_per_unit: row.contribution_per_unit,
          total_contribution: row.total_contribution,
          popularity_threshold_pct: row.popularity_threshold_pct,
          profit_threshold: row.profit_threshold,
          profit_method: row.profit_method,
          data_confidence: row.confidence,
          sources: SOURCE_NOTE,
        },
      } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: onDone,
  });

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[11px] text-muted-foreground">
          Proposed action
          <select className={field} value={type} onChange={(e) => setType(e.target.value)}>
            {ACTION_TYPES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-muted-foreground">
          Owner
          <input className={field} value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Name" />
        </label>
        <label className="text-[11px] text-muted-foreground">
          Due date
          <input type="date" className={field} value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <label className="text-[11px] text-muted-foreground">
          Expected impact / success measure
          <input
            className={field}
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
            placeholder="e.g. contribution per unit above category median"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? "Saving…" : "Save as proposed action"}
        </Button>
        <span className="text-[11px] text-muted-foreground">
          Starts as “Proposed” in Actions &amp; Outcomes. It never changes Foodics, Supy or any menu.
        </span>
      </div>
      {create.isError ? (
        <p className="mt-2 text-[11px] text-destructive">{(create.error as Error).message}</p>
      ) : null}
      {create.isSuccess ? (
        <p className="mt-2 text-[11px] text-positive">Saved. Track it on Actions &amp; Outcomes.</p>
      ) : null}
    </div>
  );
}

export function MenuItemDrawer({
  row,
  f,
  onClose,
}: {
  row: MenuEngRow | null;
  f: Filters;
  onClose: () => void;
}) {
  const open = Boolean(row);
  const trend = useMenuItemTrend(row?.product_id ?? null, f, open);
  const channels = useMenuItemChannels(row?.product_id ?? null, f, open);
  const venues = useMenuItemVenues(row?.item_name ?? null, f, open);

  if (!row) return null;
  const rec = recommendation(row);
  const move = movementOf(row);
  const meta = row.quadrant ? QUADRANT_META[row.quadrant] : null;

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="text-left">{row.item_name}</SheetTitle>
          <SheetDescription className="text-left">
            {row.category ?? "Uncategorised"} · {row.brand_name ?? "No brand"} ·{" "}
            {row.location_name ?? "Multiple venues"} · POS {row.pos_item_id ?? "n/a"}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-8">
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusChip tone={meta?.tone ?? "muted"}>
              {row.quadrant ? quadrantLabel(row.quadrant) : exclusionLabel(row.exclusion_reason)}
            </StatusChip>
            <StatusChip tone="muted">Confidence: {row.confidence ?? "unknown"}</StatusChip>
            <StatusChip tone="muted">{move.label}</StatusChip>
          </div>

          <Block title="Performance in the selected period">
            <div className="grid gap-x-6 sm:grid-cols-2">
              <Row label="Eligible units sold" value={count(row.units)} />
              <Row label="Menu mix" value={pct(row.mix_pct)} note={`threshold ${pct(row.popularity_threshold_pct)}`} />
              <Row label="Net item revenue" value={money(row.net_revenue)} />
              <Row label="Average realized price" value={money(row.avg_price, { precise: true })} />
              <Row
                label="Effective recipe cost"
                value={row.recipe_cost === null ? NOT_AVAILABLE : money(row.recipe_cost, { precise: true })}
                note={row.cost_effective_from ? `effective from ${row.cost_effective_from}` : "no costed recipe"}
              />
              <Row
                label="Contribution per unit"
                value={
                  row.contribution_per_unit === null ? NOT_AVAILABLE : money(row.contribution_per_unit, { precise: true })
                }
                note={row.profit_threshold === null ? undefined : `threshold ${money(row.profit_threshold, { precise: true })}`}
              />
              <Row label="Contribution %" value={pct(row.contribution_pct)} />
              <Row
                label="Total contribution"
                value={row.total_contribution === null ? NOT_AVAILABLE : money(row.total_contribution)}
              />
              <Row label="Selling days in period" value={count(row.active_days)} />
              <Row label="Recipe-cost coverage" value={pct(row.cost_coverage_pct)} />
            </div>
          </Block>

          <Block title="Trend" description="Daily units, realized price and contribution per unit for this item.">
            {trend.isLoading ? (
              <LoadingRows rows={3} />
            ) : (trend.data ?? []).length === 0 ? (
              <EmptyState title="No daily rows" description="This item did not sell in the selected period and scope." />
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend.data ?? []} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="business_date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 11,
                      }}
                    />
                    <Line type="monotone" dataKey="units" name="Units" stroke="var(--chart-1)" dot={false} />
                    <Line type="monotone" dataKey="avg_price" name="Realized price" stroke="var(--chart-5)" dot={false} />
                    <Line
                      type="monotone"
                      dataKey="contribution_per_unit"
                      name="Contribution / unit"
                      stroke="var(--quadrant-star)"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Block>

          <Block
            title="Venue comparison"
            description="The same item name across the venues you are granted. Venues outside your access are never included."
          >
            {venues.isLoading ? (
              <LoadingRows rows={3} />
            ) : (venues.data ?? []).length === 0 ? (
              <EmptyState title="No comparable venues" description="This item only sold in one granted venue." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] tracking-wide text-muted-foreground uppercase">
                      <th className="py-1.5 pr-3">Venue</th>
                      <th className="py-1.5 pr-3 text-right">Units</th>
                      <th className="py-1.5 pr-3 text-right">Price</th>
                      <th className="py-1.5 pr-3 text-right">Cost</th>
                      <th className="py-1.5 pr-3 text-right">Contribution</th>
                      <th className="py-1.5 text-right">Category mix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(venues.data ?? []).map((v) => (
                      <tr key={String(v["location_id"])} className="border-b border-border/60">
                        <td className="py-1.5 pr-3">{String(v["location_name"])}</td>
                        <td className="num py-1.5 pr-3 text-right">{count(Number(v["units"]))}</td>
                        <td className="num py-1.5 pr-3 text-right">{money(Number(v["avg_price"]), { precise: true })}</td>
                        <td className="num py-1.5 pr-3 text-right">
                          {v["recipe_cost"] === null ? NOT_AVAILABLE : money(Number(v["recipe_cost"]), { precise: true })}
                        </td>
                        <td className="num py-1.5 pr-3 text-right">
                          {v["contribution_per_unit"] === null
                            ? NOT_AVAILABLE
                            : money(Number(v["contribution_per_unit"]), { precise: true })}
                        </td>
                        <td className="num py-1.5 text-right">{pct(Number(v["category_mix_pct"]))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Classification is calculated per venue, so the same dish can sit in different quadrants in different
                  venues.
                </p>
              </div>
            )}
          </Block>

          <Block title="Channel comparison" description="Dine-in, takeaway and delivery for this item where data exists.">
            {channels.isLoading ? (
              <LoadingRows rows={2} />
            ) : (channels.data ?? []).length === 0 ? (
              <EmptyState title="No channel rows" description="No eligible sales for this item in the period." />
            ) : (
              <div className="grid gap-x-6 sm:grid-cols-2">
                {(channels.data ?? []).map((c) => (
                  <Row
                    key={`${c["channel"]}-${c["fulfilment_type"]}`}
                    label={`${c["channel"]} · ${String(c["fulfilment_type"]).replace(/_/g, " ")}`}
                    value={`${count(Number(c["units"]))} units · ${money(Number(c["net_revenue"]))}`}
                    note={`price ${money(Number(c["avg_price"]), { precise: true })} · contribution ${
                      c["contribution_per_unit"] === null
                        ? NOT_AVAILABLE
                        : money(Number(c["contribution_per_unit"]), { precise: true })
                    }`}
                  />
                ))}
              </div>
            )}
          </Block>

          <Block title="Recipe cost breakdown">
            <div className="rounded-lg border border-dashed border-border bg-surface p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Ingredient-level breakdown is not available in the demo</p>
              <p className="mt-1">
                The demo Supy records hold one effective ingredient cost per recipe version
                {row.recipe_cost === null
                  ? " — and this item has no costed recipe at all, so no margin is shown for it anywhere."
                  : `: ${money(row.recipe_cost, { precise: true })} per unit, effective from ${
                      row.cost_effective_from ?? "unknown"
                    } (source: ${row.cost_source ?? "demo"}).`}
              </p>
              <p className="mt-1">
                Ingredient quantities and unit costs arrive with the Supy connection. They are left blank rather than
                estimated.
              </p>
            </div>
          </Block>

          <Block title="Recommendation">
            <div className="rounded-lg border border-border bg-card p-3 text-xs">
              <p className="text-sm font-semibold text-foreground">{rec.headline}</p>
              <p className="mt-1 text-muted-foreground">{rec.evidence}</p>
              {meta ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-muted-foreground">
                  {meta.actions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-2 text-[11px] text-muted-foreground">{rec.caution}</p>
            </div>
            {row.quadrant === "dog" ? (
              <div className="mt-3 rounded-lg border border-border bg-surface p-3 text-[11px] text-muted-foreground">
                <p className="font-medium text-foreground">Consider before proposing removal</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {REMOVAL_CONSIDERATIONS.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Block>

          <Block title="Scenario simulator" description="Decision support only. Source data is never changed.">
            <Simulator row={row} />
          </Block>

          <Block title="Propose an action">
            <ProposeAction row={row} f={f} onDone={() => undefined} />
          </Block>

          <p className="mt-5 border-t border-border pt-3 text-[11px] text-muted-foreground">{SOURCE_NOTE}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
