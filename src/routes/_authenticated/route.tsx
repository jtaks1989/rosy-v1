import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/rosy/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  validateSearch: (search: {
    from?: string;
    to?: string;
    loc?: string;
    cmp?: string;
  }): { from?: string; to?: string; loc?: string; cmp?: string } => {
    const str = (v: unknown) => (typeof v === "string" && v.length ? v : undefined);
    return {
      ...(str(search.from) ? { from: search.from } : {}),
      ...(str(search.to) ? { to: search.to } : {}),
      ...(str(search.loc) ? { loc: search.loc } : {}),
      ...(str(search.cmp) ? { cmp: search.cmp } : {}),
    };
  },
  beforeLoad: async () => {
    // getSession reads the locally stored session, so navigating between pages does
    // not wait on a network round-trip the way getUser() did.
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
