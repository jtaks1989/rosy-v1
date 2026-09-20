import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, Sparkles } from "lucide-react";
import { askRosy, type RosyAnswer } from "@/lib/rosy.functions";
import { useFilters } from "@/lib/filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EvidenceFooter, StatusChip } from "@/components/rosy/primitives";
import type { AccessSnapshot } from "@/lib/access.functions";

const SUGGESTIONS: Record<string, string[]> = {
  leadership: [
    "Compare our restaurants this month and highlight the largest changes.",
    "How are net sales tracking against the comparison period?",
  ],
  restaurant_manager: ["Which items drove last week's sales at my venue?"],
  marketing: ["Which profitable dishes could we feature for weekday lunch?"],
  inventory_procurement: ["Which low-stock ingredients affect our best-selling dishes?"],
  hr_pro: ["Which verified documents expire within 60 days and who owns the renewal?"],
  investor: ["Show my funded capital, distributions and latest approved stake value."],
  finance: ["What were discounts, taxes and refunds for the period?"],
  investor_relations: ["Show my funded capital, distributions and latest approved stake value."],
  tech_admin: ["What does net sales mean in this platform?"],
};

export function RosyConversation({
  access,
  compact = false,
}: {
  access: AccessSnapshot | undefined;
  compact?: boolean;
}) {
  const filters = useFilters();
  const fn = useServerFn(askRosy);
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<{ q: string; a: RosyAnswer }[]>([]);

  const ask = useMutation({
    mutationFn: (q: string) =>
      fn({
        data: {
          question: q,
          from: filters.from,
          to: filters.to,
          locations: filters.locationsParam,
        },
      }) as Promise<RosyAnswer>,
    onSuccess: (a, q) => setThread((t) => [...t, { q, a }]),
  });

  const suggestions = SUGGESTIONS[access?.role ?? "leadership"] ?? [];

  const submit = (q: string) => {
    const value = q.trim();
    if (!value || ask.isPending) return;
    setQuestion("");
    ask.mutate(value);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
        Rosy bot answers within your access only, using the filters shown in the header:{" "}
        <span className="font-medium text-foreground">
          {filters.locations.length ? `${filters.locations.length} venue(s)` : "all granted venues"} ·{" "}
          {filters.from} → {filters.to} · Asia/Dubai
        </span>
        . Answers are calculated by the metrics API, not by the language model.
      </div>

      <div className={compact ? "flex-1 space-y-4 overflow-y-auto pr-1" : "space-y-4"}>
        {thread.length === 0 && !ask.isPending ? (
          <div className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Suggested for your role
            </p>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className="w-full rounded-lg border border-border bg-card p-3 text-left text-sm transition-colors hover:border-accent"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {thread.map((entry, i) => (
          <article key={i} className="space-y-3">
            <p className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground">
              {entry.q}
            </p>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusChip tone={entry.a.tool === "refused" ? "warning" : "neutral"}>
                  {entry.a.tool === "refused" ? "Request declined" : `Tool: ${entry.a.tool}`}
                </StatusChip>
                <StatusChip tone="muted">Demo data</StatusChip>
                <StatusChip tone={entry.a.evidence.narrative === "model" ? "neutral" : "muted"}>
                  {entry.a.evidence.narrative === "model" ? "Model narrative" : "Figures only"}
                </StatusChip>
              </div>
              <p className="text-sm font-medium text-foreground">{entry.a.answer}</p>
              {entry.a.rows.length ? (
                <dl className="mt-3 divide-y divide-border rounded-md border border-border">
                  {entry.a.rows.map((r, idx) => (
                    <div key={idx} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                      <dt className="text-xs text-muted-foreground">{r.label}</dt>
                      <dd className="num text-sm font-medium text-foreground">
                        {r.value}
                        {r.note ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">{r.note}</span>
                        ) : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              <p className="mt-3 text-sm text-muted-foreground">{entry.a.interpretation}</p>
              <p className="mt-2 text-sm text-foreground">
                <span className="font-medium">Proposed next step: </span>
                {entry.a.nextStep}
              </p>
              <EvidenceFooter
                scope={entry.a.evidence.scope}
                period={entry.a.evidence.period}
                sources={entry.a.evidence.sources}
                metric={entry.a.evidence.metric}
                limitations={entry.a.evidence.limitations}
              />
            </div>
          </article>
        ))}

        {ask.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Rosy is querying the metrics API…
          </p>
        ) : null}
        {ask.isError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {(ask.error as Error).message}
          </p>
        ) : null}
      </div>

      <form
        className="flex items-center gap-2 border-t border-border pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
      >
        <label className="sr-only" htmlFor="rosy-question">
          Ask Rosy a question
        </label>
        <Input
          id="rosy-question"
          value={question}
          placeholder="Ask about sales, menu, stock, guests or your holdings…"
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Button type="submit" disabled={ask.isPending || !question.trim()}>
          {ask.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          <span className="sr-only">Send</span>
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        <Sparkles className="mr-1 inline size-3" aria-hidden />
        Rosy bot is read-only: it cannot send messages, place purchases, submit HR filings or approve valuations.
      </p>
    </div>
  );
}
