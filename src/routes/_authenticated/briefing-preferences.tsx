import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-access";
import {
  EmptyState,
  LoadingRows,
  PageHeader,
  Section,
  StatusChip,
} from "@/components/rosy/primitives";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/briefing-preferences")({
  head: () => ({
    meta: [
      { title: "Briefing preferences — Rosy AI" },
      {
        name: "description",
        content:
          "Choose when your Rosy Brief arrives, which venues and topics it covers, how detailed it is, and in which language.",
      },
      { property: "og:title", content: "Briefing preferences — Rosy AI" },
      { property: "og:description", content: "Frequency, time, venues, topics, format, language and quiet hours." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PreferencesPage,
});

const TOPICS = [
  { value: "sales", label: "Sales and channels" },
  { value: "menu", label: "Menu contribution" },
  { value: "inventory", label: "Stock risk and waste" },
  { value: "guests", label: "Guests and reservations" },
  { value: "people", label: "Document renewals" },
  { value: "investor", label: "Investor holdings" },
  { value: "actions", label: "Outstanding actions" },
];

const field =
  "mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

type Prefs = {
  daily_enabled: boolean;
  weekly_enabled: boolean;
  monthly_enabled: boolean;
  delivery_time: string;
  timezone: string;
  locations: string[];
  topics: string[];
  detail_level: string;
  language: string;
  channels: string[];
  quiet_from: string | null;
  quiet_to: string | null;
  paused: boolean;
};

const DEFAULTS: Prefs = {
  daily_enabled: true,
  weekly_enabled: false,
  monthly_enabled: false,
  delivery_time: "09:00",
  timezone: "Asia/Dubai",
  locations: [],
  topics: ["sales", "menu", "inventory", "guests", "actions"],
  detail_level: "concise",
  language: "en",
  channels: ["in_app"],
  quiet_from: null,
  quiet_to: null,
  paused: false,
};

function PreferencesPage() {
  const { data: access } = useAccess();
  const qc = useQueryClient();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ["briefing-preferences"],
    enabled: Boolean(access),
    queryFn: async () => {
      const { data, error } = await supabase.from("briefing_preferences").select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  useEffect(() => {
    const d = existing.data as Record<string, any> | null | undefined;
    if (!d) return;
    setPrefs({
      daily_enabled: d['daily_enabled'],
      weekly_enabled: d['weekly_enabled'],
      monthly_enabled: d['monthly_enabled'],
      delivery_time: String(d['delivery_time']).slice(0, 5),
      timezone: d['timezone'],
      locations: d['locations'] ?? [],
      topics: d['topics'] ?? [],
      detail_level: d['detail_level'],
      language: d['language'],
      channels: d['channels'] ?? ["in_app"],
      quiet_from: d['quiet_from'] ? String(d['quiet_from']).slice(0, 5) : null,
      quiet_to: d['quiet_to'] ? String(d['quiet_to']).slice(0, 5) : null,
      paused: d['paused'],
    });
  }, [existing.data]);

  const snapshots = useQuery({
    queryKey: ["brief-snapshots"],
    enabled: Boolean(access),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("briefing_snapshots")
        .select("id, generated_at, period_from, period_to, scope_label, completeness, delivery_status")
        .order("generated_at", { ascending: false })
        .limit(12);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!access?.orgId) throw new Error("No workspace membership");
      const payload = {
        org_id: access.orgId,
        user_id: access.userId,
        ...prefs,
        quiet_from: prefs.quiet_from || null,
        quiet_to: prefs.quiet_to || null,
      };
      const { error } = await supabase
        .from("briefing_preferences")
        .upsert(payload as never, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setSavedAt(new Date().toISOString().slice(0, 16).replace("T", " "));
      qc.invalidateQueries({ queryKey: ["briefing-preferences"] });
    },
  });

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

  return (
    <>
      <PageHeader
        title="Briefing preferences"
        intro="Your Rosy Brief follows your own permissions. Before every scheduled send, access is rechecked — if a grant has been removed, the briefing is suppressed rather than sent."
        actions={
          <StatusChip tone="muted">Email &amp; WhatsApp: delivery channel not connected</StatusChip>
        }
      />

      <Section title="Schedule" description="Daily delivery defaults to 9:00 AM Asia/Dubai and is yours to change.">
        {existing.isLoading ? (
          <LoadingRows rows={3} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <fieldset className="text-xs text-muted-foreground">
                <legend className="mb-1">Frequency</legend>
                {(
                  [
                    ["daily_enabled", "Daily"],
                    ["weekly_enabled", "Weekly"],
                    ["monthly_enabled", "Monthly"],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="mt-1 flex items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      checked={prefs[k]}
                      onCheckedChange={() => setPrefs({ ...prefs, [k]: !prefs[k] })}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>

              <label className="text-xs text-muted-foreground">
                Delivery time
                <input
                  type="time"
                  className={field}
                  value={prefs.delivery_time}
                  onChange={(e) => setPrefs({ ...prefs, delivery_time: e.target.value })}
                />
              </label>

              <label className="text-xs text-muted-foreground">
                Timezone
                <select
                  className={field}
                  value={prefs.timezone}
                  onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })}
                >
                  <option value="Asia/Dubai">Asia/Dubai</option>
                  <option value="Asia/Riyadh">Asia/Riyadh</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="UTC">UTC</option>
                </select>
              </label>

              <label className="text-xs text-muted-foreground">
                Format
                <select
                  className={field}
                  value={prefs.detail_level}
                  onChange={(e) => setPrefs({ ...prefs, detail_level: e.target.value })}
                >
                  <option value="concise">Concise</option>
                  <option value="detailed">Detailed</option>
                </select>
              </label>

              <label className="text-xs text-muted-foreground">
                Language
                <select
                  className={field}
                  value={prefs.language}
                  onChange={(e) => setPrefs({ ...prefs, language: e.target.value })}
                >
                  <option value="en">English</option>
                  <option value="ar">العربية (Arabic)</option>
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">
                  Quiet from
                  <input
                    type="time"
                    className={field}
                    value={prefs.quiet_from ?? ""}
                    onChange={(e) => setPrefs({ ...prefs, quiet_from: e.target.value || null })}
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Quiet to
                  <input
                    type="time"
                    className={field}
                    value={prefs.quiet_to ?? ""}
                    onChange={(e) => setPrefs({ ...prefs, quiet_to: e.target.value || null })}
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <p className="eyebrow mb-2">Venues (within your granted scope)</p>
                <div className="space-y-2">
                  {(access?.locations ?? []).map((l) => (
                    <label key={l.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={prefs.locations.includes(l.id)}
                        onCheckedChange={() => setPrefs({ ...prefs, locations: toggle(prefs.locations, l.id) })}
                      />
                      {l.name}
                    </label>
                  ))}
                  {(access?.locations ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No venue scope granted.</p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    Leave all unticked to cover every venue you are granted at the time of sending.
                  </p>
                </div>
              </div>

              <div>
                <p className="eyebrow mb-2">Topics</p>
                <div className="space-y-2">
                  {TOPICS.map((t) => (
                    <label key={t.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={prefs.topics.includes(t.value)}
                        onCheckedChange={() => setPrefs({ ...prefs, topics: toggle(prefs.topics, t.value) })}
                      />
                      {t.label}
                    </label>
                  ))}
                  <p className="text-[11px] text-muted-foreground">
                    A topic you are not permitted to see stays out of the briefing even if it is ticked here.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <p className="eyebrow mb-2">Delivery channels</p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked disabled />
                  In-app (available)
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={prefs.channels.includes("email")}
                    onCheckedChange={() => setPrefs({ ...prefs, channels: toggle(prefs.channels, "email") })}
                  />
                  Email — delivery channel not connected
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={prefs.channels.includes("whatsapp")}
                    onCheckedChange={() => setPrefs({ ...prefs, channels: toggle(prefs.channels, "whatsapp") })}
                  />
                  WhatsApp — delivery channel not connected
                </label>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Requesting a channel records your choice only. Nothing is sent and no delivery is simulated until a
                verified provider and recipient opt-in exist. Sensitive investor or people content would then be sent
                as a generic notice with a sign-in link, never in the message body.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save preferences"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPrefs({ ...prefs, paused: !prefs.paused });
                }}
              >
                {prefs.paused ? "Resume briefings" : "Pause briefings"}
              </Button>
              {prefs.paused ? <StatusChip tone="warning">Paused</StatusChip> : null}
              {savedAt ? (
                <span className="text-xs text-muted-foreground">Saved {savedAt}</span>
              ) : null}
              {save.error ? <span className="text-xs text-destructive">{(save.error as Error).message}</span> : null}
            </div>
          </>
        )}
      </Section>

      <Section title="Past briefings" description="A dated snapshot keeps exactly what was reported at the time.">
        {snapshots.isLoading ? (
          <LoadingRows rows={2} />
        ) : (snapshots.data ?? []).length === 0 ? (
          <EmptyState
            title="No snapshots yet"
            description="Open Your Rosy Brief and choose “Save dated snapshot” to keep a record of what was reported."
          />
        ) : (
          <ul className="divide-y divide-border">
            {((snapshots.data ?? []) as Record<string, any>[]).map((s) => (
              <li key={s['id']} className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs">
                <span className="num text-foreground">
                  {String(s['generated_at']).slice(0, 16).replace("T", " ")}
                </span>
                <span className="num text-muted-foreground">
                  {s['period_from']} → {s['period_to']}
                </span>
                <span className="text-muted-foreground">{s['scope_label']}</span>
                <StatusChip tone={s['completeness'] === "reconciled" ? "positive" : "warning"}>
                  {s['completeness']}
                </StatusChip>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
