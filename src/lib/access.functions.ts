import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ROLE_PRESETS = [
  { value: "leadership", label: "Leadership" },
  { value: "finance", label: "Finance" },
  { value: "investor_relations", label: "Investor relations / valuation approver" },
  { value: "restaurant_manager", label: "Restaurant manager (single venue)" },
  { value: "inventory_procurement", label: "Inventory / procurement" },
  { value: "marketing", label: "Marketing" },
  { value: "hr_pro", label: "HR / People / PRO" },
  { value: "investor", label: "Investor" },
  { value: "tech_admin", label: "Technical administrator" },
] as const;

export type RolePreset = (typeof ROLE_PRESETS)[number]["value"];

export type AccessSnapshot = {
  userId: string;
  email: string | null;
  displayName: string | null;
  orgId: string | null;
  orgName: string | null;
  isDemo: boolean;
  role: RolePreset | null;
  permissions: string[];
  locations: {
    id: string;
    name: string;
    brand: string | null;
    timezone: string;
    cutoff: string;
    openedOn: string | null;
    manager: string | null;
  }[];
  scopeSummary: string;
};

const SCOPE_BY_ROLE: Record<string, { scope_type: string; ref: string | null }[]> = {
  // Demo scope presets. Real deployments assign these through the access screen.
  leadership: [{ scope_type: "all", ref: null }],
  finance: [{ scope_type: "all", ref: null }],
  investor_relations: [{ scope_type: "all", ref: null }],
  tech_admin: [{ scope_type: "all", ref: null }],
  restaurant_manager: [
    { scope_type: "location", ref: "00000000-0000-4000-8000-000000000031" },
  ],
  inventory_procurement: [
    { scope_type: "location", ref: "00000000-0000-4000-8000-000000000031" },
    { scope_type: "location", ref: "00000000-0000-4000-8000-000000000033" },
  ],
  marketing: [{ scope_type: "brand", ref: "00000000-0000-4000-8000-000000000021" }],
  hr_pro: [{ scope_type: "all", ref: null }],
  investor: [{ scope_type: "investor", ref: "00000000-0000-4000-8000-000000000041" }],
};

const SCOPE_SUMMARY: Record<string, string> = {
  leadership: "All demo venues",
  finance: "All demo venues",
  investor_relations: "All demo entities",
  tech_admin: "Provisioning and integration health only",
  restaurant_manager: "CQ French Brasserie — JLT only",
  inventory_procurement: "CQ JLT and Butter by the Dozen only",
  marketing: "CQ French Brasserie brand only",
  hr_pro: "All demo venues (people data)",
  investor: "Demo Investor A holdings only",
};

async function readSnapshot(
  supabase: { from: (t: string) => any; rpc?: unknown },
  userId: string,
  email: string | null,
): Promise<AccessSnapshot> {
  const { data: membership } = await supabase
    .from("memberships")
    .select("id, org_id, role_preset, organizations(name, is_demo)")
    .eq("user_id", userId)
    .maybeSingle();

  const role = (membership?.role_preset ?? null) as RolePreset | null;

  const { data: perms } = role
    ? await supabase.from("role_permissions").select("permission").eq("role_preset", role)
    : { data: [] as { permission: string }[] };

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, timezone, business_day_cutoff, opened_on, manager_name, brands(name)")
    .order("name");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  return {
    userId,
    email,
    displayName: profile?.display_name ?? null,
    orgId: membership?.org_id ?? null,
    orgName: membership?.organizations?.name ?? null,
    isDemo: Boolean(membership?.organizations?.is_demo),
    role,
    permissions: (perms ?? []).map((p: { permission: string }) => p.permission),
    locations: (locations ?? []).map((l: Record<string, any>) => ({
      id: l['id'] as string,
      name: l['name'] as string,
      brand: (l['brands']?.name as string) ?? null,
      timezone: l['timezone'] as string,
      cutoff: l['business_day_cutoff'] as string,
      openedOn: (l['opened_on'] as string) ?? null,
      manager: (l['manager_name'] as string) ?? null,
    })),
    scopeSummary: role ? (SCOPE_SUMMARY[role] ?? "Scoped access") : "No access granted",
  };
}

/**
 * Idempotent first-sign-in provisioning into the demo workspace, then reads the
 * access snapshot back through the user's own (row-level-secured) session.
 */
export const getAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const email = (context.claims as { email?: string } | null)?.email ?? null;

    await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: userId, email, display_name: email ? (email.split("@")[0] ?? "Rosy user") : "Rosy user" },
        { onConflict: "id" },
      );

    const { data: demoOrg } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("is_demo", true)
      .limit(1)
      .maybeSingle();

    if (demoOrg) {
      const { data: existing } = await supabaseAdmin
        .from("memberships")
        .select("id")
        .eq("user_id", userId)
        .eq("org_id", demoOrg.id)
        .maybeSingle();

      if (!existing) {
        const { data: created } = await supabaseAdmin
          .from("memberships")
          .insert({ org_id: demoOrg.id, user_id: userId, role_preset: "leadership" })
          .select("id")
          .single();
        if (created) {
          await supabaseAdmin
            .from("scope_grants")
            .insert({ membership_id: created.id, org_id: demoOrg.id, scope_type: "all" });
          await supabaseAdmin.from("audit_events").insert({
            org_id: demoOrg.id,
            actor: userId,
            action: "demo_workspace_provisioned",
            target: "membership",
            detail: { role_preset: "leadership" },
          });
        }
      }
    }

    return readSnapshot(context.supabase, userId, email);
  });

/**
 * Demo-only role preview. Rejected unless the workspace is flagged as demo, so
 * it can never become a production authorization bypass.
 */
export const setDemoRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { role: string }) => {
    if (!ROLE_PRESETS.some((r) => r.value === input.role)) throw new Error("Unknown role preset");
    return { role: input.role };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: membership } = await supabaseAdmin
      .from("memberships")
      .select("id, org_id, organizations(is_demo)")
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) throw new Error("No workspace membership found");
    if (!membership.organizations?.is_demo) {
      throw new Error("Role preview is available in demo workspaces only");
    }

    await supabaseAdmin
      .from("memberships")
      .update({ role_preset: data.role as RolePreset })
      .eq("id", membership.id);

    await supabaseAdmin.from("scope_grants").delete().eq("membership_id", membership.id);
    const scopes = SCOPE_BY_ROLE[data.role] ?? [{ scope_type: "all", ref: null }];
    await supabaseAdmin.from("scope_grants").insert(
      scopes.map((s) => ({
        membership_id: membership.id,
        org_id: membership.org_id,
        scope_type: s.scope_type,
        ref_id: s.ref,
      })),
    );

    await supabaseAdmin.from("audit_events").insert({
      org_id: membership.org_id,
      actor: userId,
      action: "demo_role_preview_changed",
      target: "membership",
      detail: { role_preset: data.role },
    });

    const email = (context.claims as { email?: string } | null)?.email ?? null;
    return readSnapshot(context.supabase, userId, email);
  });
