import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  BellRing,
  Bot,
  Boxes,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleUser,
  ClipboardList,
  Utensils,
  LayoutDashboard,
  LineChart,
  LogOut,
  Megaphone,
  MessageCircle,
  PlugZap,
  Settings,
  Sparkles,
  Users,
  Menu as MenuIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useAccess, useSetDemoRole } from "@/hooks/use-access";
import { ROLE_PRESETS } from "@/lib/access.functions";
import { useFilters, rangePresets } from "@/lib/filters";
import { StatusChip } from "@/components/rosy/primitives";
import { RosyConversation } from "@/components/rosy/rosy-panel";
import { isoDate, shiftDays } from "@/lib/format";

const NAV = [
  { to: "/brief", label: "Your Rosy Brief", icon: Sparkles, permission: null, group: "Overview" },
  { to: "/overview", label: "Overview", icon: LayoutDashboard, permission: "view_overview", group: "Overview" },
  { to: "/restaurants", label: "Restaurants", icon: Building2, permission: "view_sales", group: "Overview" },
  { to: "/actions", label: "Actions & Outcomes", icon: ClipboardList, permission: "view_alerts", group: "Management" },
  { to: "/monitoring", label: "My monitoring rules", icon: BellRing, permission: "use_bot", group: "System" },
  { to: "/briefing-preferences", label: "Briefing preferences", icon: CalendarClock, permission: null, group: "System" },
  { to: "/sales", label: "Sales & Channels", icon: LineChart, permission: "view_sales", group: "Reports" },
  { to: "/menu", label: "Menu Intelligence", icon: Utensils, permission: "view_menu", group: "Reports" },
  { to: "/inventory", label: "Inventory & Procurement", icon: Boxes, permission: "view_inventory", group: "Reports" },
  { to: "/guests", label: "Guests & Reservations", icon: CalendarClock, permission: "view_guests", group: "Reports" },
  { to: "/marketing", label: "Marketing Insights", icon: Megaphone, permission: "view_marketing", group: "Reports" },
  { to: "/finance", label: "Finance & Reports", icon: BadgeDollarSign, permission: "view_finance", group: "Reports" },
  { to: "/people", label: "People & Renewals", icon: Users, permission: "view_people", group: "Management" },
  { to: "/investor", label: "Investor Portal", icon: Sparkles, permission: "view_investor_portal", group: "Management" },
  { to: "/alerts", label: "Alerts & Tasks", icon: ClipboardList, permission: "view_alerts", group: "Management" },
  { to: "/rosy-bot", label: "Rosy bot", icon: MessageCircle, permission: "use_bot", group: "System" },
  { to: "/integrations", label: "Integrations & Data Quality", icon: PlugZap, permission: null, group: "System" },
  { to: "/settings", label: "Settings & Access", icon: Settings, permission: null, group: "System" },
] as const;

const NAV_GROUPS = ["Overview", "Reports", "Management", "System"] as const;

const COMPARISONS = [
  { value: "previous_period", label: "Previous period" },
  { value: "previous_year", label: "Same period last year" },
  { value: "none", label: "No comparison" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data: access } = useAccess();
  const setRole = useSetDemoRole();
  const filters = useFilters();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [botOpen, setBotOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(filters.from);
  const [draftTo, setDraftTo] = useState(filters.to);

  useEffect(() => {
    setDraftFrom(filters.from);
    setDraftTo(filters.to);
  }, [filters.from, filters.to]);

  const items = NAV.filter((n) => !n.permission || access?.permissions.includes(n.permission));

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const currentLabel =
    NAV.find((n) => pathname === n.to || pathname.startsWith(`${n.to}/`))?.label ?? "Dashboard";

  const nav = (
    <nav className="space-y-5" aria-label="Main">
      {NAV_GROUPS.map((group) => {
        const groupItems = items.filter((i) => i.group === group);
        if (!groupItems.length) return null;
        return (
          <div key={group} className="space-y-1">
            {!collapsed ? (
              <p className="px-3 pb-1 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                {group}
              </p>
            ) : (
              <div className="mx-3 mb-2 h-px bg-sidebar-border" aria-hidden />
            )}
            {groupItems.map((item) => {
              const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  search={(prev) => prev}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "nav-item flex items-center gap-3 rounded-md px-3 py-2 text-[13px]",
                    active
                      ? "nav-item-active bg-sidebar-accent pl-4 font-semibold text-sidebar-accent-foreground shadow-[var(--shadow-card)]"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0 transition-transform duration-200",
                      active ? "scale-110 text-primary" : "",
                    )}
                    aria-hidden
                  />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {access?.isDemo ? (
        <div className="bg-primary px-4 py-1.5 text-center text-xs font-medium text-primary-foreground">
          This demonstration uses sample data for illustration purposes. No live source is connected and
          nothing here is reconciled.
        </div>
      ) : null}

      <div className="flex">
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-3 lg:flex",
            collapsed ? "w-[76px]" : "w-64",
          )}
        >
          <div className="mb-6 flex items-center justify-between gap-2 border-b border-sidebar-border px-1 pb-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-card)]"
              >
                <Sparkles className="size-4" />
              </span>
              {!collapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold tracking-[-0.01em] text-foreground">
                    Rosy Hospitality
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">Revenue Intelligence</p>
                </div>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              onClick={() => setCollapsed((c) => !c)}
            >
              {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            </Button>
          </div>
          {nav}

          {!collapsed ? (
            <div className="mt-auto space-y-2 pt-6">
              <div className="rounded-lg border border-sidebar-border bg-card p-3">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                  Outlets in view
                </p>
                <p className="num mt-1 text-sm font-semibold text-foreground">
                  {filters.locations.length || (access?.locations.length ?? 0)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    of {access?.locations.length ?? 0}
                  </span>
                </p>
              </div>
              <p className="num px-1 text-[11px] text-muted-foreground">{filters.to} · Asia/Dubai</p>
            </div>
          ) : null}
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation">
                    <MenuIcon className="size-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 bg-sidebar p-4">
                  <SheetHeader>
                    <SheetTitle className="text-sm font-semibold">Rosy Hospitality</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">{nav}</div>
                </SheetContent>
              </Sheet>

              <div className="mr-auto flex min-w-0 items-center gap-2 text-[13px]">
                <span className="shrink-0 rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-primary uppercase">
                  Demo
                </span>
                <span className="truncate text-muted-foreground">{access?.orgName ?? "Rosy"}</span>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate font-semibold text-primary">{currentLabel}</span>
                <span className="hidden truncate text-xs text-muted-foreground md:inline">
                  · {access?.scopeSummary ?? "Loading access…"} · Asia/Dubai · AED
                </span>
              </div>

              {/* venue scope */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    {filters.locations.length
                      ? `${filters.locations.length} venue(s)`
                      : "All granted venues"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72" align="end">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Venues you are granted
                  </p>
                  <div className="space-y-2">
                    {(access?.locations ?? []).map((l) => {
                      const checked = filters.locations.includes(l.id);
                      return (
                        <label key={l.id} className="flex items-start gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() =>
                              filters.set({
                                locations: checked
                                  ? filters.locations.filter((x) => x !== l.id)
                                  : [...filters.locations, l.id],
                              })
                            }
                          />
                          <span>
                            {l.name}
                            <span className="block text-xs text-muted-foreground">
                              {l.brand} · cutoff {l.cutoff.slice(0, 5)}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                    {(access?.locations ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">No venue scope granted.</p>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => filters.set({ locations: [] })}
                  >
                    Clear venue filter
                  </Button>
                </PopoverContent>
              </Popover>

              {/* date range */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="num">
                    {filters.from} → {filters.to}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[22rem]" align="end">
                  <div className="space-y-3">
                    <p className="eyebrow">Timeframe</p>
                    <div className="grid grid-cols-2 gap-1">
                      {rangePresets().map((r) => {
                        const active = filters.from === r.from && filters.to === r.to;
                        return (
                          <Button
                            key={r.key}
                            variant={active ? "secondary" : "ghost"}
                            size="sm"
                            className="justify-start"
                            onClick={() => filters.set({ from: r.from, to: r.to })}
                          >
                            {r.label}
                          </Button>
                        );
                      })}
                    </div>

                    <div className="border-t border-border pt-3">
                      <p className="eyebrow">Custom dates</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="text-xs text-muted-foreground">
                          Start
                          <input
                            type="date"
                            value={draftFrom}
                            max={draftTo}
                            onChange={(e) => setDraftFrom(e.target.value)}
                            className="num mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="text-xs text-muted-foreground">
                          End
                          <input
                            type="date"
                            value={draftTo}
                            min={draftFrom}
                            onChange={(e) => setDraftTo(e.target.value)}
                            className="num mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm"
                          />
                        </label>
                      </div>
                      <Button
                        size="sm"
                        className="mt-2 w-full"
                        disabled={!draftFrom || !draftTo || draftFrom > draftTo}
                        onClick={() => filters.set({ from: draftFrom, to: draftTo })}
                      >
                        Apply dates
                      </Button>
                      {draftFrom && draftTo && draftFrom > draftTo ? (
                        <p className="mt-1 text-xs text-destructive">The start date must fall on or before the end date.</p>
                      ) : null}
                    </div>

                    <div className="border-t border-border pt-3">
                      <p className="eyebrow">Compare with</p>
                      <div className="mt-2 space-y-1">
                        {COMPARISONS.map((c) => (
                          <Button
                            key={c.value}
                            variant={filters.comparison === c.value ? "secondary" : "ghost"}
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => filters.set({ comparison: c.value })}
                          >
                            {c.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {filters.span} day(s) selected · Asia/Dubai
                      {filters.comparison === "none"
                        ? " · no comparison applied"
                        : ` · compared with ${filters.prevFrom} → ${filters.prevTo}`}
                    </p>
                  </div>
                </PopoverContent>
              </Popover>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Account menu">
                    <CircleUser className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>
                    <p className="text-sm">{access?.email ?? "Signed in"}</p>
                    <p className="text-xs font-normal text-muted-foreground">
                      {ROLE_PRESETS.find((r) => r.value === access?.role)?.label ?? "No role"}
                    </p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {access?.isDemo ? (
                    <div className="px-2 py-2">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Demo role preview (synthetic data only)
                      </p>
                      <select
                        className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                        value={access?.role ?? "leadership"}
                        disabled={setRole.isPending}
                        onChange={(e) => setRole.mutate(e.target.value)}
                      >
                        {ROLE_PRESETS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Changes real grants in the demo workspace, so denied data stays denied.
                      </p>
                    </div>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="size-4" aria-hidden /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2">
              <StatusChip tone="muted">Demo adapters — no live source connected</StatusChip>
              <StatusChip tone="neutral">Foodics: authoritative POS source (demo)</StatusChip>
              <StatusChip tone="warning" title="Historical completed/cancelled coverage only">
                Grubtech: historical coverage only
              </StatusChip>
              <StatusChip tone="muted">Supy &amp; Eat App: pending access</StatusChip>
            </div>
          </header>

          <main className="mx-auto max-w-[1200px] space-y-8 px-4 py-8 sm:px-6">
            {children}
          </main>

          <footer className="mt-4 border-t border-border px-4 py-4 sm:px-6">
            <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>© {new Date().getFullYear()} Rosy Hospitality · AI Reporting Platform</span>
              <span>
                This demonstration uses sample data for illustration purposes · Asia/Dubai
                <span className="ml-2 rounded border border-border px-1.5 py-0.5">v1 demo</span>
              </span>
            </div>
          </footer>

          <Sheet open={botOpen} onOpenChange={setBotOpen}>
            <SheetTrigger asChild>
              <Button
                className="group fixed right-4 bottom-4 z-40 h-14 rounded-full px-3 shadow-[var(--shadow-lift)] sm:right-6 sm:bottom-6 sm:px-4"
                aria-label="Ask Rosy"
                title="Ask Rosy"
              >
                <span className="relative grid size-8 place-items-center rounded-full bg-primary-foreground/15">
                  <Bot className="size-5 transition-transform duration-200 group-hover:scale-110" aria-hidden />
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-positive ring-2 ring-primary" aria-hidden />
                </span>
                <span className="hidden pr-1 text-sm font-semibold sm:inline">Ask Rosy</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-full flex-col gap-0 p-4 sm:max-w-lg">
              <SheetHeader>
                <SheetTitle className="page-title flex items-center gap-2 text-primary">
                  <Bot className="size-5" aria-hidden /> Rosy bot
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 min-h-0 flex-1">
                <RosyConversation access={access} compact />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}
