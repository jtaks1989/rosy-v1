import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-access";
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
import { count, prettyDate, freshness } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts & tasks — Rosy AI" },
      {
        name: "description",
        content:
          "Open alerts with the evidence behind them, the owner, and the freshness of the source that raised them.",
      },
      { property: "og:title", content: "Alerts & tasks — Rosy AI" },
      { property: "og:description", content: "Open alerts with evidence, owner and source freshness." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Alerts,
});

function Alerts() {
  const { data: access } = useAccess();
  const allowed = access?.permissions.includes("view_alerts") ?? false;

  const alerts = useQuery({
    queryKey: ["alerts"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select(
          "id, kind, severity, title, detail, evidence, status, owner_name, due_date, source_freshness, location_id, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  if (access && !allowed) return <NoPermission what="alerts" />;

  const rows = alerts.data ?? [];
  const open = rows.filter((r: any) => r.status === "open");
  const high = open.filter((r: any) => r.severity === "high");
  const names = new Map((access?.locations ?? []).map((l) => [l.id, l.name]));

  return (
    <>
      <PageHeader
        title="Alerts & tasks"
        intro="Every alert carries the figures that triggered it and how fresh the source was. Nothing is raised on data the platform cannot evidence."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Open alerts" value={count(open.length)} />
        <KpiCard label="High severity" value={count(high.length)} />
        <KpiCard label="Total recorded" value={count(rows.length)} />
      </div>

      <Section title="Alerts" description="Most recent first, including those already acknowledged or resolved.">
        {alerts.isLoading ? (
          <LoadingRows rows={5} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No alerts"
            description="Nothing has been raised for the venues and entities you can see."
          />
        ) : (
          <ul className="space-y-3">
            {rows.map((a: any) => (
              <li key={a.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{a.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {String(a.kind).replace(/_/g, " ")} ·{" "}
                      {names.get(a.location_id) ?? "Group level"} · raised{" "}
                      {prettyDate(String(a.created_at).slice(0, 10))}
                      {a.due_date ? ` · due ${prettyDate(a.due_date)}` : ""}
                      {a.owner_name ? ` · owner ${a.owner_name}` : " · unassigned"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusChip
                      tone={a.severity === "high" ? "critical" : a.severity === "low" ? "muted" : "warning"}
                    >
                      {a.severity} severity
                    </StatusChip>
                    <StatusChip tone={a.status === "open" ? "warning" : "positive"}>
                      {String(a.status).replace(/_/g, " ")}
                    </StatusChip>
                  </div>
                </div>
                {a.detail ? <p className="mt-2 text-sm text-foreground">{a.detail}</p> : null}
                {a.evidence && Object.keys(a.evidence).length ? (
                  <dl className="mt-3 grid gap-x-6 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground sm:grid-cols-2">
                    {Object.entries(a.evidence as Record<string, unknown>).map(([k, v]) => (
                      <div key={k}>
                        <dt className="inline font-medium">{k.replace(/_/g, " ")}: </dt>
                        <dd className="num inline">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  Source freshness:{" "}
                  {a.source_freshness ? freshness(a.source_freshness).label : "not recorded"}
                </p>
              </li>
            ))}
          </ul>
        )}
        <EvidenceFooter
          scope="Alerts for venues and entities covered by your grants"
          period="All recorded alerts, newest first"
          sources="Demo adapters and platform rules"
          metric="Alerts are raised from the same metric definitions used across the platform."
          limitations="Synthetic demo data. Rosy AI does not notify anyone: no email, SMS or chat channel is connected, so owners must be told through your usual channels."
        />
      </Section>
    </>
  );
}
