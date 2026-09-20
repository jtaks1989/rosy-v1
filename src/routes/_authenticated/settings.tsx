import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccess, useSetDemoRole } from "@/hooks/use-access";
import { ROLE_PRESETS } from "@/lib/access.functions";
import {
  EmptyState,
  EvidenceFooter,
  LoadingRows,
  PageHeader,
  Section,
  StatusChip,
} from "@/components/rosy/primitives";
import { prettyDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings & access — Rosy AI" },
      {
        name: "description",
        content:
          "Your role, your scope, the shared metric definitions and the audit trail of who looked at what.",
      },
      { property: "og:title", content: "Settings & access — Rosy AI" },
      { property: "og:description", content: "Role, scope, metric definitions and audit trail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { data: access } = useAccess();
  const setRole = useSetDemoRole();

  const metrics = useQuery({
    queryKey: ["metric_definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metric_definitions")
        .select("key, label, formula, version, notes")
        .order("label");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const audit = useQuery({
    queryKey: ["audit_events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_events")
        .select("id, action, target, detail, created_at")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  return (
    <>
      <PageHeader
        title="Settings & access"
        intro="What you can see, why you can see it, and how each number is defined. Access is enforced in the database — this page only explains it."
      />

      <Section title="Your access" description="Granted by an administrator, not chosen by you.">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Signed in as</dt>
            <dd>{access?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Organisation</dt>
            <dd>
              {access?.orgName ?? "—"}{" "}
              {access?.isDemo ? <StatusChip tone="muted">Demo workspace</StatusChip> : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Role</dt>
            <dd>{ROLE_PRESETS.find((r) => r.value === access?.role)?.label ?? "No role assigned"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Scope</dt>
            <dd>{access?.scopeSummary ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Venues you can see</dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              {(access?.locations ?? []).length === 0 ? (
                <span className="text-muted-foreground">None</span>
              ) : (
                (access?.locations ?? []).map((l) => (
                  <StatusChip key={l.id} tone="neutral">
                    {l.name}
                  </StatusChip>
                ))
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Permissions</dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              {(access?.permissions ?? []).map((p) => (
                <StatusChip key={p} tone="muted">
                  {p.replace(/_/g, " ")}
                </StatusChip>
              ))}
            </dd>
          </div>
        </dl>
      </Section>

      {access?.isDemo ? (
        <Section
          title="Role preview (demo workspace only)"
          description="Switching role here changes your real grants in the demo workspace, so anything denied stays denied. This control does not exist outside a demo organisation."
        >
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="rounded border border-input bg-background px-3 py-2 text-sm"
              value={access?.role ?? "leadership"}
              disabled={setRole.isPending}
              onChange={(e) => setRole.mutate(e.target.value)}
              aria-label="Demo role"
            >
              {ROLE_PRESETS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {setRole.isPending ? (
              <span className="text-xs text-muted-foreground">Applying new grants…</span>
            ) : null}
          </div>
        </Section>
      ) : null}

      <Section
        title="Metric definitions"
        description="One shared definition per metric. Dashboards and Rosy bot both read from this list, so the same question cannot produce two different numbers."
      >
        {metrics.isLoading ? (
          <LoadingRows rows={5} />
        ) : (metrics.data ?? []).length === 0 ? (
          <EmptyState title="No metric definitions recorded" description="The metric registry is empty." />
        ) : (
          <ul className="divide-y divide-border text-sm">
            {(metrics.data ?? []).map((m: any) => (
              <li key={m.key} className="py-3">
                <p className="font-medium text-foreground">
                  {m.label} <span className="text-xs text-muted-foreground">v{m.version}</span>
                </p>
                <p className="num mt-1 text-xs text-muted-foreground">{m.formula}</p>
                {m.notes ? <p className="mt-1 text-xs text-muted-foreground">{m.notes}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Recent activity on your account" description="Access changes and sensitive reads are recorded.">
        {audit.isLoading ? (
          <LoadingRows />
        ) : (audit.data ?? []).length === 0 ? (
          <EmptyState title="No recorded activity" description="Nothing has been logged against your account yet." />
        ) : (
          <ul className="divide-y divide-border text-sm">
            {(audit.data ?? []).map((a: any) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {String(a.action).replace(/_/g, " ")}
                  {a.target ? <span className="text-muted-foreground"> · {a.target}</span> : null}
                </span>
                <span className="num text-xs text-muted-foreground">
                  {prettyDate(String(a.created_at).slice(0, 10))}
                </span>
              </li>
            ))}
          </ul>
        )}
        <EvidenceFooter
          scope="Your own account activity"
          period="Most recent 25 events"
          sources="Platform audit log"
          limitations="Synthetic demo workspace. Audit records are append-only and cannot be edited from the interface."
        />
      </Section>
    </>
  );
}
