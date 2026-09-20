import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { locArg } from "./metrics";

/**
 * "Your Rosy Brief" is computed server-side under the caller's own row-level
 * security, from the same metrics API the dashboards use. Nothing here is
 * estimated: a missing source produces an explicit "not available" line rather
 * than a plausible-looking number, and a change is never presented as a cause.
 */

export type BriefMetric = {
  key: string;
  label: string;
  value: string;
  note?: string;
  status: "operational" | "estimated" | "finance_approved" | "unavailable";
  definition: string;
};

export type BriefChange = {
  metric: string;
  venue: string;
  absolute: string;
  percent: string;
  comparison: string;
  evidence: string;
  freshness: string;
  explanation: "hypothesis" | "unexplained";
};

export type BriefAheadItem = { label: string; value: string; note: string };

export type Brief = {
  greetingName: string;
  role: string | null;
  roleLabel: string;
  period: string;
  scope: string;
  completeness: "preliminary" | "reconciled";
  metrics: BriefMetric[];
  changes: BriefChange[];
  ahead: BriefAheadItem[];
  openActions: number;
  notes: string[];
};

const money = (v: unknown) =>
  v === null || v === undefined
    ? "Not available"
    : `AED ${Number(v).toLocaleString("en-AE", { maximumFractionDigits: 0 })}`;

const ROLE_LABELS: Record<string, string> = {
  leadership: "Portfolio performance, variances and unresolved decisions",
  finance: "Revenue, tax, refunds and reconciliation exceptions",
  investor_relations: "Entity performance and valuation readiness",
  restaurant_manager: "Your venue, upcoming service and assigned tasks",
  inventory_procurement: "Stock risk, waste and supplier exceptions",
  marketing: "Contribution by dish, trends and quieter service periods",
  hr_pro: "Verified document deadlines and renewal progress",
  investor: "Your funded capital, distributions and approved valuations",
  tech_admin: "Source health and access provisioning",
};

const TOPIC_BY_ROLE: Record<string, string[]> = {
  leadership: ["sales", "venues", "menu", "inventory", "actions"],
  finance: ["sales", "venues", "actions"],
  investor_relations: ["sales", "actions"],
  restaurant_manager: ["sales", "guests", "inventory", "actions"],
  inventory_procurement: ["inventory", "menu", "actions"],
  marketing: ["menu", "guests", "sales"],
  hr_pro: ["people", "actions"],
  investor: ["investor"],
  tech_admin: ["actions"],
};

export const getBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from: string; to: string; locations: string[] | null; save?: boolean }) => {
    const ok = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
    if (!ok(input.from) || !ok(input.to)) throw new Error("Invalid reporting period.");
    return {
      from: input.from,
      to: input.to,
      locations: Array.isArray(input.locations) && input.locations.length ? input.locations.slice(0, 25) : null,
      save: Boolean(input.save),
    };
  })
  .handler(async ({ data, context }): Promise<Brief> => {
    const supabase = context.supabase;
    const email = (context.claims as { email?: string } | null)?.email ?? null;

    const { data: membership } = await supabase
      .from("memberships")
      .select("org_id, role_preset")
      .eq("user_id", context.userId)
      .maybeSingle();
    const role = (membership?.role_preset as string | null) ?? null;
    const orgId = (membership?.org_id as string | null) ?? null;

    const { data: permRows } = role
      ? await supabase.from("role_permissions").select("permission").eq("role_preset", role as never)
      : { data: [] as { permission: string }[] };
    const can = new Set((permRows ?? []).map((p) => p.permission));

    const topics = role ? (TOPIC_BY_ROLE[role] ?? ["sales"]) : [];
    const locs = locArg(data.locations);
    const metrics: BriefMetric[] = [];
    const changes: BriefChange[] = [];
    const ahead: BriefAheadItem[] = [];
    const notes: string[] = [];

    // ---- Performance snapshot -------------------------------------------------
    if (topics.includes("sales") && can.has("view_sales")) {
      const { data: cur } = await supabase.rpc("rosy_sales_summary", {
        p_from: data.from,
        p_to: data.to,
        ...locs,
      });
      const c = (Array.isArray(cur) ? cur[0] : cur) as Record<string, any> | undefined;
      metrics.push(
        {
          key: "net_sales",
          label: "Net sales (excl. tax)",
          value: money(c?.['net_sales']),
          status: "operational",
          definition: "net_sales v1 — eligible gross sales excl. tax less allocated discounts and approved reversals.",
          note: `${c?.['excluded_orders'] ?? 0} order(s) excluded as duplicate or unresolved`,
        },
        {
          key: "orders",
          label: "Completed orders",
          value: String(c?.['orders'] ?? 0),
          status: "operational",
          definition: "Canonical orders counted once after cross-provider reconciliation.",
        },
        {
          key: "aov",
          label: "Average order value",
          value: money(c?.['aov']),
          status: "operational",
          definition: "net_sales v1 ÷ completed orders.",
        },
        {
          key: "covers",
          label: "Seated covers (actual)",
          value: c?.['matched_covers'] ? String(c['matched_covers']) : "Not available",
          status: c?.['matched_covers'] ? "operational" : "unavailable",
          definition: "Seated covers from reservations matched with high confidence to a canonical order.",
          note: c?.['cover_coverage_pct'] ? `${c['cover_coverage_pct']}% cover match coverage` : "Reservation source not verified",
        },
      );
    }

    if (topics.includes("venues") && can.has("view_sales")) {
      const span = Math.round(
        (new Date(`${data.to}T00:00:00Z`).getTime() - new Date(`${data.from}T00:00:00Z`).getTime()) / 86400000,
      );
      const prevTo = new Date(`${data.from}T00:00:00Z`);
      prevTo.setUTCDate(prevTo.getUTCDate() - 1);
      const prevFrom = new Date(prevTo);
      prevFrom.setUTCDate(prevFrom.getUTCDate() - span);
      const prevFromIso = prevFrom.toISOString().slice(0, 10);
      const prevToIso = prevTo.toISOString().slice(0, 10);

      const { data: v } = await supabase.rpc("rosy_venue_comparison", {
        p_from: data.from,
        p_to: data.to,
        p_prev_from: prevFromIso,
        p_prev_to: prevToIso,
      });
      const list = ((v ?? []) as Record<string, any>[]).filter(
        (x) => !data.locations || data.locations.includes(String(x['location_id'])),
      );
      const ranked = list
        .filter((x) => x['growth_pct'] !== null && x['prev_net_sales'])
        .sort((a, b) => Math.abs(Number(b['growth_pct'])) - Math.abs(Number(a['growth_pct'])))
        .slice(0, 4);

      for (const x of ranked) {
        const abs = Number(x['net_sales'] ?? 0) - Number(x['prev_net_sales'] ?? 0);
        changes.push({
          metric: "Net sales (excl. tax)",
          venue: String(x['location_name']),
          absolute: `${abs >= 0 ? "+" : "−"}${money(Math.abs(abs)).replace("AED ", "AED ")}`,
          percent: `${Number(x['growth_pct']) >= 0 ? "+" : ""}${x['growth_pct']}%`,
          comparison: `${prevFromIso} → ${prevToIso} (matched length)`,
          evidence: `${x['orders']} completed orders · ${x['excluded_orders']} excluded as duplicate/unresolved · recipe cost coverage ${
            x['recipe_coverage_pct'] ?? "n/a"
          }%`,
          freshness: x['last_source_refresh']
            ? `Source last refreshed ${String(x['last_source_refresh']).slice(0, 16).replace("T", " ")} UTC`
            : "No successful source refresh recorded — treat as stale",
          explanation: "unexplained",
        });
      }
      for (const x of list.filter((y) => y['comparable'] === false).slice(0, 2)) {
        notes.push(
          `${x['location_name']} has no comparable baseline — it opened inside the comparison window, so no change is shown.`,
        );
      }
      if (list.some((x) => !x['last_source_refresh'])) {
        notes.push("At least one venue has no successful source refresh in this window, so its figures are incomplete.");
      }
    }

    if (topics.includes("menu") && can.has("view_menu")) {
      const { data: m } = await supabase.rpc("rosy_menu_performance", {
        p_from: data.from,
        p_to: data.to,
        ...locs,
      });
      const list = (m ?? []) as Record<string, any>[];
      const withCost = list.filter((x) => x['margin_available']);
      const coverage = list.length ? Math.round((withCost.length / list.length) * 100) : 0;
      const avg = withCost.length
        ? withCost.reduce((a, x) => a + Number(x['contribution_pct'] ?? 0), 0) / withCost.length
        : null;
      metrics.push({
        key: "recipe_contribution",
        label: "Recipe contribution (not food cost)",
        value: avg === null ? "Not available" : `${avg.toFixed(1)}%`,
        status: avg === null ? "unavailable" : "estimated",
        definition:
          "recipe_contribution v1 — net item sales excl. tax less effective recipe ingredient cost. Projected, not accounting COGS.",
        note: `Recipe costs available for ${coverage}% of sold items`,
      });
      if (coverage < 100) {
        notes.push(
          `Recipe mapping is incomplete (${coverage}% of sold items), so contribution is a partial view rather than an invented cost.`,
        );
      }
    }

    if (topics.includes("inventory") && can.has("view_inventory")) {
      const { data: i } = await supabase.rpc("rosy_inventory_risk", { ...locs });
      const low = ((i ?? []) as Record<string, any>[]).filter((x) => x['low_stock']);
      metrics.push({
        key: "inventory_risk",
        label: "Ingredients at or below reorder point",
        value: String(low.length),
        status: "operational",
        definition: "Latest stock snapshot per venue. Snapshots are never summed across dates.",
        note: low[0] ? `Latest snapshot ${low[0]['as_of_date']}` : "Latest snapshot per venue",
      });
      for (const x of low.slice(0, 3)) {
        ahead.push({
          label: `Stock constraint — ${x['ingredient_name']}`,
          value: `${x['quantity']} ${x['unit']} at ${x['location_name']}`,
          note: `Reorder point ${x['reorder_threshold']} ${x['unit']} · snapshot ${x['as_of_date']} · Supy read access not verified`,
        });
      }
    }

    if (topics.includes("guests") && can.has("view_guests")) {
      const { data: g } = await supabase.rpc("rosy_guest_cohorts", {
        p_from: data.from,
        p_to: data.to,
        ...locs,
      });
      const r = (Array.isArray(g) ? g[0] : g) as Record<string, any> | undefined;
      metrics.push({
        key: "reservations",
        label: "Reservations in period",
        value: String(r?.['reservations'] ?? 0),
        status: "operational",
        definition: "Booking records — a reservation is not a cover and not an order.",
        note: `${r?.['expected_covers'] ?? 0} expected covers · no-show rate ${
          r?.['no_show_rate'] === null || r?.['no_show_rate'] === undefined ? "not available" : `${r['no_show_rate']}%`
        }`,
      });
      ahead.push({
        label: "Confirmed bookings in view",
        value: `${r?.['reservations'] ?? 0} reservations`,
        note: "Confirmed bookings only — predicted walk-ins are not included and are not forecast here yet.",
      });
    }

    if (topics.includes("people") && can.has("view_people_documents")) {
      const { data: q } = await supabase.rpc("rosy_renewal_queue", { p_days: 60 });
      const list = (q ?? []) as Record<string, any>[];
      const overdue = list.filter((x) => Number(x['days_to_expiry']) < 0);
      metrics.push({
        key: "renewals",
        label: "Documents expiring within 60 days",
        value: String(list.length),
        status: "operational",
        definition: "Configured operational reminder thresholds. These are not legal deadlines.",
        note: `${overdue.length} already past expiry`,
      });
      for (const x of list.slice(0, 3)) {
        ahead.push({
          label: `${x['doc_type']} — ${x['employee_name']}`,
          value: `Expires ${x['expiry_date']}`,
          note: `Owner ${x['owner_name'] ?? "unassigned"} · verification ${x['verification_status']} · penalty exposure not calculated`,
        });
      }
    }

    if (topics.includes("investor") && can.has("view_investor_portal")) {
      const { data: inv } = await supabase.rpc("rosy_my_investments");
      const list = (inv ?? []) as Record<string, any>[];
      const funded = list.reduce((a, x) => a + Number(x['funded'] ?? 0), 0);
      const dist = list.reduce((a, x) => a + Number(x['distributions'] ?? 0), 0);
      const pending = list.filter((x) => x['valuation_status'] === "pending").length;
      metrics.push(
        {
          key: "funded",
          label: "Your funded capital",
          value: money(funded),
          status: "finance_approved",
          definition: "Recorded contributions against your commitments.",
        },
        {
          key: "distributions",
          label: "Distributions received",
          value: money(dist),
          status: "finance_approved",
          definition: "Recorded distribution entries, split between dividend and return of capital.",
        },
      );
      if (pending) {
        notes.push(
          `${pending} holding(s) have no approved and published valuation, so no stake value is shown for them. Daily trading does not change a stake value.`,
        );
      }
    }

    // ---- Outstanding actions -------------------------------------------------
    let openActions = 0;
    if (can.has("view_alerts")) {
      const { count } = await supabase
        .from("rosy_actions")
        .select("id", { count: "exact", head: true })
        .not("status", "in", "(closed,completed)");
      openActions = count ?? 0;
    }

    notes.push(
      "Delivery channels (email, WhatsApp) are not connected, so a briefing is only available in the app right now.",
    );

    const brief: Brief = {
      greetingName: email ? (email.split("@")[0] ?? "there") : "there",
      role,
      roleLabel: role ? (ROLE_LABELS[role] ?? "Scoped briefing") : "No role assigned",
      period: `${data.from} → ${data.to} (Asia/Dubai)`,
      scope: data.locations ? `${data.locations.length} selected venue(s)` : "All granted venues",
      completeness: "preliminary",
      metrics,
      changes,
      ahead,
      openActions,
      notes,
    };

    if (data.save && orgId) {
      await supabase.from("briefing_snapshots").insert({
        org_id: orgId,
        user_id: context.userId,
        role_preset: role,
        period_from: data.from,
        period_to: data.to,
        scope_label: brief.scope,
        completeness: "preliminary",
        payload: brief as never,
        channel: "in_app",
        delivery_status: "viewed_in_app",
      });
    }

    return brief;
  });
