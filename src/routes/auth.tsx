import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Rosy AI" },
      {
        name: "description",
        content:
          "Secure sign-in for Rosy AI, the multi-restaurant intelligence platform for Rosy Hospitality.",
      },
      { property: "og:title", content: "Sign in — Rosy AI" },
      { property: "og:description", content: "Secure, invite-based access to Rosy AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

/**
 * Demonstration sign-ins for the private client demo. These accounts exist only
 * in the clearly labelled demo workspace, hold no real personal data, and each
 * one is limited by the same database-level grants as a production account.
 */
const DEMO_PASSWORD = "RosyDemo2026!";
const DEMO_ACCOUNTS = [
  { label: "Leadership", scope: "All demo venues", email: "leadership@rosy-demo.app" },
  { label: "Investor", scope: "Demo Investor A holdings only", email: "investor@rosy-demo.app" },
  { label: "Marketing", scope: "CQ French Brasserie brand only", email: "marketing@rosy-demo.app" },
  { label: "HR / PRO", scope: "People and renewals", email: "hr@rosy-demo.app" },
] as const;

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/overview", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        navigate({ to: "/overview", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (err) throw err;
        if (!data.session) {
          setMessage("Check your email to confirm the account, then sign in.");
        }
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (err) throw err;
        setMessage("If that address has an account, a reset link is on its way.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function demoSignIn(demoEmail: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: demoEmail,
      password: DEMO_PASSWORD,
    });
    if (err) setError("That demonstration account is not available. Please try another role.");
    setBusy(false);
  }

  async function google() {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("Google sign-in could not be started. Please try email and password.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/overview", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="page-title text-3xl text-primary">Rosy AI</p>
          <p className="mt-1 text-sm text-muted-foreground">A clearer view of every restaurant</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h1 className="text-lg font-semibold text-foreground">
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create your access" : "Reset password"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            One secure sign-in for every workspace. What you can see is decided by the grants on your
            account, not by which form you use.
          </p>

          <form className="mt-5 space-y-4" onSubmit={submit}>
            <div>
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {mode !== "reset" ? (
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            ) : null}

            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="rounded-md border border-positive/30 bg-positive/10 p-2 text-xs text-positive">
                {message}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "signin" ? "Sign in" : mode === "signup" ? "Create access" : "Send reset link"}
            </Button>
          </form>

          {mode !== "reset" ? (
            <>
              <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>
              <Button variant="outline" className="w-full" onClick={google} type="button">
                Continue with Google
              </Button>
            </>
          ) : null}

          <div className="mt-5 flex flex-wrap justify-between gap-2 text-xs">
            <button
              type="button"
              className="text-primary underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Need access? Create an account" : "Already have access? Sign in"}
            </button>
            <button type="button" className="text-muted-foreground underline" onClick={() => setMode("reset")}>
              Forgot password
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">Demo access</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sign in as any role to explore the demonstration workspace. Password for all four accounts:{" "}
            <span className="num font-semibold text-foreground">{DEMO_PASSWORD}</span>
          </p>
          <div className="mt-3 space-y-1.5">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                disabled={busy}
                onClick={() => demoSignIn(acc.email)}
                className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-left text-xs transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60"
              >
                <span>
                  <span className="block font-semibold text-foreground">{acc.label}</span>
                  <span className="block text-muted-foreground">{acc.scope}</span>
                </span>
                <span className="num shrink-0 text-[11px] text-muted-foreground">{acc.email}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            This demonstration uses sample data for illustration purposes. No live restaurant, payroll,
            guest or banking system is connected.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          New accounts join the demo workspace with synthetic data only. Production access is
          invite-based and granted per legal entity, brand, venue or investor.
        </p>
      </div>
    </main>
  );
}
