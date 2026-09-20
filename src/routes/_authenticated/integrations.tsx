import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-access";
import {
  EmptyState,
  EvidenceFooter,
  KpiCard,
  LoadingRows,
  PageHeader,
  Section,
  StatusChip,
} from "@/components/rosy/primitives";
import { count, prettyDate, freshness } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations & data quality — Rosy AI" },
      {
        name: "description",
        content:
          "Exactly what is connected, what is running on a demo adapter, and precisely what is needed to bring each source live.",
      },
      { property: "og:title", content: "Integrations & data quality — Rosy AI" },
      { property: "og:description", content: "What is connected, what is demo, and what is needed to go live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Integrations,
});

const REQUIREMENTS: Record<string, { role: string; needs: string[] }> = {
  foodics: {
    role: "Point of sale — authoritative source for dine-in and pickup sales, items and payments.",
    needs: [
      "Read-only API credentials for each branch, issued by the Foodics account owner",
      "The branch identifier for every venue, so sales land against the right restaurant",
      "Confirmation of the business-day cutoff configured per branch",
    ],
  },
  grubtech: {
    role: "Delivery aggregation — delivery orders across platforms, reconciled against the point of sale.",
    needs: [
      "Read-only API credentials and the store identifiers for each venue",
      "Confirmation of which delivery platforms are routed through it",
      "The earliest date history is available from, so coverage can be labelled honestly",
    ],
  },
  supy: {
    role: "Inventory and procurement — becomes the source of truth for stock, recipes and waste once connected.",
    needs: [
      "Read-only API access and the outlet identifiers per venue",
      "Recipe and ingredient cost export permission, including effective dates",
      "Agreement that stock counts, not estimates, drive reorder alerts",
    ],
  },
  eat_app: {
    role: "Reservations — reservations, covers, no-shows and guest identity where the guest consents.",
    needs: [
      "Read-only API credentials per venue",
      "Guest data handling confirmation, so identifiable guests can be matched lawfully",
      "The reservation-to-order matching rule you want applied",
    ],
  },
  hr_system: {
    role: "People and documents — employees, document expiry dates and renewal ownership.",
    needs: [
      "Read-only export or API access for employee and document records",
      "Confirmation that identifiers arrive masked, or permission for Rosy AI to mask on ingest",
      "The renewal reminder thresholds and the named owner per document type",
    ],
  },
  accounting: {
    role: "Finance — reconciliation of revenue, tax and payouts, and period close status.",
    needs: [
      "Read-only access to the ledger or a trial-balance export",
      "The chart-of-accounts mapping for revenue, discounts, tax and service charges",
      "Who confirms period close, and on what day",
    ],
  },
};

function Integrations() {
  const { data: access } = useAccess();

  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select(
          "id, provider, location_id, mode, status, credentials_saved, connection_verified, data_reconciled, capability_notes, dependency_note, historical_from, last_success_at, next_attempt_at, row_count, failure_reason",
        )
        .order("provider");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const issues = useQuery({
    queryKey: ["data_quality_issues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_quality_issues")
        .select("id, kind, detail, severity, status, location_id, created_at")
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const rows = integrations.data ?? [];
  const names = new Map((access?.locations ?? []).map((l) => [l.id, l.name]));
  const live = rows.filter((r: any) => r.mode === "live" && r.connection_verified);
  const providers = Array.from(new Set(rows.map((r: any) => String(r.provider))));

  return (
    <>
      <PageHeader
        title="Integrations & data quality"
        intro="Nothing on this page is guesswork about connection state. A source is only described as connected when credentials are saved, the connection has been verified, and data has been reconciled."
        actions={<StatusChip tone={live.length ? "positive" : "warning"}>
          {live.length ? `${live.length} verified live connection(s)` : "No live connection yet"}
        </StatusChip>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Configured sources" value={count(providers.length)} />
        <KpiCard label="Verified live" value={count(live.length)} />
        <KpiCard label="Open data-quality issues" value={count((issues.data ?? []).filter((i: any) => i.status === "open").length)} />
      </div>

      <Section
        title="Connection state"
        description="Three separate checks: credentials saved, connection verified, data reconciled. All three must pass before a figure is treated as live."
      >
        {integrations.isLoading ? (
          <LoadingRows rows={5} />
        ) : rows.length === 0 ? (
          <EmptyState title="No sources configured" description="No integration records exist yet." />
        ) : (
          <div className="space-y-3">
            {rows.map((r: any) => (
              <div key={r.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium capitalize text-foreground">
                      {String(r.provider).replace(/_/g, " ")}
                      {r.location_id ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {names.get(r.location_id) ?? "venue outside your labels"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground"> · group level</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.capability_notes ?? REQUIREMENTS[String(r.provider)]?.role ?? "Role not recorded"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusChip tone={r.mode === "live" ? "neutral" : "muted"}>
                      {r.mode === "live" ? "Live mode" : "Demo adapter"}
                    </StatusChip>
                    <StatusChip
                      tone={
                        r.status === "connected" ? "positive" : r.status === "failing" ? "critical" : "warning"
                      }
                    >
                      {String(r.status).replace(/_/g, " ")}
                    </StatusChip>
                  </div>
                </div>

                <ul className="mt-3 flex flex-wrap gap-2">
                  <StatusChip tone={r.credentials_saved ? "positive" : "muted"}>
                    {r.credentials_saved ? "Credentials saved" : "Credentials missing"}
                  </StatusChip>
                  <StatusChip tone={r.connection_verified ? "positive" : "muted"}>
                    {r.connection_verified ? "Connection verified" : "Not verified"}
                  </StatusChip>
                  <StatusChip tone={r.data_reconciled ? "positive" : "muted"}>
                    {r.data_reconciled ? "Data reconciled" : "Not reconciled"}
                  </StatusChip>
                </ul>

                <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <div>
                    <dt className="inline font-medium">Last successful sync: </dt>
                    <dd className="inline">
                      {r.last_success_at ? freshness(r.last_success_at).label : "never"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Rows ingested: </dt>
                    <dd className="num inline">{count(Number(r.row_count ?? 0))}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">History available from: </dt>
                    <dd className="inline">
                      {r.historical_from ? prettyDate(r.historical_from) : "not stated"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Next attempt: </dt>
                    <dd className="inline">
                      {r.next_attempt_at ? prettyDate(String(r.next_attempt_at).slice(0, 10)) : "not scheduled"}
                    </dd>
                  </div>
                  {r.failure_reason ? (
                    <div className="sm:col-span-2 text-destructive">
                      <dt className="inline font-medium">Last failure: </dt>
                      <dd className="inline">{r.failure_reason}</dd>
                    </div>
                  ) : null}
                  {r.dependency_note ? (
                    <div className="sm:col-span-2">
                      <dt className="inline font-medium">Dependency: </dt>
                      <dd className="inline">{r.dependency_note}</dd>
                    </div>
                  ) : null}
                </dl>

                {REQUIREMENTS[String(r.provider)] ? (
                  <div className="mt-3 rounded-md bg-surface p-3">
                    <p className="text-xs font-medium text-foreground">To connect live data we need:</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                      {REQUIREMENTS[String(r.provider)]!.needs.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
        <EvidenceFooter
          scope="All sources configured for your organisation"
          period="Current connection state"
          sources="Platform integration records"
          metric="Connected = credentials saved AND connection verified AND data reconciled."
          limitations="Every source is currently a read-only demo adapter. No live credentials are held, so no figure in this platform is reconciled to a provider."
        />
      </Section>

      <Section
        title="Data quality"
        description="Known gaps, duplicates and mismatches, kept visible rather than silently corrected."
      >
        {issues.isLoading ? (
          <LoadingRows />
        ) : (issues.data ?? []).length === 0 ? (
          <EmptyState title="No recorded issues" description="No data-quality issues are currently open." />
        ) : (
          <ul className="divide-y divide-border text-sm">
            {(issues.data ?? []).map((i: any) => (
              <li key={i.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <span>
                  <span className="capitalize">{String(i.kind).replace(/_/g, " ")}</span>
                  <span className="block text-xs text-muted-foreground">
                    {i.detail} · {names.get(i.location_id) ?? "group level"} ·{" "}
                    {prettyDate(String(i.created_at).slice(0, 10))}
                  </span>
                </span>
                <span className="flex gap-2">
                  <StatusChip tone={i.severity === "high" ? "critical" : "warning"}>{i.severity}</StatusChip>
                  <StatusChip tone={i.status === "open" ? "warning" : "positive"}>{i.status}</StatusChip>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
