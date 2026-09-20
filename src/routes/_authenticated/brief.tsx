import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getBrief, type BriefChange } from "@/lib/brief.functions";
import { useAccess } from "@/hooks/use-access";
import { useFilters } from "@/lib/filters";
import {
  EmptyState,
  EvidenceFooter,
  KpiCard,
  LoadingRows,
  PageHeader,
  Section,
  StatusChip,
} from "@/components/rosy/primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/brief")({
  head: () => ({
    meta: [
      { title: "Your Rosy Brief — Rosy AI" },
      {
        name: "description",
        content:
          "A personalised daily briefing: what happened, what changed, what needs a decision today and what is coming this week — inside your own permissions.",
      },
      { property: "og:title", content: "Your Rosy Brief — Rosy AI" },
      {
        property: "og:description",
        content: "What happened, what changed, what needs a decision today, and who should act.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BriefPage,
});

const STATUS_LABEL: Record<string, string> = {
  operational: "Operational",
  estimated: "Estimated",
  finance_approved: "Finance-approved",
  unavailable: "Not available",
};

function ChangeCard({ c }: { c: BriefChange }) {
  const down = c.percent.trim().startsWith("-") || c.percent.trim().startsWith("−");
  return (
    <li className="lift rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{c.venue}</p>
          <p className="text-xs text-muted-foreground">{c.metric}</p>
        </div>
        <StatusChip tone={down ? "critical" : "positive"}>{c.percent}</StatusChip>
      </div>
      <p className="num mt-2 text-sm text-foreground">{c.absolute}</p>
      <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
        <div>
          <dt className="inline font-medium">Compared with: </dt>
          <dd className="inline">{c.comparison}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Evidence: </dt>
          <dd className="inline">{c.evidence}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Freshness: </dt>
          <dd className="inline">{c.freshness}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-warning-foreground">
        No cause established — this is a measured change only, not an explanation.
      </p>
    </li>
  );
}

function BriefPage() {
  const { data: access } = useAccess();
  const filters = useFilters();
  const qc = useQueryClient();
  const brief = useServerFn(getBrief);
  const [saved, setSaved] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["brief", filters.from, filters.to, filters.locations.join(","), access?.role],
    enabled: Boolean(access),
    queryFn: () =>
      brief({ data: { from: filters.from, to: filters.to, locations: filters.locationsParam } }),
  });

  const decisions = useQuery({
    queryKey: ["brief-decisions"],
    enabled: Boolean(access?.permissions.includes("view_alerts")),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rosy_actions")
        .select("id, title, why_it_matters, severity, status, owner_name, due_date, evidence")
        .not("status", "in", "(closed,completed)")
        .order("due_date", { ascending: true })
        .limit(6);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const alerts = useQuery({
    queryKey: ["brief-alerts"],
    enabled: Boolean(access?.permissions.includes("view_alerts")),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("id, title, detail, severity, status, owner_name, due_date, kind, source_freshness")
        .eq("status", "open")
        .order("severity", { ascending: true })
        .limit(6);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const snapshot = useMutation({
    mutationFn: () =>
      brief({ data: { from: filters.from, to: filters.to, locations: filters.locationsParam, save: true } }),
    onSuccess: () => {
      setSaved(new Date().toISOString().slice(0, 16).replace("T", " "));
      qc.invalidateQueries({ queryKey: ["brief-snapshots"] });
    },
  });

  const promote = useMutation({
    mutationFn: async (a: Record<string, any>) => {
      if (!access?.orgId) throw new Error("No workspace membership");
      const { error } = await supabase.from("rosy_actions").insert({
        org_id: access.orgId,
        title: a['title'],
        why_it_matters: a['detail'] ?? null,
        source_kind: "alert",
        source_ref: a['id'],
        severity: a['severity'] ?? "medium",
        evidence: {
          alert_kind: a['kind'],
          source_freshness: a['source_freshness'],
          captured_at: new Date().toISOString(),
          period: `${filters.from} → ${filters.to} (Asia/Dubai)`,
        },
        owner_name: a['owner_name'] ?? null,
        due_date: a['due_date'] ?? null,
        created_by: access.userId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brief-decisions"] }),
  });

  const b = q.data;

  return (
    <>
      <PageHeader
        title={b ? `Good day, ${b.greetingName}` : "Your Rosy Brief"}
        intro={
          b
            ? `${b.roleLabel}. ${b.scope} · ${b.period}. Figures are preliminary until finance approves the period.`
            : "Your personalised briefing: what happened, what changed, what needs a decision today and what is coming next."
        }
        actions={
          <>
            <StatusChip tone="warning">Preliminary — not finance-approved</StatusChip>
            <Button variant="outline" size="sm" onClick={() => snapshot.mutate()} disabled={snapshot.isPending}>
              {snapshot.isPending ? "Saving…" : "Save dated snapshot"}
            </Button>
          </>
        }
      />

      {saved ? (
        <p className="text-xs text-muted-foreground">
          Snapshot saved {saved} — it keeps exactly what was reported at that moment, including how complete the data was.
        </p>
      ) : null}

      <Section
        title="Performance snapshot"
        description="Only the measures your access allows, for the venues and period in view."
      >
        {q.isLoading ? (
          <LoadingRows rows={4} />
        ) : !b || b.metrics.length === 0 ? (
          <EmptyState
            title="No metrics available for your access"
            description="Your role does not include any of the measures in this briefing. Nothing is hidden behind the interface — the database refuses the read too."
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {b.metrics.map((m) => (
                <KpiCard
                  key={m.key}
                  label={m.label}
                  value={m.value}
                  {...(m.note ? { note: m.note } : {})}
                  definition={`${m.definition} · Status: ${STATUS_LABEL[m.status]}`}
                  {...(m.status === "unavailable" ? { unavailableReason: m.note ?? "Source not connected" } : {})}
                />
              ))}
            </div>
            <EvidenceFooter
              scope={b.scope}
              period={b.period}
              sources="Rosy AI metrics layer over the demo dataset — the same definitions the pages and Rosy bot use"
              metric="Shared metric registry (versioned). Hover a card's info icon for the exact definition."
              limitations={b.notes.join(" ")}
            />
          </>
        )}
      </Section>

      <Section
        title="What changed"
        description="The largest measured movements against a matched comparison period. A change is not a cause."
      >
        {q.isLoading ? (
          <LoadingRows rows={3} />
        ) : !b || b.changes.length === 0 ? (
          <EmptyState
            title="No comparable movement to report"
            description="Either the comparison period has no baseline for these venues, or your access does not include cross-venue sales."
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {b.changes.map((c) => (
              <ChangeCard key={`${c.venue}-${c.metric}`} c={c} />
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Decisions needed today"
        description="Prioritised by severity and urgency. No financial impact is estimated where the inputs do not support it."
        aside={
          <Button asChild variant="outline" size="sm">
            <Link to="/actions" search={(p) => p}>
              Open Actions &amp; Outcomes
            </Link>
          </Button>
        }
      >
        {!access?.permissions.includes("view_alerts") ? (
          <EmptyState
            title="Not part of your access"
            description="Alerts and tasks are not included in your role, so no decisions are listed here."
          />
        ) : decisions.isLoading ? (
          <LoadingRows rows={3} />
        ) : (
          <div className="space-y-3">
            {(decisions.data ?? []).map((a: Record<string, any>) => (
              <div key={a['id']} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{a['title']}</p>
                  <div className="flex gap-2">
                    <StatusChip tone={a['severity'] === "high" ? "critical" : "warning"}>
                      {a['severity']}
                    </StatusChip>
                    <StatusChip tone="neutral">{String(a['status']).replace(/_/g, " ")}</StatusChip>
                  </div>
                </div>
                {a['why_it_matters'] ? (
                  <p className="mt-1 text-xs text-muted-foreground">{a['why_it_matters']}</p>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  Owner: {a['owner_name'] ?? "unassigned"} · Due {a['due_date'] ?? "no date set"}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-2 px-0">
                  <Link to="/actions" search={(p) => p}>
                    View evidence, assign, snooze or resolve →
                  </Link>
                </Button>
              </div>
            ))}

            {(alerts.data ?? []).length ? (
              <div className="rounded-lg border border-dashed border-border p-4">
                <p className="eyebrow mb-2">Open alerts not yet turned into an action</p>
                <ul className="space-y-2">
                  {(alerts.data ?? []).map((a: Record<string, any>) => (
                    <li key={a['id']} className="flex flex-wrap items-start justify-between gap-2 text-xs">
                      <span>
                        <span className="font-medium text-foreground">{a['title']}</span>
                        <span className="block text-muted-foreground">{a['detail']}</span>
                        <span className="block text-muted-foreground">
                          Source freshness:{" "}
                          {a['source_freshness']
                            ? String(a['source_freshness']).slice(0, 16).replace("T", " ")
                            : "no successful refresh recorded — treat as stale"}
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={promote.isPending}
                        onClick={() => promote.mutate(a)}
                      >
                        Make it an action
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {(decisions.data ?? []).length === 0 && (alerts.data ?? []).length === 0 ? (
              <EmptyState
                title="Nothing needs a decision right now"
                description="No open alert or unresolved action is in your scope for this period."
              />
            ) : null}
          </div>
        )}
      </Section>

      <Section
        title="Today and the week ahead"
        description="Confirmed bookings and known constraints only. Predicted demand is not shown here and is never mixed with actuals."
      >
        {q.isLoading ? (
          <LoadingRows rows={3} />
        ) : !b || b.ahead.length === 0 ? (
          <EmptyState
            title="Nothing scheduled in your scope"
            description="Reservation and stock sources are demo adapters, so the week ahead only shows what those synthetic records contain."
          />
        ) : (
          <ul className="divide-y divide-border">
            {b.ahead.map((a) => (
              <li key={`${a.label}-${a.value}`} className="flex flex-wrap items-start justify-between gap-2 py-3">
                <span className="text-sm text-foreground">{a.label}</span>
                <span className="num text-sm text-foreground">{a.value}</span>
                <span className="w-full text-xs text-muted-foreground">{a.note}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
