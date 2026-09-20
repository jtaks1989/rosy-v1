import type { ReactNode } from "react";
import { AlertTriangle, Check, CircleSlash, Info, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { NOT_AVAILABLE } from "@/lib/format";

export function PageHeader({
  title,
  intro,
  actions,
}: {
  title: string;
  intro?: string | undefined;
  actions?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          <span className="live-dot" aria-hidden /> Demo
        </p>
        <h1 className="page-title mt-2 text-2xl text-foreground sm:text-[2rem]">{title}</h1>
        {intro ? (
          <p className="mt-2 animate-[fade_0.5s_var(--ease-out-soft)_0.15s_both] text-sm text-muted-foreground">
            {intro}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Section({
  title,
  description,
  children,
  aside,
  className,
}: {
  title: string;
  description?: string | undefined;
  children: ReactNode;
  aside?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <p className="eyebrow mb-2">{title}</p>
      <div className="lift rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        {description || aside ? (
          <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
            {description ? (
              <p className="max-w-xl text-xs text-muted-foreground">{description}</p>
            ) : (
              <span />
            )}
            {aside}
          </header>
        ) : null}
        {children}
      </div>
    </section>
  );
}

type Tone = "neutral" | "positive" | "warning" | "critical" | "muted";

const toneClass: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground border-border",
  positive: "bg-positive/10 text-positive border-positive/25",
  warning: "bg-warning/12 text-warning-foreground border-warning/30",
  critical: "bg-destructive/8 text-destructive border-destructive/25",
  muted: "bg-muted text-muted-foreground border-border",
};

const toneIcon: Record<Tone, ReactNode> = {
  neutral: <Info className="size-3" aria-hidden />,
  positive: <Check className="size-3" aria-hidden />,
  warning: <AlertTriangle className="size-3" aria-hidden />,
  critical: <AlertTriangle className="size-3" aria-hidden />,
  muted: <CircleSlash className="size-3" aria-hidden />,
};

export function StatusChip({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: Tone | undefined;
  title?: string | undefined;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex animate-[pop_0.35s_var(--ease-out-soft)_both] items-center gap-1.5 rounded-full border px-2 py-[0.15rem] text-[10px] font-semibold tracking-[0.08em] uppercase transition-transform duration-200 hover:scale-[1.03]",
        toneClass[tone],
      )}
    >
      {toneIcon[tone]}
      {children}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  changeLabel,
  direction = "flat",
  note,
  unavailableReason,
  onClick,
  definition,
}: {
  label: string;
  value: string;
  changeLabel?: string | undefined;
  direction?: "up" | "down" | "flat" | undefined;
  note?: string | undefined;
  unavailableReason?: string | undefined;
  onClick?: () => void;
  definition?: string | undefined;
}) {
  const unavailable = Boolean(unavailableReason) || value === NOT_AVAILABLE;
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {label}
        </span>
        {definition ? (
          <span title={definition} className="text-muted-foreground transition-colors hover:text-primary">
            <Info className="size-3.5" aria-hidden />
            <span className="sr-only">{definition}</span>
          </span>
        ) : null}
      </div>
      <div
        key={value}
        className={cn(
          "num mt-3 animate-[pop_0.35s_var(--ease-out-soft)_both] text-[1.6rem] font-semibold tracking-[-0.02em]",
          unavailable ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {unavailable ? NOT_AVAILABLE : value}
      </div>

      {unavailable ? (
        <p className="mt-1 text-xs text-muted-foreground">{unavailableReason ?? "Source not connected"}</p>
      ) : (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
          {changeLabel ? (
            <span
              className={cn(
                "num inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium",
                direction === "up"
                  ? "bg-positive/10 text-positive"
                  : direction === "down"
                    ? "bg-destructive/8 text-destructive"
                    : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="size-3" aria-hidden />
              {changeLabel}
            </span>
          ) : null}
          {note ? <span className="text-muted-foreground">{note}</span> : null}
        </div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="lift group rounded-lg border border-border bg-card p-4 text-left shadow-[var(--shadow-card)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:translate-y-0"
      >
        {body}
      </button>
    );
  }
  return (
    <div className="lift rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      {body}
    </div>
  );
}


export function EvidenceFooter({
  scope,
  period,
  sources,
  freshness,
  metric,
  limitations,
}: {
  scope: string;
  period: string;
  sources: string;
  freshness?: string | undefined;
  metric?: string | undefined;
  limitations?: string | undefined;
}) {
  return (
    <dl className="mt-4 grid gap-x-6 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground sm:grid-cols-2">
      <div>
        <dt className="inline font-medium">Scope: </dt>
        <dd className="inline">{scope}</dd>
      </div>
      <div>
        <dt className="inline font-medium">Period (Asia/Dubai): </dt>
        <dd className="inline">{period}</dd>
      </div>
      <div>
        <dt className="inline font-medium">Sources: </dt>
        <dd className="inline">{sources}</dd>
      </div>
      {freshness ? (
        <div>
          <dt className="inline font-medium">Freshness: </dt>
          <dd className="inline">{freshness}</dd>
        </div>
      ) : null}
      {metric ? (
        <div className="sm:col-span-2">
          <dt className="inline font-medium">Metric definition: </dt>
          <dd className="inline">{metric}</dd>
        </div>
      ) : null}
      {limitations ? (
        <div className="sm:col-span-2">
          <dt className="inline font-medium">Limitations: </dt>
          <dd className="inline">{limitations}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function NoPermission({ what }: { what: string }) {
  return (
    <EmptyState
      title="You do not have access to this view"
      description={`Your current access does not include ${what}. Access is enforced in the database, so switching pages or editing the address bar will not reveal it. Ask an administrator for a grant.`}
    />
  );
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="shimmer h-9 rounded"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
      <span className="sr-only">Loading data</span>
    </div>
  );
}

