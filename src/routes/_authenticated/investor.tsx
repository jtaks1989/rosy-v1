import { createFileRoute } from "@tanstack/react-router";
import { useAccess } from "@/hooks/use-access";
import { useMyInvestments } from "@/hooks/use-metrics";
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
import { money, pct, prettyDate, NOT_AVAILABLE } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/investor")({
  head: () => ({
    meta: [
      { title: "Investor portal — Rosy AI" },
      {
        name: "description",
        content:
          "Committed and funded capital, distributions and indicative stake value based only on approved, published valuations.",
      },
      { property: "og:title", content: "Investor portal — Rosy AI" },
      { property: "og:description", content: "Capital, distributions and approved valuations only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Investor,
});

function Investor() {
  const { data: access } = useAccess();
  const allowed = access?.permissions.includes("view_investor_portal") ?? false;
  const holdings = useMyInvestments(allowed);

  if (access && !allowed) return <NoPermission what="the investor portal" />;

  const rows = holdings.data ?? [];
  const committed = rows.reduce((a, r) => a + Number(r["committed"] ?? 0), 0);
  const funded = rows.reduce((a, r) => a + Number(r["funded"] ?? 0), 0);
  const distributions = rows.reduce((a, r) => a + Number(r["distributions"] ?? 0), 0);
  const valued = rows.filter((r) => r["indicative_stake_value"] != null);
  const stakeValue = valued.reduce((a, r) => a + Number(r["indicative_stake_value"]), 0);

  return (
    <>
      <PageHeader
        title="Investor portal"
        intro="Your capital, your distributions and — only where a valuation has been approved and published — an indicative value of your stake. Nothing here is an offer, a promise or a realisable price."
        actions={<StatusChip tone="muted">Demo dataset</StatusChip>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Committed capital" value={money(committed)} />
        <KpiCard
          label="Funded capital"
          value={money(funded)}
          note={`${money(committed - funded)} still uncalled`}
        />
        <KpiCard
          label="Distributions received"
          value={money(distributions)}
          definition="Dividends plus return of capital recorded against your commitments."
        />
        <KpiCard
          label="Indicative stake value"
          value={valued.length ? money(stakeValue) : NOT_AVAILABLE}
          unavailableReason={
            valued.length
              ? undefined
              : "No approved and published valuation exists for these entities, so no value is shown"
          }
          definition="Latest approved equity value × recorded ownership. Indicative only."
        />
      </div>

      <Section
        title="Your holdings"
        description="One row per commitment. Where a valuation is pending, the value column says so instead of estimating."
      >
        {holdings.isLoading ? (
          <LoadingRows rows={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No holdings linked to your account"
            description="Your account is not linked to an investor record, or the linked investor has no commitments recorded."
          />
        ) : (
          <div className="space-y-4">
            {rows.map((r) => (
              <div key={String(r["commitment_id"])} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{String(r["entity_name"])}</p>
                    <p className="text-xs text-muted-foreground">
                      {String(r["investor_name"])} · {String(r["instrument_type"])}
                      {r["share_class"] ? ` · ${String(r["share_class"])}` : ""}
                    </p>
                  </div>
                  <StatusChip tone={r["valuation_status"] === "published" ? "positive" : "warning"}>
                    {r["valuation_status"] === "published"
                      ? `Valuation approved ${prettyDate(r["valuation_date"] as string)}`
                      : "Valuation pending"}
                  </StatusChip>
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
                  <div>
                    <dt className="text-xs text-muted-foreground">Committed</dt>
                    <dd className="num">{money(Number(r["committed"]))}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Funded</dt>
                    <dd className="num">{money(Number(r["funded"]))}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Uncalled</dt>
                    <dd className="num">{money(Number(r["unfunded"]))}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Ownership</dt>
                    <dd className="num">
                      {r["ownership_pct"] == null ? NOT_AVAILABLE : pct(Number(r["ownership_pct"]) * 100, 2)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Distributions</dt>
                    <dd className="num">
                      {money(Number(r["distributions"]))}
                      <span className="block text-xs text-muted-foreground">
                        {money(Number(r["distributions_dividend"]))} dividend ·{" "}
                        {money(Number(r["distributions_return_of_capital"]))} return of capital
                      </span>
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 rounded-md bg-surface p-3">
                  <p className="text-sm">
                    Indicative stake value:{" "}
                    <span className="num font-semibold">
                      {r["indicative_stake_value"] == null
                        ? NOT_AVAILABLE
                        : money(Number(r["indicative_stake_value"]))}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{String(r["stake_value_note"])}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <EvidenceFooter
          scope="Only investor records linked to your account"
          period="Latest approved and published valuation per legal entity"
          sources="Demo capital, contribution, distribution and valuation records"
          metric="Indicative stake value = approved equity value × recorded ownership share."
          limitations="Synthetic demo data. Draft or unapproved valuations are never used. Indicative values are not exit prices and carry no guarantee."
        />
      </Section>
    </>
  );
}
