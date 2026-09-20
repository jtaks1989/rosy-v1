import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type AttentionSeverity = "critical" | "warning" | "watch";

export type AttentionItem = {
  severity: AttentionSeverity;
  headline: string;
  detail: string;
  metric?: string | undefined;
  to?: string | undefined;
  linkLabel?: string | undefined;
};

const severityStyles: Record<AttentionSeverity, { card: string; badge: string; label: string }> = {
  critical: {
    card: "border-destructive/40 bg-destructive/[0.06]",
    badge: "bg-destructive/12 text-destructive border-destructive/30",
    label: "Act now",
  },
  warning: {
    card: "border-warning/40 bg-warning/[0.08]",
    badge: "bg-warning/15 text-warning-foreground border-warning/35",
    label: "Due soon",
  },
  watch: {
    card: "border-border bg-surface",
    badge: "bg-secondary text-secondary-foreground border-border",
    label: "Keep watching",
  },
};

const rank: Record<AttentionSeverity, number> = { critical: 0, warning: 1, watch: 2 };

export function AttentionPanel({
  title = "Needs attention",
  description,
  items,
  clearMessage = "Nothing needs attention in this scope and period.",
}: {
  title?: string | undefined;
  description?: string | undefined;
  items: AttentionItem[];
  clearMessage?: string | undefined;
}) {
  const sorted = [...items].sort((a, b) => rank[a.severity] - rank[b.severity]);
  const criticals = sorted.filter((i) => i.severity === "critical").length;
  const warnings = sorted.filter((i) => i.severity === "warning").length;

  return (
    <section className="min-w-0">
      <p className="eyebrow mb-2 flex items-center gap-2">
        <span
          className={cn(
            "inline-block size-1.5 rounded-full",
            criticals ? "bg-destructive" : warnings ? "bg-warning" : "bg-positive",
          )}
          aria-hidden
        />
        {title}
      </p>
      <div
        className={cn(
          "rounded-lg border p-4 shadow-[var(--shadow-card)]",
          criticals ? severityStyles.critical.card : warnings ? severityStyles.warning.card : "border-border bg-card",
        )}
      >
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="max-w-xl text-xs text-muted-foreground">
            {description ?? "Signals ranked by urgency for the venues and period you have selected."}
          </p>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase">
            {criticals ? (
              <span className={cn("rounded-full border px-2 py-[0.15rem]", severityStyles.critical.badge)}>
                {criticals} urgent
              </span>
            ) : null}
            {warnings ? (
              <span className={cn("rounded-full border px-2 py-[0.15rem]", severityStyles.warning.badge)}>
                {warnings} due soon
              </span>
            ) : null}
          </span>
        </header>

        {sorted.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-positive" aria-hidden />
            {clearMessage}
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {sorted.map((item) => (
              <li
                key={`${item.severity}-${item.headline}`}
                className={cn(
                  "lift animate-[pop_0.35s_var(--ease-out-soft)_both] rounded-md border p-3",
                  severityStyles[item.severity].card,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    {item.severity === "watch" ? (
                      <Clock className="size-3.5 text-muted-foreground" aria-hidden />
                    ) : (
                      <AlertTriangle
                        className={cn(
                          "size-3.5",
                          item.severity === "critical" ? "text-destructive" : "text-warning-foreground",
                        )}
                        aria-hidden
                      />
                    )}
                    {item.headline}
                  </span>
                  {item.metric ? (
                    <span className="num text-lg leading-none font-semibold text-foreground">{item.metric}</span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{item.detail}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-[0.1rem] text-[10px] font-semibold tracking-[0.08em] uppercase",
                      severityStyles[item.severity].badge,
                    )}
                  >
                    {severityStyles[item.severity].label}
                  </span>
                  {item.to ? (
                    <Link
                      to={item.to}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      {item.linkLabel ?? "Open"}
                      <ArrowRight className="size-3" aria-hidden />
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function severityForDays(days: number): AttentionSeverity {
  if (days < 0) return "critical";
  if (days <= 30) return "warning";
  return "watch";
}

export function RowFlag({ children }: { children: ReactNode }) {
  return <span className="text-[10px] font-semibold text-muted-foreground uppercase">{children}</span>;
}
