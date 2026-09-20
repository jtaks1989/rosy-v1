import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-access";
import { useRenewalQueue } from "@/hooks/use-metrics";
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
import { count, prettyDate } from "@/lib/format";
import { AttentionPanel, type AttentionItem } from "@/components/rosy/attention";

export const Route = createFileRoute("/_authenticated/people")({
  head: () => ({
    meta: [
      { title: "People & renewals — Rosy AI" },
      {
        name: "description",
        content:
          "Document expiry reminders and renewal ownership, with sensitive identifiers masked and no unsupported penalty figures.",
      },
      { property: "og:title", content: "People & renewals — Rosy AI" },
      { property: "og:description", content: "Document expiry reminders and renewal ownership." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: People,
});

function People() {
  const { data: access } = useAccess();
  const allowed = access?.permissions.includes("view_people") ?? false;
  const canSeeDocuments = access?.permissions.includes("view_people_documents") ?? false;
  const queue = useRenewalQueue(90, allowed && canSeeDocuments);

  const staff = useQuery({
    queryKey: ["employees"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, display_name, role_title, location_id, status, joined_on")
        .order("display_name")
        .limit(100);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  if (access && !allowed) return <NoPermission what="people and document data" />;

  const rows = queue.data ?? [];
  const expired = rows.filter((r) => Number(r["days_to_expiry"]) < 0);
  const due30 = rows.filter((r) => Number(r["days_to_expiry"]) >= 0 && Number(r["days_to_expiry"]) <= 30);
  const due7 = due30.filter((r) => Number(r["days_to_expiry"]) <= 7);
  const unverified = rows.filter((r) => r["verification_status"] !== "verified");
  const unassigned = rows.filter((r) => !r["owner_name"] && Number(r["days_to_expiry"]) <= 30);
  const names = new Map((access?.locations ?? []).map((l) => [l.id, l.name]));

  const byVenue = new Map<string, number>();
  for (const r of [...expired, ...due30]) {
    const key = String(r["location_name"] ?? "Not assigned");
    byVenue.set(key, (byVenue.get(key) ?? 0) + 1);
  }
  const worstVenue = [...byVenue.entries()].sort((a, b) => b[1] - a[1])[0];

  const attention: AttentionItem[] = [];
  if (expired.length)
    attention.push({
      severity: "critical",
      headline: "Documents already expired",
      metric: count(expired.length),
      detail: `Oldest lapse: ${expired
        .map((r) => Number(r["days_to_expiry"]))
        .sort((a, b) => a - b)[0]! * -1} days ago. People with a lapsed document should not be rostered until it is renewed.`,
      to: "/actions",
      linkLabel: "Create actions",
    });
  if (due7.length)
    attention.push({
      severity: "critical",
      headline: "Expiring within 7 days",
      metric: count(due7.length),
      detail: "Renewals must start today to avoid a lapse this week.",
    });
  if (due30.length)
    attention.push({
      severity: "warning",
      headline: "Expiring within 30 days",
      metric: count(due30.length),
      detail: `${count(due30.length - due7.length)} of these fall between 8 and 30 days out — schedule appointments and typing centre visits now.`,
    });
  if (unassigned.length)
    attention.push({
      severity: "warning",
      headline: "No renewal owner",
      metric: count(unassigned.length),
      detail: "Documents due within 30 days with nobody named as responsible for the renewal.",
    });
  if (unverified.length)
    attention.push({
      severity: "watch",
      headline: "Unverified records",
      metric: count(unverified.length),
      detail: "Not yet checked by a manager, so the expiry date cannot be treated as evidence.",
    });
  if (worstVenue)
    attention.push({
      severity: "watch",
      headline: `${worstVenue[0]} carries the most risk`,
      metric: count(worstVenue[1]),
      detail: "Expired or soon-expiring documents concentrated at one venue. Consider a single renewal session there.",
    });

  return (
    <>
      <PageHeader
        title="People & renewals"
        intro="Reminders for documents that are about to expire, and who owns each renewal. Document numbers are masked, and no fine or penalty is calculated because that depends on rules this platform does not hold."
        actions={<StatusChip tone="warning">HR system not connected — demo adapter</StatusChip>}
      />

      {!canSeeDocuments ? (
        <AttentionPanel
          title="Document detail restricted"
          items={[
            {
              severity: "watch",
              headline: "Expiry detail is limited to HR",
              detail:
                "Your access covers people records but not document identifiers or expiry dates. Sign in with the HR demo account to see the renewal risk queue.",
            },
          ]}
          description="Access is enforced in the database, so this restriction cannot be bypassed from the browser."
        />
      ) : queue.isLoading ? null : (
        <AttentionPanel
          items={attention}
          description="Renewal risk for the people in your scope, ranked by how soon a document lapses."
          clearMessage="No document in your scope expires within 90 days."
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Already expired"
          value={count(expired.length)}
          direction={expired.length ? "down" : "flat"}
          changeLabel={expired.length ? "Action required" : undefined}
          unavailableReason={canSeeDocuments ? undefined : "Document detail is limited to HR access"}
        />
        <KpiCard
          label="Expiring within 30 days"
          value={count(due30.length)}
          note={due7.length ? `${count(due7.length)} within 7 days` : undefined}
          unavailableReason={canSeeDocuments ? undefined : "Document detail is limited to HR access"}
        />
        <KpiCard
          label="Not yet verified"
          value={count(unverified.length)}
          definition="A document is only treated as valid evidence once someone has verified it."
          unavailableReason={canSeeDocuments ? undefined : "Document detail is limited to HR access"}
        />
        <KpiCard label="People on record" value={count((staff.data ?? []).length)} />
      </div>

      <Section
        title="Renewal queue"
        description="Documents expiring within 90 days, soonest first. Identifiers are masked for everyone, including administrators."
      >
        {!canSeeDocuments ? (
          <EmptyState
            title="Renewal queue is limited to HR access"
            description="Document numbers and expiry dates are only released to accounts with HR document permission. Everything else on this page stays visible."
          />
        ) : queue.isLoading ? (
          <LoadingRows rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nothing due in the next 90 days"
            description="No document in your scope expires inside the window. Records with no expiry date recorded are not shown here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="py-2 pr-3">Person</th>
                  <th className="py-2 pr-3">Venue</th>
                  <th className="py-2 pr-3">Document</th>
                  <th className="py-2 pr-3">Number</th>
                  <th className="py-2 pr-3">Expires</th>
                  <th className="py-2 pr-3 text-right">Days left</th>
                  <th className="py-2 pr-3">Owner</th>
                  <th className="py-2">State</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const days = Number(r["days_to_expiry"]);
                  return (
                    <tr
                      key={String(r["document_id"])}
                      className={
                        days < 0
                          ? "border-b border-destructive/20 bg-destructive/[0.06]"
                          : days <= 30
                            ? "border-b border-warning/25 bg-warning/[0.08]"
                            : "border-b border-border/60"
                      }
                    >
                      <td className="py-2 pr-3">{String(r["employee_name"])}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {String(r["location_name"] ?? "Not assigned")}
                      </td>
                      <td className="py-2 pr-3 capitalize">{String(r["doc_type"]).replace(/_/g, " ")}</td>
                      <td className="num py-2 pr-3 text-muted-foreground">
                        {String(r["masked_number"] ?? "Masked")}
                      </td>
                      <td className="num py-2 pr-3">{prettyDate(r["expiry_date"] as string)}</td>
                      <td
                        className={
                          days < 0
                            ? "num py-2 pr-3 text-right font-semibold text-destructive"
                            : days <= 30
                              ? "num py-2 pr-3 text-right font-semibold text-warning-foreground"
                              : "num py-2 pr-3 text-right"
                        }
                      >
                        {days < 0 ? `${Math.abs(days)} overdue` : days}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {String(r["owner_name"] ?? "Unassigned")}
                      </td>
                      <td className="py-2">
                        {days < 0 ? (
                          <StatusChip tone="critical">Expired</StatusChip>
                        ) : days <= 30 ? (
                          <StatusChip tone="warning">Due soon</StatusChip>
                        ) : (
                          <StatusChip tone="neutral">Scheduled</StatusChip>
                        )}
                        {r["verification_status"] !== "verified" ? (
                          <span className="mt-1 block">
                            <StatusChip tone="muted">Unverified record</StatusChip>
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <EvidenceFooter
          scope="People records covered by your grants"
          period="Documents expiring within 90 days of today"
          sources="Demo HR adapter. Passport, visa and bank identifiers are stored masked and are never displayed in full."
          metric="Days left = expiry date − today, in Asia/Dubai."
          limitations="Synthetic demo data. Rosy AI does not calculate fines or penalties, does not file renewals, and cannot notify anyone until a messaging channel is connected."
        />
      </Section>

      <Section title="Team" description="People on record for the venues you can see.">
        {staff.isLoading ? (
          <LoadingRows />
        ) : (staff.data ?? []).length === 0 ? (
          <EmptyState title="No people records in scope" description="Your grants cover no employee records." />
        ) : (
          <ul className="divide-y divide-border text-sm">
            {(staff.data ?? []).map((e: any) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {e.display_name}
                  <span className="block text-xs text-muted-foreground">
                    {e.role_title ?? "Role not recorded"} ·{" "}
                    {names.get(e.location_id) ?? "Venue outside your labels"}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="num text-xs text-muted-foreground">
                    since {prettyDate(e.joined_on)}
                  </span>
                  <StatusChip tone={e.status === "active" ? "positive" : "muted"}>
                    {String(e.status).replace(/_/g, " ")}
                  </StatusChip>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Salary, payroll and full identifiers are deliberately absent from this platform. Rosy bot will
          refuse to answer questions about them.
        </p>
      </Section>
    </>
  );
}
