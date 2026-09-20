const aed = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 0,
});
const aed2 = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const num = new Intl.NumberFormat("en-AE");

export const NOT_AVAILABLE = "Not available";

export function money(value: number | null | undefined, opts?: { precise?: boolean }) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return NOT_AVAILABLE;
  return opts?.precise ? aed2.format(Number(value)) : aed.format(Number(value));
}

export function count(value: number | null | undefined) {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  return num.format(Number(value));
}

export function pct(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return NOT_AVAILABLE;
  return `${Number(value).toFixed(digits)}%`;
}

/** Percentage change against a matched baseline. Zero/absent baseline never yields infinity. */
export function change(current: number | null, baseline: number | null) {
  if (current === null || baseline === null) return { label: NOT_AVAILABLE, direction: "flat" as const };
  if (baseline === 0) return { label: "New", direction: "flat" as const };
  const delta = ((current - baseline) / baseline) * 100;
  return {
    label: `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`,
    direction: delta > 0.05 ? ("up" as const) : delta < -0.05 ? ("down" as const) : ("flat" as const),
  };
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function shiftDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

export function daysBetween(fromIso: string, toIso: string) {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime();
  const b = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000) + 1;
}

export function prettyDate(iso: string | null | undefined) {
  if (!iso) return NOT_AVAILABLE;
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function freshness(ts: string | null | undefined) {
  if (!ts) return { label: "Never refreshed", stale: true };
  const hours = (Date.now() - new Date(ts).getTime()) / 3600000;
  if (hours > 72) return { label: `Stale — last refresh ${Math.floor(hours / 24)}d ago`, stale: true };
  if (hours > 36) return { label: `Last refresh ${Math.floor(hours)}h ago (ageing)`, stale: true };
  return { label: `Last refresh ${Math.max(1, Math.floor(hours))}h ago`, stale: false };
}
