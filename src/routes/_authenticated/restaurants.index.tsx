import { createFileRoute, Link } from "@tanstack/react-router";
import { useAccess } from "@/hooks/use-access";
import { useFilters } from "@/lib/filters";
import { useVenueComparison } from "@/hooks/use-metrics";
import {
  EmptyState,
  EvidenceFooter,
  LoadingRows,
  NoPermission,
  PageHeader,
  Section,
  StatusChip,
} from "@/components/rosy/primitives";
import { money, count, pct, change, NOT_AVAILABLE, prettyDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/restaurants/")({
  head: () => ({
    meta: [
      { title: "Restaurants — Rosy AI" },
      {
        name: "description",
        content:
          "Every venue you are granted, ranked by net sales, with like-for-like growth, food cost and waste.",
      },
      { property: "og:title", content: "Restaurants — Rosy AI" },
      { property: "og:description", content: "Every venue you are granted, ranked by net sales." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Restaurants,
});

function Restaurants() {
  const { data: access } = useAccess();
  const f = useFilters();
  const allowed = access?.permissions.includes("view_sales") ?? false;
  const venues = useVenueComparison(f, allowed);

  if (access && !allowed) return <NoPermission what="venue performance" />;

  return (
    <>
      <PageHeader
        title="Restaurants"
        intro="Only venues covered by your grants appear here. Growth is left blank rather than guessed where a venue was not open for the whole comparison period."
      />

      <Section
        title="Venues"
        description={`Compared with ${f.prevFrom} → ${f.prevTo}.`}
        aside={<StatusChip tone="muted">Demo dataset</StatusChip>}
      >
        {venues.isLoading ? (
          <LoadingRows />
        ) : (venues.data ?? []).length === 0 ? (
          <EmptyState
            title="No venues in scope"
            description="Your account has no venue grants, or none of the granted venues recorded trade in this period."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {(venues.data ?? []).map((v) => {
              const ch = change(
                Number(v["net_sales"]),
                v["prev_net_sales"] == null ? null : Number(v["prev_net_sales"]),
              );
              const target = v["target"] == null ? null : Number(v["target"]);
              return (
                <Link
                  key={String(v["location_id"])}
                  to="/restaurants/$locationId"
                  params={{ locationId: String(v["location_id"]) }}
                  search={{ from: f.from, to: f.to, cmp: f.comparison }}
                  className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{String(v["location_name"])}</p>
                      <p className="text-xs text-muted-foreground">
                        {String(v["brand_name"])} · opened {prettyDate(v["opened_on"] as string)}
                      </p>
                    </div>
                    <StatusChip tone={v["comparable"] ? "neutral" : "warning"}>
                      {v["comparable"] ? "Comparable" : "New venue"}
                    </StatusChip>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Net sales</p>
                      <p className="num font-semibold">{money(Number(v["net_sales"]))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Change</p>
                      <p className="num font-semibold">
                        {v["comparable"] ? ch.label : "Not comparable"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Orders / covers</p>
                      <p className="num">
                        {count(Number(v["orders"]))} / {count(Number(v["covers"]))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Theoretical food cost</p>
                      <p className="num">
                        {v["theoretical_cost_pct"] == null
                          ? NOT_AVAILABLE
                          : pct(Number(v["theoretical_cost_pct"]))}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Budget</p>
                      <p className="num">
                        {target == null
                          ? "No budget recorded for this period"
                          : `${money(Number(v["net_sales"]))} of ${money(target)} (${pct(
                              (Number(v["net_sales"]) / target) * 100,
                            )})`}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <EvidenceFooter
          scope="All venues you are granted"
          period={`${f.from} → ${f.to} (Asia/Dubai business days)`}
          sources="Demo POS and delivery adapters, demo inventory adapter, demo budgets"
          metric="Net sales = gross ex tax − discounts − refunds, deduplicated across providers."
          limitations="Synthetic demo data. Recipe coverage varies by venue, so theoretical food cost is partial."
        />
      </Section>
    </>
  );
}
