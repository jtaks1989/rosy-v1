import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-access";
import { useFilters } from "@/lib/filters";
import { draftRule, evaluateMyRules, RULE_METRICS, type RuleDraft } from "@/lib/rules.functions";
import {
  EmptyState,
  LoadingRows,
  NoPermission,
  PageHeader,
  Section,
  StatusChip,
} from "@/components/rosy/primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/monitoring")({
  head: () => ({
    meta: [
      { title: "My monitoring rules — Rosy AI" },
      {
        name: "description",
        content:
          "Ask Rosy to watch a measure, review the exact rule before it activates, and see every time it triggered — once per event, never twice.",
      },
      { property: "og:title", content: "My monitoring rules — Rosy AI" },
      {
        property: "og:description",
        content: "Reviewable, deterministic monitoring rules with cooldowns and audit history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MonitoringPage,
});

const field =
  "mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

const EXAMPLES = [
  "Tell me when recipe contribution falls below 65%",
  "Watch net sales below 40000 at JLT",
  "Notify me when more than 3 ingredients run low",
  "Remind me when more than 0 renewals become overdue",
];

function MonitoringPage() {
  const { data: access } = useAccess();
  const filters = useFilters();
  const qc = useQueryClient();
  const makeDraft = useServerFn(draftRule);
  const evaluate = useServerFn(evaluateMyRules);

  const [request, setRequest] = useState("");
  const [draft, setDraft] = useState<RuleDraft | null>(null);

  const allowed = access?.permissions.includes("use_bot") ?? false;

  const rules = useQuery({
    queryKey: ["monitoring-rules"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monitoring_rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const events = useQuery({
    queryKey: ["monitoring-events"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monitoring_rule_events")
        .select("*, monitoring_rules(name)")
        .order("occurred_at", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const parse = useMutation({
    mutationFn: (text: string) => makeDraft({ data: { request: text } }),
    onSuccess: (d) => setDraft(d),
  });

  const save = useMutation({
    mutationFn: async (status: "active" | "draft") => {
      if (!draft || !access?.orgId) throw new Error("No rule to save");
      const { error } = await supabase.from("monitoring_rules").insert({
        org_id: access.orgId,
        created_by: access.userId,
        name: draft.name,
        request_text: draft.request_text,
        metric: draft.metric,
        scope_type: draft.scope_type,
        scope_ref: draft.scope_ref,
        operator: draft.operator,
        threshold: draft.threshold,
        baseline: draft.baseline,
        frequency: draft.frequency,
        min_sample: draft.min_sample,
        channel: draft.channel,
        recipients: access.email ? [access.email] : [],
        cooldown_hours: draft.cooldown_hours,
        escalate_after_hours: draft.escalate_after_hours,
        status,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setDraft(null);
      setRequest("");
      qc.invalidateQueries({ queryKey: ["monitoring-rules"] });
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("monitoring_rules").update({ status } as never).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitoring-rules"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("monitoring_rules").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitoring-rules"] }),
  });

  const run = useMutation({
    mutationFn: () => evaluate({ data: { from: filters.from, to: filters.to } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monitoring-events"] });
      qc.invalidateQueries({ queryKey: ["monitoring-rules"] });
    },
  });

  if (access && !allowed) return <NoPermission what="Rosy bot monitoring rules" />;

  const list = (rules.data ?? []) as Record<string, any>[];
  const venueName = (id: string | null) =>
    id ? (access?.locations.find((l) => l.id === id)?.name ?? "Selected venue") : "All granted venues";

  return (
    <>
      <PageHeader
        title="My monitoring rules"
        intro="Describe what Rosy should watch. Rosy turns it into a structured rule you confirm before it activates — thresholds are never invented, and evaluation uses fixed backend queries under your own permissions."
        actions={
          <Button size="sm" variant="outline" onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? "Checking…" : "Check my active rules now"}
          </Button>
        }
      />

      <Section title="Ask Rosy to watch something" description="Plain language in, reviewable rule out.">
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-[16rem] flex-1 rounded border border-input bg-background px-3 py-2 text-sm"
            placeholder="Tell me when food cost exceeds our target…"
            value={request}
            onChange={(e) => setRequest(e.target.value)}
          />
          <Button disabled={!request.trim() || parse.isPending} onClick={() => parse.mutate(request)}>
            {parse.isPending ? "Reading…" : "Build the rule"}
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              type="button"
              className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              onClick={() => {
                setRequest(e);
                parse.mutate(e);
              }}
            >
              {e}
            </button>
          ))}
        </div>

        {draft ? (
          <div className="mt-4 rounded-lg border border-primary/30 bg-surface p-4">
            <p className="eyebrow mb-2">Confirm this rule before it becomes active</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                Rule name
                <input className={field} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </label>
              <label className="text-xs text-muted-foreground">
                Measure
                <select
                  className={field}
                  value={draft.metric}
                  onChange={(e) => {
                    const m = RULE_METRICS.find((x) => x.key === e.target.value)!;
                    setDraft({ ...draft, metric: m.key, metric_label: m.label });
                  }}
                >
                  {RULE_METRICS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Venue scope
                <select
                  className={field}
                  value={draft.scope_ref ?? "all"}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      scope_type: e.target.value === "all" ? "all" : "location",
                      scope_ref: e.target.value === "all" ? null : e.target.value,
                    })
                  }
                >
                  <option value="all">All granted venues</option>
                  {(access?.locations ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Trigger when the value is
                <select
                  className={field}
                  value={draft.operator}
                  onChange={(e) => setDraft({ ...draft, operator: e.target.value as "above" | "below" })}
                >
                  <option value="below">Below the threshold</option>
                  <option value="above">Above the threshold</option>
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Threshold
                <input
                  type="number"
                  className={field}
                  value={draft.threshold ?? ""}
                  placeholder="Set a threshold — Rosy will not guess one"
                  onChange={(e) =>
                    setDraft({ ...draft, threshold: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Comparison baseline
                <select
                  className={field}
                  value={draft.baseline}
                  onChange={(e) => setDraft({ ...draft, baseline: e.target.value as RuleDraft["baseline"] })}
                >
                  <option value="fixed_target">Fixed target</option>
                  <option value="previous_period">Previous matched period</option>
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Checked
                <select
                  className={field}
                  value={draft.frequency}
                  onChange={(e) => setDraft({ ...draft, frequency: e.target.value as RuleDraft["frequency"] })}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Minimum data required
                <input
                  type="number"
                  className={field}
                  value={draft.min_sample}
                  onChange={(e) => setDraft({ ...draft, min_sample: Number(e.target.value) })}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Notify by
                <select
                  className={field}
                  value={draft.channel}
                  onChange={(e) => setDraft({ ...draft, channel: e.target.value as RuleDraft["channel"] })}
                >
                  <option value="in_app">In-app</option>
                  <option value="email">Email — not connected</option>
                  <option value="whatsapp">WhatsApp — not connected</option>
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Cooldown between notifications (hours)
                <input
                  type="number"
                  className={field}
                  value={draft.cooldown_hours}
                  onChange={(e) => setDraft({ ...draft, cooldown_hours: Number(e.target.value) })}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Escalate if unresolved after (hours, optional)
                <input
                  type="number"
                  className={field}
                  value={draft.escalate_after_hours ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      escalate_after_hours: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">Recipients: {access?.email ?? "you"} (in-app)</p>

            {draft.needs.length ? (
              <ul className="mt-3 space-y-1 text-xs text-warning-foreground">
                {draft.needs.map((n) => (
                  <li key={n}>• {n}</li>
                ))}
              </ul>
            ) : null}
            <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
              {draft.notes.map((n) => (
                <li key={n}>• {n}</li>
              ))}
              {draft.channel !== "in_app" ? (
                <li>• Delivery channel not connected — the rule will still record in-app only.</li>
              ) : null}
            </ul>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={draft.threshold === null || save.isPending}
                onClick={() => save.mutate("active")}
              >
                Confirm and activate
              </Button>
              <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate("draft")}>
                Save as draft
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                Discard
              </Button>
            </div>
            {save.error ? <p className="mt-2 text-xs text-destructive">{(save.error as Error).message}</p> : null}
          </div>
        ) : null}
      </Section>

      {run.data ? (
        <Section title="Last check" description="Deterministic evaluation under your current permissions.">
          <ul className="divide-y divide-border text-sm">
            {run.data.length === 0 ? (
              <li className="py-2 text-xs text-muted-foreground">You have no active rules to check.</li>
            ) : null}
            {run.data.map((r) => (
              <li key={r.ruleId} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <span className="text-foreground">{r.name}</span>
                <StatusChip
                  tone={
                    r.outcome === "triggered"
                      ? "critical"
                      : r.outcome === "within_range"
                        ? "positive"
                        : r.outcome === "not_permitted"
                          ? "muted"
                          : "warning"
                  }
                >
                  {r.outcome.replace(/_/g, " ")}
                </StatusChip>
                <span className="w-full text-xs text-muted-foreground">{r.detail}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Rules" description="Edit, pause, resume or delete. Only you can change your own rules.">
        {rules.isLoading ? (
          <LoadingRows rows={3} />
        ) : list.length === 0 ? (
          <EmptyState
            title="No monitoring rules yet"
            description="Describe what Rosy should watch above. Nothing activates until you confirm the structured rule."
          />
        ) : (
          <div className="space-y-3">
            {list.map((r) => {
              const def = RULE_METRICS.find((m) => m.key === r['metric']);
              return (
                <div key={r['id']} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{r['name']}</p>
                      <p className="text-xs text-muted-foreground">
                        {def?.label} {r['operator'] === "above" ? ">" : "<"} {r['threshold'] ?? "not set"} ·{" "}
                        {venueName(r['scope_ref'])} · checked {r['frequency']} · cooldown {r['cooldown_hours']}h
                      </p>
                    </div>
                    <StatusChip
                      tone={r['status'] === "active" ? "positive" : r['status'] === "paused" ? "warning" : "muted"}
                    >
                      {r['status']}
                    </StatusChip>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {def?.definition} · Minimum data {r['min_sample']} · Channel{" "}
                    {r['channel'] === "in_app" ? "in-app" : `${r['channel']} (not connected)`}
                  </p>
                  <p className="num mt-1 text-[11px] text-muted-foreground">
                    Last checked{" "}
                    {r['last_evaluated_at'] ? String(r['last_evaluated_at']).slice(0, 16).replace("T", " ") : "never"} ·
                    last triggered{" "}
                    {r['last_triggered_at'] ? String(r['last_triggered_at']).slice(0, 16).replace("T", " ") : "never"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r['status'] === "active" ? (
                      <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: r['id'], status: "paused" })}>
                        Pause
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: r['id'], status: "active" })}>
                        Resume
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(r['id'])}>
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Trigger history" description="One row per event. A repeat of the same event cannot be recorded twice.">
        {events.isLoading ? (
          <LoadingRows rows={3} />
        ) : (events.data ?? []).length === 0 ? (
          <EmptyState title="No triggers recorded" description="Nothing has breached a configured threshold yet." />
        ) : (
          <ul className="divide-y divide-border">
            {((events.data ?? []) as Record<string, any>[]).map((e) => (
              <li key={e['id']} className="py-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {e['monitoring_rules']?.name ?? "Rule"}
                  </span>
                  <span className="num text-muted-foreground">
                    {String(e['occurred_at']).slice(0, 16).replace("T", " ")}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  Observed {Number(e['observed_value']).toLocaleString("en-AE", { maximumFractionDigits: 2 })} ·
                  sample {e['sample_size']} · {String(e['detail']?.['period'] ?? "")}
                </p>
                <p className="text-muted-foreground">
                  {e['delivery_status'] === "in_app_only"
                    ? "Recorded in-app"
                    : "Delivery channel not connected — recorded in-app only"}{" "}
                  · {String(e['detail']?.['explanation'] ?? "")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
