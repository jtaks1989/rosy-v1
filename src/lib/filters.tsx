import { useNavigate, useSearch } from "@tanstack/react-router";
import { isoDate, shiftDays, daysBetween } from "./format";

export type ComparisonMode = "previous_period" | "previous_year" | "none";

export type FilterState = {
  from: string;
  to: string;
  /** empty array = all venues the signed-in person is granted */
  locations: string[];
  comparison: ComparisonMode;
};

export function defaultRange() {
  const to = shiftDays(isoDate(new Date()), -1);
  return { from: shiftDays(to, -29), to };
}

/** Same calendar day one year earlier, clamped for 29 Feb. */
export function shiftYear(iso: string, years: number) {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  const target = new Date(Date.UTC((y ?? 1970) + years, (m ?? 1) - 1, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d ?? 1, lastDay));
  return isoDate(target);
}

export function useFilters() {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const fallback = defaultRange();

  const from = typeof search['from'] === "string" ? search['from'] : fallback.from;
  const to = typeof search['to'] === "string" ? search['to'] : fallback.to;
  const loc = typeof search['loc'] === "string" && search['loc'].length > 0 ? search['loc'].split(",") : [];
  const comparison: ComparisonMode =
    search['cmp'] === "none" ? "none" : search['cmp'] === "previous_year" ? "previous_year" : "previous_period";

  const span = daysBetween(from, to);
  const prevTo = comparison === "previous_year" ? shiftYear(to, -1) : shiftDays(from, -1);
  const prevFrom = comparison === "previous_year" ? shiftYear(from, -1) : shiftDays(prevTo, -(span - 1));

  const set = (next: Partial<{ from: string; to: string; locations: string[]; comparison: string }>) => {
    navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => {
        const locValue = (next.locations ?? loc).join(",");
        const rest = { ...prev } as Record<string, unknown>;
        delete rest['loc'];
        return {
          ...rest,
          from: next.from ?? from,
          to: next.to ?? to,
          cmp: next.comparison ?? comparison,
          ...(locValue ? { loc: locValue } : {}),
        };
      },
      replace: true,
    });
  };

  return {
    from,
    to,
    locations: loc,
    comparison,
    span,
    prevFrom,
    prevTo,
    timezone: "Asia/Dubai",
    set,
    /** null means "no explicit venue filter" for the metrics API */
    locationsParam: loc.length ? loc : null,
  };
}

export type Filters = ReturnType<typeof useFilters>;

export function scopeLabel(f: Filters, names: Map<string, string>) {
  const venues = f.locations.length
    ? f.locations.map((id) => names.get(id) ?? "Unknown venue").join(", ")
    : "All granted venues";
  return `${venues} · ${f.from} → ${f.to} · Asia/Dubai`;
}

/** Named timeframes, all resolved in the reporting timezone-agnostic ISO day space. */
export function rangePresets(today = isoDate(new Date())) {
  const yesterday = shiftDays(today, -1);
  const [y, m] = today.split("-").map((n) => Number(n));
  const year = y ?? 1970;
  const month = m ?? 1;
  const monthStart = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  const lastMonthEnd = shiftDays(monthStart, -1);
  const lastMonthStart = `${lastMonthEnd.slice(0, 7)}-01`;
  const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
  const quarterStart = `${String(year).padStart(4, "0")}-${String(quarterStartMonth).padStart(2, "0")}-01`;
  const yearStart = `${String(year).padStart(4, "0")}-01-01`;
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const weekStart = shiftDays(today, -weekday);

  return [
    { key: "today", label: "Today", from: today, to: today },
    { key: "yesterday", label: "Yesterday", from: yesterday, to: yesterday },
    { key: "7d", label: "Last 7 days", from: shiftDays(yesterday, -6), to: yesterday },
    { key: "14d", label: "Last 14 days", from: shiftDays(yesterday, -13), to: yesterday },
    { key: "30d", label: "Last 30 days", from: shiftDays(yesterday, -29), to: yesterday },
    { key: "90d", label: "Last 90 days", from: shiftDays(yesterday, -89), to: yesterday },
    { key: "wtd", label: "Week to date", from: weekStart, to: today },
    { key: "mtd", label: "Month to date", from: monthStart, to: today },
    { key: "lastMonth", label: "Last month", from: lastMonthStart, to: lastMonthEnd },
    { key: "qtd", label: "Quarter to date", from: quarterStart, to: today },
    { key: "ytd", label: "Year to date", from: yearStart, to: today },
    { key: "12m", label: "Last 12 months", from: shiftYear(shiftDays(yesterday, 1), -1), to: yesterday },
  ] as const;
}
