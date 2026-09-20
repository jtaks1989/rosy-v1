/**
 * Menu engineering domain layer.
 *
 * Every figure shown in the interface comes from the governed database
 * reporting layer (`mart_menu_engineering` and `rosy_menu_engineering*`).
 * Nothing in this file recomputes a published metric: it only labels,
 * explains, sorts, exports and — inside the clearly marked scenario
 * simulator — models hypothetical inputs the user typed themselves.
 */

export type Quadrant = "star" | "plowhorse" | "puzzle" | "dog";

export type MenuEngRow = {
  item_key: string;
  product_id: string | null;
  item_name: string;
  category: string | null;
  brand_name: string | null;
  location_id: string | null;
  location_name: string | null;
  pos_item_id: string | null;
  units: number;
  net_revenue: number;
  discounts: number;
  avg_price: number | null;
  recipe_cost: number | null;
  contribution_per_unit: number | null;
  contribution_pct: number | null;
  total_contribution: number | null;
  mix_pct: number | null;
  cost_coverage_pct: number | null;
  popularity_threshold_pct: number | null;
  profit_threshold: number | null;
  profit_method: string | null;
  peer_items: number | null;
  peer_label: string | null;
  quadrant: Quadrant | null;
  confidence: "high" | "medium" | "low" | "insufficient" | null;
  exclusion_reason: string | null;
  active_days: number | null;
  first_sale: string | null;
  last_sale: string | null;
  cost_effective_from: string | null;
  cost_source: string | null;
  source_systems: string | null;
  prev_quadrant: Quadrant | null;
  prev_units: number | null;
  prev_avg_price: number | null;
  prev_recipe_cost: number | null;
  prev_contribution_per_unit: number | null;
  prev_mix_pct: number | null;
  prev_total_contribution: number | null;
};

export type MenuEngConfig = {
  minUnits: number;
  minDays: number;
  popularityFactor: number;
  profitMethod: "median" | "weighted" | "fixed";
  fixedThreshold: number | null;
  peerScope: "venue" | "scope";
  consolidated: boolean;
};

export const DEFAULT_CONFIG: MenuEngConfig = {
  minUnits: 10,
  minDays: 14,
  popularityFactor: 0.7,
  profitMethod: "median",
  fixedThreshold: null,
  peerScope: "venue",
  consolidated: false,
};

export const QUADRANT_META: Record<
  Quadrant,
  {
    label: string;
    definition: string;
    colour: string;
    tone: "positive" | "warning" | "neutral" | "critical";
    focus: string;
    actions: string[];
  }
> = {
  star: {
    label: "Stars",
    definition: "Sells well within its category and earns a strong contribution per unit.",
    colour: "var(--quadrant-star)",
    tone: "positive",
    focus: "Protect what is already working before changing anything else.",
    actions: [
      "Maintain quality and availability",
      "Protect recipe consistency",
      "Feature prominently on the menu",
      "Test a small price increase",
      "Avoid unnecessary discounting",
      "Promote high-margin modifiers and pairings",
    ],
  },
  plowhorse: {
    label: "Plowhorses",
    definition: "Guests order it often, but each unit contributes less than the category benchmark.",
    colour: "var(--quadrant-plowhorse)",
    tone: "warning",
    focus: "Recover margin without damaging a dish guests clearly like.",
    actions: [
      "Review portion size",
      "Review ingredient costs",
      "Negotiate supplier pricing",
      "Test a careful price increase",
      "Improve modifier attachment",
      "Reduce discount leakage",
      "Re-engineer the recipe without harming guest satisfaction",
    ],
  },
  puzzle: {
    label: "Puzzles",
    definition: "Contributes well per unit but too few guests choose it.",
    colour: "var(--quadrant-puzzle)",
    tone: "neutral",
    focus: "Demand, not margin, is the constraint — work on visibility and recommendation.",
    actions: [
      "Improve menu placement",
      "Improve naming and description",
      "Improve photography",
      "Train staff to recommend it",
      "Test bundles and pairings",
      "Check whether it is reaching the right guest segment",
    ],
  },
  dog: {
    label: "Dogs / Review",
    definition:
      "Low popularity and low contribution in its category. Review before concluding anything — some items are kept on purpose.",
    colour: "var(--quadrant-dog)",
    tone: "critical",
    focus: "Investigate the reason it exists before proposing any change.",
    actions: [
      "Review whether the item should remain",
      "Consider replacing or repositioning it",
      "Reduce operational complexity",
      "Review ingredient overlap with popular items",
      "Check whether it serves a strategic, seasonal or dietary purpose",
    ],
  },
};

export const UNCLASSIFIED_COLOUR = "var(--quadrant-unclassified)";

export const EXCLUSION_LABEL: Record<string, string> = {
  missing_recipe_cost: "Missing recipe cost",
  insufficient_sales_history: "Insufficient sales history",
  insufficient_availability_history: "Insufficient availability history",
  no_eligible_units: "No eligible units sold",
  invalid_data: "Invalid or incomplete data",
  category_too_few_comparable_items: "Category has too few comparable items",
};

export function exclusionLabel(reason: string | null | undefined) {
  if (!reason) return "Unclassified";
  return EXCLUSION_LABEL[reason] ?? reason.replace(/_/g, " ");
}

export const CONFIDENCE_LABEL: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  insufficient: "Not classified",
};

export function quadrantLabel(q: Quadrant | null | undefined) {
  return q ? QUADRANT_META[q].label.replace(/s$/, "").replace("Dogs / Review", "Dog / Review") : "Unclassified";
}

/** Rule-based, evidence-first recommendation. Never states a guaranteed outcome. */
export function recommendation(row: MenuEngRow): { headline: string; evidence: string; caution: string } {
  const mix = row.mix_pct ?? 0;
  const thr = row.popularity_threshold_pct ?? 0;
  const cpu = row.contribution_per_unit;
  const pthr = row.profit_threshold;

  if (!row.quadrant) {
    return {
      headline:
        row.exclusion_reason === "missing_recipe_cost"
          ? "Obtain a recipe cost before judging this item"
          : "Collect more data before classifying this item",
      evidence: `${exclusionLabel(row.exclusion_reason)}. ${row.units} eligible unit(s) over ${row.active_days ?? 0} selling day(s).`,
      caution:
        "This item is deliberately left out of the quadrants. It is neither profitable nor unprofitable until the missing input exists.",
    };
  }

  const evidence = `Menu mix ${mix.toFixed(1)}% against a ${thr.toFixed(1)}% threshold; contribution ${
    cpu === null ? "unavailable" : `AED ${cpu.toFixed(2)}`
  } against a ${pthr === null ? "unavailable" : `AED ${pthr.toFixed(2)}`} category benchmark (${row.peer_items ?? 0} comparable items in ${row.peer_label ?? "category"}).`;

  const headline: Record<Quadrant, string> = {
    star: "Protect it: hold the recipe, keep it visible, test a small price move",
    plowhorse: "Work on cost and portion before touching the price",
    puzzle: "Work on visibility and recommendation, not margin",
    dog: "Review the item in context before proposing removal",
  };

  return {
    headline: headline[row.quadrant],
    evidence,
    caution:
      "This is a rule-based reading of the selected period and scope. It cannot promise a profit improvement, and it does not account for guest expectations, seasonality or supplier commitments.",
  };
}

export const REMOVAL_CONSIDERATIONS = [
  "Are its ingredients shared with popular items, so removing it would not reduce purchasing complexity?",
  "Would removal genuinely reduce waste and kitchen complexity, or simply move it?",
  "Does it satisfy a dietary requirement guests rely on?",
  "Is it seasonal, so this period is not representative?",
  "Does it hold a signature position guests associate with the brand?",
  "Does it lift basket size through modifiers or pairings?",
  "Is it intentionally low-margin as a traffic driver?",
];

export type ScenarioInputs = {
  priceDeltaPct: number;
  costDeltaPct: number;
  unitsDeltaPct: number;
  modifierUpliftPerUnit: number;
};

export const EMPTY_SCENARIO: ScenarioInputs = {
  priceDeltaPct: 0,
  costDeltaPct: 0,
  unitsDeltaPct: 0,
  modifierUpliftPerUnit: 0,
};

export function simulate(row: MenuEngRow, s: ScenarioInputs) {
  const price = (row.avg_price ?? 0) * (1 + s.priceDeltaPct / 100);
  const cost = (row.recipe_cost ?? 0) * (1 + s.costDeltaPct / 100);
  const units = row.units * (1 + s.unitsDeltaPct / 100);
  const costed = row.recipe_cost !== null;
  const cpu = costed ? price - cost + s.modifierUpliftPerUnit : null;
  const revenue = price * units;
  return {
    price,
    cost: costed ? cost : null,
    units,
    revenue,
    contributionPerUnit: cpu,
    contributionPct: cpu !== null && price > 0 ? (cpu / price) * 100 : null,
    totalContribution: cpu !== null ? cpu * units : null,
    deltaContribution:
      cpu !== null && row.total_contribution !== null ? cpu * units - row.total_contribution : null,
    /** Popularity is not modelled: volume response to price is not in the data. */
    projectedQuadrant:
      cpu !== null && row.profit_threshold !== null && row.mix_pct !== null && row.popularity_threshold_pct !== null
        ? ((row.mix_pct >= row.popularity_threshold_pct
            ? cpu >= row.profit_threshold
              ? "star"
              : "plowhorse"
            : cpu >= row.profit_threshold
              ? "puzzle"
              : "dog") as Quadrant)
        : null,
  };
}

export type MovementKind =
  | "improved"
  | "declined"
  | "unchanged"
  | "newly_classified"
  | "no_longer_classified";

const RANK: Record<Quadrant, number> = { dog: 0, puzzle: 1, plowhorse: 1, star: 2 };

export function movementOf(row: MenuEngRow): { kind: MovementKind; label: string } {
  const prev = row.prev_quadrant;
  const cur = row.quadrant;
  if (!prev && cur) return { kind: "newly_classified", label: `Newly classified → ${quadrantLabel(cur)}` };
  if (prev && !cur) return { kind: "no_longer_classified", label: `${quadrantLabel(prev)} → no longer classified` };
  if (!prev || !cur) return { kind: "unchanged", label: "Not classified in either period" };
  if (prev === cur) return { kind: "unchanged", label: `Stayed ${quadrantLabel(cur)}` };
  const kind: MovementKind = RANK[cur] > RANK[prev] ? "improved" : RANK[cur] < RANK[prev] ? "declined" : "unchanged";
  return { kind, label: `${quadrantLabel(prev)} → ${quadrantLabel(cur)}` };
}

/** Largest single input change between the periods. Described as a driver, never a cause. */
export function movementDriver(row: MenuEngRow) {
  const parts: { label: string; magnitude: number }[] = [];
  const rel = (cur: number | null, prev: number | null) =>
    cur === null || prev === null || prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100;

  const u = rel(row.units, row.prev_units);
  const p = rel(row.avg_price, row.prev_avg_price);
  const c = rel(row.recipe_cost, row.prev_recipe_cost);
  if (u !== null) parts.push({ label: `units ${u >= 0 ? "+" : ""}${u.toFixed(1)}%`, magnitude: Math.abs(u) });
  if (p !== null) parts.push({ label: `realized price ${p >= 0 ? "+" : ""}${p.toFixed(1)}%`, magnitude: Math.abs(p) });
  if (c !== null) parts.push({ label: `recipe cost ${c >= 0 ? "+" : ""}${c.toFixed(1)}%`, magnitude: Math.abs(c) });
  parts.sort((a, b) => b.magnitude - a.magnitude);
  return {
    driver: parts[0]?.label ?? "no matched baseline",
    all: parts.map((x) => x.label),
    unitsChangePct: u,
    priceChangePct: p,
    costChangePct: c,
  };
}

const CSV_COLUMNS: { key: keyof MenuEngRow | "quadrant_label" | "movement"; header: string }[] = [
  { key: "item_name", header: "Item" },
  { key: "category", header: "Menu category" },
  { key: "brand_name", header: "Brand" },
  { key: "location_name", header: "Venue" },
  { key: "pos_item_id", header: "POS item ID" },
  { key: "units", header: "Eligible units sold" },
  { key: "mix_pct", header: "Menu mix %" },
  { key: "net_revenue", header: "Net item revenue (AED)" },
  { key: "avg_price", header: "Average realized price (AED)" },
  { key: "recipe_cost", header: "Effective recipe cost per unit (AED)" },
  { key: "contribution_per_unit", header: "Contribution per unit (AED)" },
  { key: "contribution_pct", header: "Contribution %" },
  { key: "total_contribution", header: "Total contribution (AED)" },
  { key: "popularity_threshold_pct", header: "Popularity threshold %" },
  { key: "profit_threshold", header: "Profitability threshold (AED)" },
  { key: "quadrant_label", header: "Quadrant" },
  { key: "prev_quadrant", header: "Previous-period quadrant" },
  { key: "movement", header: "Quadrant movement" },
  { key: "cost_coverage_pct", header: "Recipe-cost coverage %" },
  { key: "confidence", header: "Data confidence" },
  { key: "exclusion_reason", header: "Unclassified reason" },
  { key: "cost_effective_from", header: "Cost effective from" },
  { key: "source_systems", header: "Source systems" },
];

function csvCell(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: MenuEngRow[], header: Record<string, string>) {
  const preamble = Object.entries(header).map(([k, v]) => `# ${k}: ${v}`);
  const body = rows.map((r) =>
    CSV_COLUMNS.map((c) =>
      csvCell(
        c.key === "quadrant_label"
          ? quadrantLabel(r.quadrant)
          : c.key === "movement"
            ? movementOf(r).label
            : (r as Record<string, unknown>)[c.key as string],
      ),
    ).join(","),
  );
  return [...preamble, CSV_COLUMNS.map((c) => csvCell(c.header)).join(","), ...body].join("\n");
}

export function downloadCsv(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const DAYPARTS = [
  { value: "breakfast", label: "Breakfast (before 11:00)" },
  { value: "lunch", label: "Lunch (11:00–16:00)" },
  { value: "dinner", label: "Dinner (16:00–23:00)" },
  { value: "late_night", label: "Late night (after 23:00)" },
] as const;

export const FULFILMENTS = [
  { value: "dine_in", label: "Dine-in" },
  { value: "pickup", label: "Takeaway" },
  { value: "delivery", label: "Delivery" },
] as const;

export const PROFIT_METHODS = [
  { value: "median", label: "Category median contribution per unit" },
  { value: "weighted", label: "Category weighted-average contribution per unit" },
  { value: "fixed", label: "Fixed contribution threshold" },
] as const;

export const ACTION_TYPES = [
  "Review price",
  "Review recipe",
  "Review portion",
  "Review supplier",
  "Improve menu placement",
  "Improve description",
  "Create campaign",
  "Train staff",
  "Test bundle",
  "Monitor",
  "Consider removal",
] as const;

/** Proposed → the existing governed action states, so one workflow stays authoritative. */
export const PROPOSAL_STATUS = [
  { value: "open", label: "Proposed" },
  { value: "under_review", label: "Under review" },
  { value: "assigned", label: "Approved" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Rejected / closed" },
] as const;

export const SOURCE_NOTE =
  "Foodics sales: Demo · Supy recipe and ingredient costs: Demo · Grubtech delivery: Demo/historical · No live source connected";
