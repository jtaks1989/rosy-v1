import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rosy AI — restaurant intelligence for Rosy Hospitality" },
      {
        name: "description",
        content:
          "Rosy AI brings restaurant performance, menu profitability, inventory, guests, people and investor reporting into one secure platform.",
      },
      { property: "og:title", content: "Rosy AI — a clearer view of every restaurant" },
      {
        property: "og:description",
        content:
          "One secure workspace for performance, menu profitability, inventory, guests, people and investor reporting.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
        <p className="page-title text-4xl text-primary sm:text-5xl">Rosy AI</p>
        <p className="mt-3 text-lg text-foreground">A clearer view of every restaurant.</p>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          One secure workspace for restaurant performance, menu profitability, inventory, guest
          behaviour, staffing renewals and investor reporting — with Rosy bot answering questions inside
          the same permissions, definitions and source evidence as the dashboards.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link to={signedIn ? "/overview" : "/auth"}>
              {signedIn ? "Open Rosy AI" : "Sign in"}
            </Link>
          </Button>
          {!signedIn ? (
            <Button variant="outline" asChild>
              <Link to="/auth">Request access</Link>
            </Button>
          ) : null}
        </div>

        <dl className="mt-14 grid gap-6 sm:grid-cols-3">
          {[
            {
              t: "Honest by design",
              d: "A zero is not missing data. Anything without a verified source reads “Not available”, never an invented figure.",
            },
            {
              t: "Counted once",
              d: "One economic sale recorded by two providers is reconciled into a single canonical order before any total is published.",
            },
            {
              t: "Denied by default",
              d: "Every venue, guest record, document and investor holding is gated in the database, not just hidden in the menu.",
            },
          ].map((x) => (
            <div key={x.t} className="rounded-xl border border-border bg-card p-4">
              <dt className="text-sm font-semibold text-foreground">{x.t}</dt>
              <dd className="mt-1 text-xs text-muted-foreground">{x.d}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-14 text-xs text-muted-foreground">
          Currently running on a clearly labelled demo dataset. Foodics, Grubtech, Supy, Eat App, HR and
          accounting connections are read-only by design and are not live yet.
        </p>
      </div>
    </main>
  );
}
