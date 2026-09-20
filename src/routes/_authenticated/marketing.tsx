import { createFileRoute } from "@tanstack/react-router";
import { useAccess } from "@/hooks/use-access";
import { useFilters, scopeLabel } from "@/lib/filters";
import { useGuestCohorts, useDemandHeatmap, useChannelMix, useMenuPerformance, first } from "@/hooks/use-metrics";
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
import { money, count, pct, NOT_AVAILABLE } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing insights — Rosy AI" },
      {
        name: "description",
        content:
          "Quiet periods, repeat-guest behaviour and channel demand, with the campaign tooling limits stated up front.",
      },
      { property: "og:title", content: "Marketing insights — Rosy AI" },
      { property: "og:description", content: "Quiet periods, repeat guests and channel demand." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Marketing,
});

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Marketing() {
  const { data: access } = useAccess();
  const f = useFilters();
  const allowed = access?.permissions.includes("view_marketing") ?? false;

  const cohorts = useGuestCohorts(f, allowed && (access?.permissions.includes("view_guests") ?? false));
  const heat = useDemandHeatmap(f, allowed);
  const mix = useChannelMix(f, allowed);
  const menu = useMenuPerformance(f, allowed && (access?.permissions.includes("view_menu") ?? false));

  if (access && !allowed) return <NoPermission what="marketing insights" />;

  const g = first(cohorts.data);
  const names = new Map((access?.locations ?? []).map((l) => [l.id, l.name]));
  const slots = [...(heat.data ?? [])].sort(
    (a, b) => Number(a["seated_covers"]) - Number(b["seated_covers"]),
  );
  const quiet = slots.slice(0, 6);
  const busy = [...slots].reverse().slice(0, 6);
  const topItems = (menu.data ?? []).slice(0, 5);

  return (
    <>
      <PageHeader
        title="Marketing insights"
        intro="Where demand is thin, who comes back, and what sells. Rosy AI can show the opportunity — it cannot send a campaign, and does not claim any message was delivered."
        actions={<StatusChip tone="warning">No marketing channel connected</StatusChip>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Repeat guest rate"
          value={g?.["repeat_rate"] == null ? NOT_AVAILABLE : pct(Number(g["repeat_rate"]))}
          unavailableReason={
            access?.permissions.includes("view_guests")
              ? g?.["repeat_rate"] == null
                ? "No identifiable guests in this scope"
                : undefined
              : "Guest data is outside your access"
          }
          definition="Identifiable guests with more than one reservation."
        />
        <KpiCard
          label="Identifiable reservations"
          value={
            g?.["identification_coverage_pct"] == null
              ? NOT_AVAILABLE
              : pct(Number(g["identification_coverage_pct"]))
          }
          definition="Share of reservations with a linked guest record. Everything else is anonymous and cannot be targeted."
        />
        <KpiCard label="No-shows" value={count(Number(g?.["no_shows"] ?? 0))} />
        <KpiCard
          label="Delivery share of sales"
          value={(() => {
            const total = (mix.data ?? []).reduce((a, r) => a + Number(r["net_sales"] ?? 0), 0);
            const del = (mix.data ?? [])
              .filter((r) => String(r["fulfilment_type"]).includes("delivery"))
              .reduce((a, r) => a + Number(r["net_sales"] ?? 0), 0);
            return total ? pct((del / total) * 100) : NOT_AVAILABLE;
          })()}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Quietest hours" description="The thinnest seated demand in the period — where an offer has room to work.">
          {heat.isLoading ? (
            <LoadingRows rows={4} />
          ) : quiet.length === 0 ? (
            <EmptyState
              title="No reservation pattern available"
              description="Not enough recorded reservations in this scope to identify quiet periods."
            />
          ) : (
            <ul className="divide-y divide-border text-sm">
              {quiet.map((r) => (
                <li key={`${r["weekday"]}-${r["hour"]}`} className="flex justify-between py-2">
                  <span>
                    {DAYS[Number(r["weekday"])]} · {String(r["hour"]).padStart(2, "0")}:00
                  </span>
                  <span className="num text-muted-foreground">
                    {count(Number(r["seated_covers"]))} covers · {count(Number(r["reservations"]))} bookings
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Busiest hours" description="Protect these — discounting into a full room costs money.">
          {heat.isLoading ? (
            <LoadingRows rows={4} />
          ) : (
            <ul className="divide-y divide-border text-sm">
              {busy.map((r) => (
                <li key={`${r["weekday"]}-${r["hour"]}`} className="flex justify-between py-2">
                  <span>
                    {DAYS[Number(r["weekday"])]} · {String(r["hour"]).padStart(2, "0")}:00
                  </span>
                  <span className="num text-muted-foreground">
                    {count(Number(r["seated_covers"]))} covers
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section
        title="What to promote"
        description="Highest net revenue items in scope. Margin is shown only where a recipe cost exists."
      >
        {!access?.permissions.includes("view_menu") ? (
          <NoPermission what="menu profitability" />
        ) : menu.isLoading ? (
          <LoadingRows />
        ) : (
          <ul className="divide-y divide-border text-sm">
            {topItems.map((r) => (
              <li key={String(r["product_id"])} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {String(r["item_name"])}
                  <span className="block text-xs text-muted-foreground">{String(r["location_name"])}</span>
                </span>
                <span className="num text-muted-foreground">
                  {money(Number(r["net_revenue"]))} ·{" "}
                  {r["margin_available"] ? `${pct(Number(r["contribution_pct"]))} contribution` : "margin unknown"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <EvidenceFooter
          scope={scopeLabel(f, names)}
          period={`${f.from} → ${f.to}`}
          sources="Demo reservation, POS and delivery adapters"
          metric="Quiet and busy periods rank seated covers by Dubai weekday and hour."
          limitations="Synthetic demo data. No email, SMS or social channel is connected, so campaign performance and message delivery cannot be reported. Guests who are not identifiable cannot be reached."
        />
      </Section>
    </>
  );
}
