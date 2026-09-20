import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Monitoring rules are deterministic. A natural-language request is parsed into
 * a structured, reviewable rule that the person must confirm before it becomes
 * active, and evaluation only ever calls the allowlisted metrics below — never
 * model-generated SQL. Thresholds are taken from the request or left blank for
 * the person to set; they are never invented by a model.
 */

export const RULE_METRICS = [
  {
    key: "net_sales",
    label: "Net sales (excl. tax)",
    unit: "AED",
    permission: "view_sales",
    definition: "net_sales v1 — eligible gross sales excl. tax less discounts and approved reversals.",
  },
  {
    key: "aov",
    label: "Average order value",
    unit: "AED",
    permission: "view_sales",
    definition: "net_sales v1 ÷ completed orders.",
  },
  {
    key: "recipe_contribution_pct",
    label: "Recipe contribution %",
    unit: "%",
    permission: "view_menu",
    definition: "Weighted recipe contribution across items with a mapped effective recipe cost.",
  },
  {
    key: "low_stock_count",
    label: "Ingredients at or below reorder point",
    unit: "count",
    permission: "view_inventory",
    definition: "Latest stock snapshot per venue; snapshots are never summed across dates.",
  },
  {
    key: "overdue_renewals",
    label: "Overdue document renewals",
    unit: "count",
    permission: "view_people_documents",
    definition: "Documents past their recorded expiry date. Operational reminder, not a legal deadline.",
  },
] as const;

export type RuleMetric = (typeof RULE_METRICS)[number]["key"];

export type RuleDraft = {
  name: string;
  request_text: string;
  metric: RuleMetric;
  metric_label: string;
  scope_type: "all" | "location";
  scope_ref: string | null;
  operator: "above" | "below";
  threshold: number | null;
  baseline: "previous_period" | "fixed_target";
  frequency: "hourly" | "daily" | "weekly";
  min_sample: number;
  channel: "in_app" | "email" | "whatsapp";
  cooldown_hours: number;
  escalate_after_hours: number | null;
  needs: string[];
  notes: string[];
};

function parseRequest(text: string, locationNames: { id: string; name: string }[]): RuleDraft {
  const s = text.toLowerCase();
  let metric: RuleMetric = "net_sales";
  if (/(food cost|recipe|contribution|margin)/.test(s)) metric = "recipe_contribution_pct";
  else if (/(stock|ingredient|inventory|runs low|running low)/.test(s)) metric = "low_stock_count";
  else if (/(renewal|visa|document|expire|overdue)/.test(s)) metric = "overdue_renewals";
  else if (/(average order|aov|spend per order)/.test(s)) metric = "aov";

  const def = RULE_METRICS.find((m) => m.key === metric)!;

  const numMatch = s.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(%|percent|aed)?/);
  const threshold = numMatch ? Number(numMatch[1]) : null;

  const operator: "above" | "below" =
    metric === "low_stock_count" || metric === "overdue_renewals"
      ? "above"
      : /(exceeds|above|over|more than|higher)/.test(s)
        ? "above"
        : "below";

  const matchedVenue = locationNames.find((l) => s.includes(l.name.toLowerCase().split(" ")[0] ?? "@@"));

  const frequency: RuleDraft["frequency"] = /weekly|week/.test(s) ? "weekly" : "daily";

  const needs: string[] = [];
  if (threshold === null) needs.push("A threshold value — Rosy will not invent one.");
  const notes: string[] = [
    "Evaluated by fixed backend queries under your own permissions; the assistant never writes the query.",
    "Only in-app notification is available: email and WhatsApp delivery are not connected.",
  ];
  if (metric === "recipe_contribution_pct") {
    notes.push("Items without a mapped recipe cost are excluded, so coverage is reported with every trigger.");
  }

  return {
    name: text.slice(0, 80),
    request_text: text,
    metric,
    metric_label: def.label,
    scope_type: matchedVenue ? "location" : "all",
    scope_ref: matchedVenue?.id ?? null,
    operator,
    threshold,
    baseline: threshold === null ? "previous_period" : "fixed_target",
    frequency,
    min_sample: metric === "net_sales" || metric === "aov" ? 20 : 1,
    channel: "in_app",
    cooldown_hours: 24,
    escalate_after_hours: null,
    needs,
    notes,
  };
}

export const draftRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { request: string }) => {
    const request = String(input.request ?? "").slice(0, 300).trim();
    if (!request) throw new Error("Describe what Rosy should watch.");
    return { request };
  })
  .handler(async ({ data, context }): Promise<RuleDraft> => {
    const { data: locations } = await context.supabase.from("locations").select("id, name").order("name");
    return parseRequest(
      data.request,
      (locations ?? []).map((l) => ({ id: l.id as string, name: l.name as string })),
    );
  });

type EvalResult = {
  ruleId: string;
  name: string;
  outcome: "triggered" | "within_range" | "insufficient_data" | "cooldown" | "not_permitted";
  detail: string;
  observed: number | null;
  eventId?: string;
};

/**
 * Bounded, idempotent evaluation of the caller's own active rules. At most 25
 * rules per run; a rule can only record one event per dedupe window, and the
 * cooldown is enforced before anything is written.
 */
export const evaluateMyRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from: string; to: string }) => {
    const ok = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
    if (!ok(input.from) || !ok(input.to)) throw new Error("Invalid reporting period.");
    return { from: input.from, to: input.to };
  })
  .handler(async ({ data, context }): Promise<EvalResult[]> => {
    const supabase = context.supabase;
    const { data: membership } = await supabase
      .from("memberships")
      .select("org_id, role_preset")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!membership) return [];
    const { data: permRows } = await supabase
      .from("role_permissions")
      .select("permission")
      .eq("role_preset", membership.role_preset as never);
    const can = new Set((permRows ?? []).map((p) => p.permission));

    const { data: rules } = await supabase
      .from("monitoring_rules")
      .select("*")
      .eq("status", "active")
      .eq("created_by", context.userId)
      .limit(25);

    const results: EvalResult[] = [];

    for (const rule of (rules ?? []) as Record<string, any>[]) {
      const def = RULE_METRICS.find((m) => m.key === rule['metric']);
      if (!def || !can.has(def.permission)) {
        results.push({
          ruleId: rule['id'],
          name: rule['name'],
          outcome: "not_permitted",
          detail: "Your role no longer allows this metric, so the rule was skipped and nothing was sent.",
          observed: null,
        });
        continue;
      }

      const cooldownMs = Number(rule['cooldown_hours'] ?? 24) * 3600_000;
      if (rule['last_triggered_at'] && Date.now() - new Date(rule['last_triggered_at']).getTime() < cooldownMs) {
        results.push({
          ruleId: rule['id'],
          name: rule['name'],
          outcome: "cooldown",
          detail: `Already notified within the ${rule['cooldown_hours']}h cooldown, so no duplicate was raised.`,
          observed: null,
        });
        continue;
      }

      const locFilter = rule['scope_type'] === "location" && rule['scope_ref'] ? [rule['scope_ref']] : null;
      const locs = locFilter ? { p_locations: locFilter } : {};

      let observed: number | null = null;
      let sample = 0;
      let coverage: string | null = null;

      if (def.key === "net_sales" || def.key === "aov") {
        const { data: s } = await supabase.rpc("rosy_sales_summary", {
          p_from: data.from,
          p_to: data.to,
          ...locs,
        });
        const r = (Array.isArray(s) ? s[0] : s) as Record<string, any> | undefined;
        sample = Number(r?.['orders'] ?? 0);
        observed = r ? Number(def.key === "net_sales" ? r['net_sales'] : r['aov']) : null;
      } else if (def.key === "recipe_contribution_pct") {
        const { data: m } = await supabase.rpc("rosy_menu_performance", {
          p_from: data.from,
          p_to: data.to,
          ...locs,
        });
        const list = ((m ?? []) as Record<string, any>[]).filter((x) => x['margin_available']);
        const all = ((m ?? []) as Record<string, any>[]).length;
        sample = list.length;
        coverage = all ? `${Math.round((list.length / all) * 100)}% of sold items have a mapped recipe cost` : null;
        observed = list.length
          ? list.reduce((a, x) => a + Number(x['contribution_pct'] ?? 0), 0) / list.length
          : null;
      } else if (def.key === "low_stock_count") {
        const { data: i } = await supabase.rpc("rosy_inventory_risk", { ...locs });
        const low = ((i ?? []) as Record<string, any>[]).filter((x) => x['low_stock']);
        observed = low.length;
        sample = low.length;
      } else {
        const { data: q } = await supabase.rpc("rosy_renewal_queue", { p_days: 60 });
        const overdue = ((q ?? []) as Record<string, any>[]).filter((x) => Number(x['days_to_expiry']) < 0);
        observed = overdue.length;
        sample = overdue.length;
      }

      if (observed === null || sample < Number(rule['min_sample'] ?? 1)) {
        results.push({
          ruleId: rule['id'],
          name: rule['name'],
          outcome: "insufficient_data",
          detail: `Not enough data to judge this fairly (${sample} of ${rule['min_sample']} minimum). Nothing was raised.`,
          observed,
        });
        continue;
      }

      const threshold = rule['threshold'] === null ? null : Number(rule['threshold']);
      const breached =
        threshold === null
          ? false
          : rule['operator'] === "above"
            ? observed > threshold
            : observed < threshold;

      if (!breached) {
        await supabase.from("monitoring_rules").update({ last_evaluated_at: new Date().toISOString() }).eq("id", rule['id']);
        results.push({
          ruleId: rule['id'],
          name: rule['name'],
          outcome: "within_range",
          detail: `Observed ${observed.toLocaleString("en-AE", { maximumFractionDigits: 2 })} — inside the configured range.`,
          observed,
        });
        continue;
      }

      const dedupeKey = `${rule['metric']}:${rule['scope_ref'] ?? "all"}:${data.from}:${data.to}`;
      const { data: inserted, error } = await supabase
        .from("monitoring_rule_events")
        .insert({
          org_id: rule['org_id'],
          rule_id: rule['id'],
          dedupe_key: dedupeKey,
          observed_value: observed,
          sample_size: sample,
          channel: rule['channel'],
          delivery_status: rule['channel'] === "in_app" ? "in_app_only" : "channel_not_connected",
          detail: {
            metric: def.label,
            definition: def.definition,
            operator: rule['operator'],
            threshold,
            period: `${data.from} → ${data.to} (Asia/Dubai)`,
            coverage,
            explanation: "Threshold breach only. No cause is asserted.",
          } as never,
        })
        .select("id")
        .maybeSingle();

      if (error) {
        results.push({
          ruleId: rule['id'],
          name: rule['name'],
          outcome: "cooldown",
          detail: "This exact event was already recorded, so it was not raised twice.",
          observed,
        });
        continue;
      }

      await supabase
        .from("monitoring_rules")
        .update({ last_evaluated_at: new Date().toISOString(), last_triggered_at: new Date().toISOString() })
        .eq("id", rule['id']);

      results.push({
        ruleId: rule['id'],
        name: rule['name'],
        outcome: "triggered",
        detail: `Observed ${observed.toLocaleString("en-AE", { maximumFractionDigits: 2 })} ${
          rule['operator'] === "above" ? "above" : "below"
        } the configured ${threshold}. Recorded once for this period.`,
        observed,
        ...(inserted?.id ? { eventId: inserted.id as string } : {}),
      });
    }

    return results;
  });
