import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-access";
import { useFilters } from "@/lib/filters";
import {
  EmptyState,
  LoadingRows,
  NoPermission,
  PageHeader,
  Section,
  StatusChip,
} from "@/components/rosy/primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/actions")({
  head: () => ({
    meta: [
      { title: "Actions & Outcomes — Rosy AI" },
      {
        name: "description",
        content:
          "Turn an insight into a reviewed decision, an assigned action and a measured outcome — with the evidence that started it kept alongside.",
      },
      { property: "og:title", content: "Actions & Outcomes — Rosy AI" },
      {
        property: "og:description",
        content: "Insight, decision, owner, completion and an honest outcome review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActionsPage,
});

const STATUSES = [
  "open",
  "assigned",
  "in_progress",
  "blocked",
  "completed",
  "under_review",
  "closed",
] as const;

const VERDICTS = [
  { value: "improved", label: "Measure moved in the intended direction" },
  { value: "unchanged", label: "No material change" },
  { value: "worse", label: "Measure moved against us" },
  { value: "inconclusive", label: "Inconclusive — data insufficient" },
];

const field =
  "mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function ActionCard({ a, onChanged }: { a: Record<string, any>; onChanged: () => void }) {
  const { data: access } = useAccess();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");

  const update = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from("rosy_actions").update(patch as never).eq("id", a['id']);
      if (error) throw new Error(error.message);
    },
    onSuccess: onChanged,
  });

  const comments = useQuery({
    queryKey: ["action-comments", a['id']],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_comments")
        .select("id, body, author_name, created_at")
        .eq("action_id", a['id'])
        .order("created_at");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!access?.orgId) throw new Error("No workspace membership");
      const { error } = await supabase.from("action_comments").insert({
        org_id: access.orgId,
        action_id: a['id'],
        author: access.userId,
        author_name: access.displayName ?? access.email,
        body: comment.trim(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setComment("");
      comments.refetch();
    },
  });

  const evidence = (a['evidence'] ?? {}) as Record<string, unknown>;

  return (
    <div className="lift rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{a['title']}</p>
          {a['why_it_matters'] ? (
            <p className="mt-1 text-xs text-muted-foreground">{a['why_it_matters']}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusChip tone={a['severity'] === "high" ? "critical" : "warning"}>{a['severity']}</StatusChip>
          <StatusChip tone="neutral">{String(a['status']).replace(/_/g, " ")}</StatusChip>
          <StatusChip tone="muted">from {String(a['source_kind']).replace(/_/g, " ")}</StatusChip>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <span>Owner: {a['owner_name'] ?? "unassigned"}</span>
        <span>Due: {a['due_date'] ?? "no date set"}</span>
        <span>Outcome review: {a['outcome_review_date'] ?? "not scheduled"}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          className="rounded border border-input bg-background px-2 py-1 text-xs"
          value={a['status']}
          onChange={(e) => update.mutate({ status: e.target.value })}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide detail" : "View evidence & review"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const d = new Date();
            d.setDate(d.getDate() + 7);
            update.mutate({ snoozed_until: d.toISOString().slice(0, 10) });
          }}
        >
          Snooze 7 days
        </Button>
        <Button variant="ghost" size="sm" onClick={() => update.mutate({ status: "closed" })}>
          Resolve &amp; close
        </Button>
      </div>

      {open ? (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div>
            <p className="eyebrow mb-1">Evidence snapshot at the time the action was created</p>
            <pre className="num overflow-x-auto rounded bg-muted p-3 text-[11px] text-muted-foreground">
              {JSON.stringify(evidence, null, 2)}
            </pre>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">
              Assign owner (name)
              <input
                className={field}
                defaultValue={a['owner_name'] ?? ""}
                onBlur={(e) => update.mutate({ owner_name: e.target.value || null })}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Due date
              <input
                type="date"
                className={field}
                defaultValue={a['due_date'] ?? ""}
                onBlur={(e) => update.mutate({ due_date: e.target.value || null })}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Agreed success measure
              <input
                className={field}
                placeholder="e.g. verified ingredient cost for this dish"
                defaultValue={a['success_metric'] ?? ""}
                onBlur={(e) => update.mutate({ success_metric: e.target.value || null })}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Baseline at decision time
              <input
                className={field}
                defaultValue={a['baseline_note'] ?? ""}
                onBlur={(e) => update.mutate({ baseline_note: e.target.value || null })}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Evaluation window
              <input
                className={field}
                placeholder="e.g. 30 days after completion"
                defaultValue={a['evaluation_window'] ?? ""}
                onBlur={(e) => update.mutate({ evaluation_window: e.target.value || null })}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Outcome review date
              <input
                type="date"
                className={field}
                defaultValue={a['outcome_review_date'] ?? ""}
                onBlur={(e) => update.mutate({ outcome_review_date: e.target.value || null })}
              />
            </label>
          </div>

          <div className="rounded border border-border p-3">
            <p className="eyebrow mb-2">Outcome review</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                What the measure did
                <select
                  className={field}
                  defaultValue={a['outcome_verdict'] ?? ""}
                  onChange={(e) => update.mutate({ outcome_verdict: e.target.value || null })}
                >
                  <option value="">Not reviewed yet</option>
                  {VERDICTS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Confounding factors present
                <input
                  className={field}
                  placeholder="promotion, holiday, incomplete data…"
                  defaultValue={a['confounders'] ?? ""}
                  onBlur={(e) => update.mutate({ confounders: e.target.value || null })}
                />
              </label>
            </div>
            <label className="mt-3 block text-xs text-muted-foreground">
              Review note
              <textarea
                className={field}
                rows={2}
                defaultValue={a['outcome_note'] ?? ""}
                onBlur={(e) => update.mutate({ outcome_note: e.target.value || null })}
              />
            </label>
            <p className="mt-2 text-[11px] text-warning-foreground">
              A measure moving after an action does not prove the action caused it. Rosy records both, and the
              confounders you list, without claiming causation.
            </p>
          </div>

          <div>
            <p className="eyebrow mb-2">Comments</p>
            {comments.isLoading ? (
              <LoadingRows rows={2} />
            ) : (
              <ul className="space-y-2">
                {(comments.data ?? []).map((c: Record<string, any>) => (
                  <li key={c['id']} className="rounded border border-border p-2 text-xs">
                    <span className="font-medium text-foreground">{c['author_name'] ?? "Someone"}</span>{" "}
                    <span className="text-muted-foreground">
                      {String(c['created_at']).slice(0, 16).replace("T", " ")}
                    </span>
                    <p className="mt-1 text-foreground">{c['body']}</p>
                  </li>
                ))}
                {(comments.data ?? []).length === 0 ? (
                  <li className="text-xs text-muted-foreground">No comments yet.</li>
                ) : null}
              </ul>
            )}
            <div className="mt-2 flex gap-2">
              <input
                className="flex-1 rounded border border-input bg-background px-2 py-1.5 text-sm"
                value={comment}
                placeholder="Add a comment"
                onChange={(e) => setComment(e.target.value)}
              />
              <Button
                size="sm"
                disabled={!comment.trim() || addComment.isPending}
                onClick={() => addComment.mutate()}
              >
                Add
              </Button>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Actions stay internal. Creating or completing one never places an order, changes a menu price, files
            a renewal or launches a campaign.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ActionsPage() {
  const { data: access } = useAccess();
  const filters = useFilters();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: "", why: "", owner: "", due: "", severity: "medium" });

  const allowed = access?.permissions.includes("view_alerts") ?? false;

  const list = useQuery({
    queryKey: ["actions"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rosy_actions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!access?.orgId) throw new Error("No workspace membership");
      const { error } = await supabase.from("rosy_actions").insert({
        org_id: access.orgId,
        title: form.title.trim(),
        why_it_matters: form.why.trim() || null,
        owner_name: form.owner.trim() || null,
        due_date: form.due || null,
        severity: form.severity,
        source_kind: "manual",
        status: form.owner.trim() ? "assigned" : "open",
        evidence: {
          created_from: "manual entry",
          period: `${filters.from} → ${filters.to} (Asia/Dubai)`,
          scope: filters.locations.length ? `${filters.locations.length} venue(s)` : "All granted venues",
          captured_at: new Date().toISOString(),
        },
        created_by: access.userId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setForm({ title: "", why: "", owner: "", due: "", severity: "medium" });
      setShowNew(false);
      qc.invalidateQueries({ queryKey: ["actions"] });
      qc.invalidateQueries({ queryKey: ["brief-decisions"] });
    },
  });

  if (access && !allowed) return <NoPermission what="actions and tasks" />;

  const rows = (list.data ?? []) as Record<string, any>[];
  const open = rows.filter((r) => !["closed", "completed"].includes(String(r['status'])));
  const review = rows.filter((r) => ["completed", "under_review"].includes(String(r['status'])));
  const closed = rows.filter((r) => String(r['status']) === "closed");

  return (
    <>
      <PageHeader
        title="Actions & Outcomes"
        intro="Every action keeps the insight and evidence that produced it, an owner, a due date, an agreed success measure and an honest outcome review."
        actions={
          <Button size="sm" onClick={() => setShowNew((s) => !s)}>
            {showNew ? "Cancel" : "New action"}
          </Button>
        }
      />

      {showNew ? (
        <Section title="New action" description="Actions remain internal until a person acts on them.">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground sm:col-span-2">
              What needs to happen
              <input className={field} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="text-xs text-muted-foreground sm:col-span-2">
              Why it matters
              <textarea
                className={field}
                rows={2}
                value={form.why}
                onChange={(e) => setForm({ ...form, why: e.target.value })}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Owner
              <input className={field} value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
            </label>
            <label className="text-xs text-muted-foreground">
              Due date
              <input
                type="date"
                className={field}
                value={form.due}
                onChange={(e) => setForm({ ...form, due: e.target.value })}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Severity
              <select
                className={field}
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
          </div>
          <Button
            className="mt-3"
            size="sm"
            disabled={!form.title.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Saving…" : "Create action"}
          </Button>
          {create.error ? (
            <p className="mt-2 text-xs text-destructive">{(create.error as Error).message}</p>
          ) : null}
        </Section>
      ) : null}

      <Section title="Open and assigned" description="Sorted newest first. Change status inline.">
        {list.isLoading ? (
          <LoadingRows rows={4} />
        ) : open.length === 0 ? (
          <EmptyState
            title="No open actions"
            description="Create one here, or turn an open alert into an action from Your Rosy Brief."
          />
        ) : (
          <div className="space-y-3">
            {open.map((a) => (
              <ActionCard key={a['id']} a={a} onChanged={() => qc.invalidateQueries({ queryKey: ["actions"] })} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Completed — awaiting outcome review"
        description="Compare the agreed measure against the baseline, and record what else was happening at the time."
      >
        {review.length === 0 ? (
          <EmptyState title="Nothing awaiting review" description="Completed actions appear here for outcome review." />
        ) : (
          <div className="space-y-3">
            {review.map((a) => (
              <ActionCard key={a['id']} a={a} onChanged={() => qc.invalidateQueries({ queryKey: ["actions"] })} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Closed" description="Kept for history — closed actions are never deleted.">
        {closed.length === 0 ? (
          <EmptyState title="Nothing closed yet" description="Resolved actions are listed here with their review notes." />
        ) : (
          <div className="space-y-3">
            {closed.map((a) => (
              <ActionCard key={a['id']} a={a} onChanged={() => qc.invalidateQueries({ queryKey: ["actions"] })} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
