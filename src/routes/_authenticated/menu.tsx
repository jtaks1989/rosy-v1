import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAccess } from "@/hooks/use-access";
import { NoPermission, PageHeader, StatusChip } from "@/components/rosy/primitives";
import { MenuPerformanceTab } from "@/components/rosy/menu/performance-tab";
import { MenuEngineeringTab } from "@/components/rosy/menu/engineering-tab";

export const Route = createFileRoute("/_authenticated/menu")({
  head: () => ({
    meta: [
      { title: "Menu intelligence — Rosy AI" },
      {
        name: "description",
        content:
          "Item-level units, revenue, recipe cost and contribution, plus four-quadrant menu engineering with honest gaps where no recipe cost exists.",
      },
      { property: "og:title", content: "Menu intelligence — Rosy AI" },
      {
        property: "og:description",
        content: "Item-level contribution, sales mix and menu engineering quadrants with honest gaps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Menu,
});

const TABS = [
  {
    key: "performance" as const,
    label: "Menu Performance",
    hint: "Item-level sales, cost and contribution exactly as before.",
  },
  {
    key: "engineering" as const,
    label: "Menu Engineering",
    hint: "Four-quadrant classification against category benchmarks.",
  },
];

function Menu() {
  const { data: access } = useAccess();
  const allowed = access?.permissions.includes("view_menu") ?? false;
  const [tab, setTab] = useState<"performance" | "engineering">("performance");

  if (access && !allowed) return <NoPermission what="menu profitability" />;

  const active = TABS.find((t) => t.key === tab)!;

  return (
    <>
      <PageHeader
        title="Menu intelligence"
        intro="Contribution is only calculated where a recipe cost was effective on the day the item sold. Everything else says so plainly instead of guessing a margin."
        actions={<StatusChip tone="muted">Demo dataset</StatusChip>}
      />

      <div className="min-w-0">
        <div
          role="tablist"
          aria-label="Menu intelligence views"
          className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              id={`menu-tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls={`menu-panel-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === t.key
                  ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{active.hint}</p>
      </div>

      <div
        role="tabpanel"
        id={`menu-panel-${tab}`}
        aria-labelledby={`menu-tab-${tab}`}
        className="min-w-0 space-y-6"
      >
        {tab === "performance" ? <MenuPerformanceTab /> : <MenuEngineeringTab />}
      </div>
    </>
  );
}
