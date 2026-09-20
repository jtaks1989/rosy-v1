import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Rosy AI" },
      { name: "description", content: "Choose a new password for your Rosy AI account." },
      { property: "og:title", content: "Set a new password — Rosy AI" },
      { property: "og:description", content: "Choose a new password for your Rosy AI account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/overview", replace: true }), 1200);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <p className="page-title text-2xl text-primary">Rosy AI</p>
        <h1 className="mt-3 text-lg font-semibold">Set a new password</h1>
        {done ? (
          <p className="mt-3 text-sm text-positive">Password updated. Taking you to Rosy AI…</p>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={submit}>
            <div>
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              Update password
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
