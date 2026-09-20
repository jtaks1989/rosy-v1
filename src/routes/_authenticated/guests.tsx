import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-access";
import { useFilters, scopeLabel } from "@/lib/filters";
import { useGuestCohorts, useDemandHeatmap, first } from "@/hooks/use-metrics";
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
import { count, pct, prettyDate, NOT_AVAILABLE } from "@/lib/format";
import { AttentionPanel, type AttentionItem } from "@/components/rosy/attention";

export const Route = createFileRoute("/_authenticated/guests")({
  head: () => ({
    meta: [
      { title: "Guests & reservations — Rosy AI" },
      {
        name: "description",
        content:
          "Reservations, covers, no-shows and repeat guests — counted separately and only where guests are identifiable.",
      },
      { property: "og:title", content: "Guests & reservations — Rosy AI" },
      { property: "og:description", content: "Reservations, covers, no-shows and repeat guests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Guests,
});

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Guests() {
  const { data: access } = useAccess();
  const f = useFilters();
  const allowed = access?.permissions.includes("view_guests") ?? false;
  const cohorts = useGuestCohorts(f, allowed);
  const heat = useDemandHeatmap(f, allowed);

  const reviews = useQuery({
    queryKey: ["guest_reviews", f.from, f.to, f.locations.join(",")],
    enabled: allowed,
    queryFn: async () => {
      let q = supabase
        .from("guest_reviews")
        .select(
          "id, review_date, location_id, source, source_label, author_alias, rating, rating_scale, title, body, sentiment, topics, is_complaint, status, responded_at, response_note",
        )
        .gte("review_date", f.from)
        .lte("review_date", f.to)
        .order("review_date", { ascending: false })
        .limit(100);
      if (f.locations.length) q = q.in("location_id", f.locations);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const upcoming = useQuery({
    queryKey: ["reservations", f.from, f.to, f.locations.join(",")],
    enabled: allowed,
    queryFn: async () => {
      let q = supabase
        .from("reservations")
        .select(
          "id, business_date, scheduled_at, location_id, status, expected_covers, seated_covers, party_size, source, match_confidence, guest_id",
        )
        .gte("business_date", f.from)
        .lte("business_date", f.to)
        .order("scheduled_at", { ascending: false })
        .limit(40);
      if (f.locations.length) q = q.in("location_id", f.locations);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  if (access && !allowed) return <NoPermission what="guest and reservation data" />;

  const g = first(cohorts.data);
  const names = new Map((access?.locations ?? []).map((l) => [l.id, l.name]));
  const maxCovers = Math.max(1, ...(heat.data ?? []).map((r) => Number(r["seated_covers"] ?? 0)));
  const hours = Array.from(new Set((heat.data ?? []).map((r) => Number(r["hour"])))).sort((a, b) => a - b);

  const revRows = (reviews.data ?? []) as any[];
  const rated = revRows.filter((r) => r.rating != null);
  const avgRating = rated.length
    ? rated.reduce((s, r) => s + Number(r.rating), 0) / rated.length
    : null;
  const complaints = revRows.filter((r) => r.is_complaint);
  const openComplaints = complaints.filter((r) => r.status !== "resolved");
  const respondedShare = revRows.length
    ? (revRows.filter((r) => r.responded_at).length / revRows.length) * 100
    : null;
  const topicCounts = new Map<string, number>();
  for (const r of complaints)
    for (const t of (r.topics ?? []) as string[]) topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
  const topTopics = [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const sourceLabel = (s: string) =>
    s === "google" ? "Google" : s === "tripadvisor" ? "Tripadvisor" : s;
  const prettyTopic = (t: string) => t.replace(/_/g, " ");

  const lowRated = rated.filter((r) => Number(r.rating) <= 2);
  const unanswered = complaints.filter((r) => !r.responded_at);
  const noShowRate = g?.["no_show_rate"] == null ? null : Number(g["no_show_rate"]);
  const coverage = g?.["identification_coverage_pct"] == null ? null : Number(g["identification_coverage_pct"]);

  const attention: AttentionItem[] = [];
  if (openComplaints.length)
    attention.push({
      severity: "critical",
      headline: "Open complaints",
      metric: count(openComplaints.length),
      detail: "Guest complaints in this period with no resolution recorded yet.",
    });
  if (unanswered.length)
    attention.push({
      severity: "warning",
      headline: "Complaints without a reply",
      metric: count(unanswered.length),
      detail: "Public reviews raising an issue where nobody has responded.",
    });
  if (lowRated.length)
    attention.push({
      severity: "warning",
      headline: "One and two star reviews",
      metric: count(lowRated.length),
      detail: `${topTopics.length ? `Most raised: ${prettyTopic(topTopics[0]![0])}.` : ""} Low ratings drag the venue average down fastest.`,
    });
  if (noShowRate != null && noShowRate > 8)
    attention.push({
      severity: noShowRate > 12 ? "critical" : "warning",
      headline: "No-show rate above target",
      metric: pct(noShowRate),
      detail: "Above the 8% working threshold for the period. Consider confirmation messages or holding deposits.",
    });
  if (coverage != null && coverage < 60)
    attention.push({
      severity: "watch",
      headline: "Guests often unidentifiable",
      metric: pct(coverage),
      detail: "Repeat-guest measures only cover this share of reservations, so loyalty numbers understate reality.",
    });

  return (
    <>
      <PageHeader
        title="Guests & reservations"
        intro="Reservations, covers and orders are three different things here and are never blended. Guest-level insight is limited to guests the source can actually identify."
        actions={<StatusChip tone="warning">Reservation system not connected — demo adapter</StatusChip>}
      />

      {cohorts.isLoading || reviews.isLoading ? null : (
        <AttentionPanel
          items={attention}
          description="Guest experience risks for the venues and period you have selected."
          clearMessage="No complaint, low rating or no-show pattern needs attention in this period."
        />
      )}

      {cohorts.isLoading ? (
        <LoadingRows rows={2} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Reservations" value={count(Number(g?.["reservations"] ?? 0))} />
          <KpiCard
            label="Seated covers"
            value={count(Number(g?.["seated_covers"] ?? 0))}
            note={`${count(Number(g?.["expected_covers"] ?? 0))} expected`}
            definition="Covers actually seated, not party size booked."
          />
          <KpiCard
            label="No-show rate"
            value={g?.["no_show_rate"] == null ? NOT_AVAILABLE : pct(Number(g["no_show_rate"]))}
            unavailableReason={
              g?.["no_show_rate"] == null ? "No seated or no-show reservations to measure" : undefined
            }
            note={`${count(Number(g?.["no_shows"] ?? 0))} no-shows · ${count(
              Number(g?.["cancellations"] ?? 0),
            )} cancellations`}
            definition="No-shows ÷ (seated + no-show) reservations. Cancellations are excluded from the denominator."
          />
          <KpiCard
            label="Repeat guest rate"
            value={g?.["repeat_rate"] == null ? NOT_AVAILABLE : pct(Number(g["repeat_rate"]))}
            note={
              g?.["identification_coverage_pct"] == null
                ? "No identifiable guests"
                : `${pct(Number(g["identification_coverage_pct"]))} of reservations identifiable`
            }
            definition="Guests with more than one reservation, among identifiable guests only. Anonymous walk-ins cannot be counted."
          />
        </div>
      )}

      <Section
        title="Demand by day and hour"
        description="Seated covers by Dubai local hour. Darker means busier."
      >
        {heat.isLoading ? (
          <LoadingRows rows={4} />
        ) : (heat.data ?? []).length === 0 ? (
          <EmptyState
            title="No reservations recorded"
            description="Nothing to shape a demand pattern from in this period and scope."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left font-medium text-muted-foreground">Day</th>
                  {hours.map((h) => (
                    <th key={h} className="num px-2 py-1 font-medium text-muted-foreground">
                      {String(h).padStart(2, "0")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((d, i) => (
                  <tr key={d}>
                    <td className="px-2 py-1 whitespace-nowrap text-muted-foreground">{d}</td>
                    {hours.map((h) => {
                      const cell = (heat.data ?? []).find(
                        (r) => Number(r["weekday"]) === i && Number(r["hour"]) === h,
                      );
                      const covers = Number(cell?.["seated_covers"] ?? 0);
                      return (
                        <td key={h} className="p-0.5">
                          <div
                            title={`${d} ${String(h).padStart(2, "0")}:00 — ${covers} covers`}
                            className="num flex h-7 w-9 items-center justify-center rounded text-[10px]"
                            style={{
                              backgroundColor: covers
                                ? `color-mix(in oklab, var(--color-primary) ${Math.round(
                                    (covers / maxCovers) * 85,
                                  )}%, var(--color-surface))`
                                : "var(--color-muted)",
                              color: covers / maxCovers > 0.55 ? "var(--color-primary-foreground)" : undefined,
                            }}
                          >
                            {covers || ""}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <EvidenceFooter
          scope={scopeLabel(f, names)}
          period={`${f.from} → ${f.to}`}
          sources="Demo reservation adapter"
          metric="Seated covers grouped by Dubai weekday and local hour of the scheduled time."
          limitations="Synthetic demo data. Walk-ins without a reservation record do not appear."
        />
      </Section>

      <Section
        title="Complaints & reviews"
        description="Public reviews and guest complaints for the selected venues and period. Sources will be Google and Tripadvisor once those accounts are connected."
        aside={<StatusChip tone="warning">Google & Tripadvisor not connected — demo adapter</StatusChip>}
      >
        {reviews.isLoading ? (
          <LoadingRows rows={3} />
        ) : revRows.length === 0 ? (
          <EmptyState
            title="No reviews in this period"
            description="Nothing recorded for this scope. Connect Google and Tripadvisor to collect reviews automatically."
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Average rating"
                value={avgRating == null ? NOT_AVAILABLE : `${avgRating.toFixed(1)} / 5`}
                unavailableReason={avgRating == null ? "No rated reviews in this period" : undefined}
                note={`${count(rated.length)} rated of ${count(revRows.length)} reviews`}
                definition="Mean of the star ratings on reviews collected in this period. Unrated reviews are excluded."
              />
              <KpiCard label="Reviews collected" value={count(revRows.length)} />
              <KpiCard
                label="Complaints"
                value={count(complaints.length)}
                note={`${count(openComplaints.length)} still open`}
                definition="Reviews flagged as a complaint by the source adapter, including mixed reviews raising an issue."
              />
              <KpiCard
                label="Responded"
                value={respondedShare == null ? NOT_AVAILABLE : pct(respondedShare)}
                note="Share of reviews with a recorded reply"
                definition="Reviews with a response recorded ÷ all reviews collected in this period."
              />
            </div>

            {topTopics.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs tracking-wide text-muted-foreground uppercase">
                  Most raised issues
                </span>
                {topTopics.map(([t, n]) => (
                  <StatusChip key={t} tone="muted">
                    {prettyTopic(t)} · {n}
                  </StatusChip>
                ))}
              </div>
            )}

            <div className="mt-4 space-y-3">
              {revRows.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <StatusChip tone="neutral">{sourceLabel(r.source)}</StatusChip>
                    <span className="num">{prettyDate(r.review_date)}</span>
                    <span>{names.get(r.location_id) ?? "Venue outside your labels"}</span>
                    <span className="num">
                      {r.rating == null
                        ? NOT_AVAILABLE
                        : `${Number(r.rating).toFixed(0)}/${Number(r.rating_scale ?? 5).toFixed(0)}`}
                    </span>
                    {r.is_complaint && <StatusChip tone="warning">Complaint</StatusChip>}
                    <StatusChip
                      tone={
                        r.status === "resolved"
                          ? "positive"
                          : r.status === "in_progress"
                            ? "warning"
                            : "muted"
                      }
                    >
                      {String(r.status).replace(/_/g, " ")}
                    </StatusChip>
                  </div>
                  <p className="mt-2 text-sm font-medium">{r.title ?? "Untitled review"}</p>
                  <p className="text-sm text-muted-foreground">{r.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {((r.topics ?? []) as string[]).map((t) => (
                      <StatusChip key={t} tone="muted">
                        {prettyTopic(t)}
                      </StatusChip>
                    ))}
                    <span className="text-xs text-muted-foreground">
                      {r.author_alias ?? "Anonymous reviewer"}
                    </span>
                  </div>
                  {r.response_note && (
                    <p className="mt-2 border-l-2 border-border pl-3 text-xs text-muted-foreground">
                      Response: {r.response_note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        <EvidenceFooter
          scope={scopeLabel(f, names)}
          period={`${f.from} → ${f.to}`}
          sources="Demo review adapter, shaped like Google Business Profile and Tripadvisor review feeds"
          metric="Average rating over rated reviews; complaints are reviews the adapter flags as raising an issue."
          limitations="Synthetic demo reviews. No live Google or Tripadvisor connection, so counts do not reflect real public reviews. Reviews without a venue match are not shown."
        />
      </Section>

      <Section
        title="Recent reservations"
        description="Matching to orders is only claimed where the source data supports it."
      >
        {upcoming.isLoading ? (
          <LoadingRows />
        ) : (upcoming.data ?? []).length === 0 ? (
          <EmptyState title="No reservations in this period" description="Nothing recorded for this scope." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Venue</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Party</th>
                  <th className="py-2 pr-3 text-right">Seated covers</th>
                  <th className="py-2 pr-3">Guest</th>
                  <th className="py-2">Order match</th>
                </tr>
              </thead>
              <tbody>
                {(upcoming.data ?? []).map((r: any) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="num py-2 pr-3">
                      {prettyDate(r.business_date)}{" "}
                      <span className="text-muted-foreground">
                        {new Date(r.scheduled_at).toLocaleTimeString("en-GB", {
                          timeZone: "Asia/Dubai",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {names.get(r.location_id) ?? "Venue outside your labels"}
                    </td>
                    <td className="py-2 pr-3 capitalize">{String(r.status).replace(/_/g, " ")}</td>
                    <td className="num py-2 pr-3 text-right">{r.party_size ?? "—"}</td>
                    <td className="num py-2 pr-3 text-right">{r.seated_covers ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {r.guest_id ? (
                        <StatusChip tone="neutral">Identifiable</StatusChip>
                      ) : (
                        <StatusChip tone="muted">Anonymous</StatusChip>
                      )}
                    </td>
                    <td className="py-2">
                      {r.match_confidence === "high" ? (
                        <StatusChip tone="positive">High confidence</StatusChip>
                      ) : r.match_confidence === "low" ? (
                        <StatusChip tone="warning">Low confidence</StatusChip>
                      ) : (
                        <StatusChip tone="muted">Unmatched</StatusChip>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <EvidenceFooter
          scope={scopeLabel(f, names)}
          period={`${f.from} → ${f.to}`}
          sources="Demo reservation adapter, matched to canonical orders where timing and venue agree"
          metric="Spend per cover only ever uses high-confidence matches."
          limitations={`${count(Number(g?.["unmatched_seated"] ?? 0))} seated reservations could not be matched to an order, so they are excluded from spend per cover.`}
        />
      </Section>
    </>
  );
}
