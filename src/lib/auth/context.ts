import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAppMode, type AppMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEMO_MEMBERSHIP, DEMO_SETTINGS, DEMO_SUBSCRIPTION, DEMO_USER } from "@/lib/demo/data";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo/business";
import { ALWAYS_AVAILABLE_MODULES, type ModuleKey } from "@/lib/modules";
import { can, isRole, type Permission } from "./permissions";
import type { Membership, OrganizationSettings } from "@/lib/types";

export const ACTIVE_ORG_COOKIE = "bf_org";

export interface AppContext {
  mode: Exclude<AppMode, "unconfigured">;
  user: { id: string; email: string | null; name: string };
  memberships: Membership[];
  /** Actieve organisatie + rol, door de server gevalideerd. */
  membership: Membership;
  settings: OrganizationSettings;
  subscription: SubscriptionInfo;
  /** Gekoppelde medewerker van de ingelogde gebruiker (voor eigen uren/werkbonnen). */
  employeeId: string | null;
  isPlatformAdmin: boolean;
}

export interface SubscriptionInfo {
  planCode: string;
  planName: string;
  status: "trialing" | "active" | "past_due" | "suspended" | "cancelled";
  trialEndsAt: string | null;
  modules: string[];
  maxUsers: number | null;
  /** Mag de organisatie gegevens wijzigen (actief abonnement of lopende proef)? */
  writable: boolean;
}

export function hasModule(ctx: AppContext, module: ModuleKey): boolean {
  return ALWAYS_AVAILABLE_MODULES.includes(module) || ctx.subscription.modules.includes(module);
}

/** Lijst van modules die voor deze organisatie beschikbaar zijn. */
export function enabledModules(ctx: AppContext): string[] {
  return [...ALWAYS_AVAILABLE_MODULES, ...ctx.subscription.modules];
}

export class PermissionError extends Error {}

/**
 * Bepaalt de ingelogde gebruiker en de actieve organisatie. De actieve
 * organisatie uit de cookie wordt ALTIJD gecontroleerd tegen de eigen
 * lidmaatschappen; een gemanipuleerde cookie levert dus nooit toegang op
 * (RLS zou dat bovendien in de database blokkeren).
 */
export const getAppContext = cache(async (): Promise<AppContext> => {
  // Altijd dynamisch renderen: de context is per verzoek/gebruiker.
  const cookieStore = await cookies();
  const mode = getAppMode();
  if (mode === "unconfigured") redirect("/installatie");
  if (mode === "demo") {
    return {
      mode,
      user: DEMO_USER,
      memberships: [DEMO_MEMBERSHIP],
      membership: DEMO_MEMBERSHIP,
      settings: DEMO_SETTINGS,
      subscription: DEMO_SUBSCRIPTION,
      employeeId: DEMO_EMPLOYEE_ID,
      isPlatformAdmin: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: rows, error } = await supabase
    .from("organization_members")
    .select("id, role, organization:organizations(id, name)")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .order("created_at");
  if (error) throw new Error(`Lidmaatschappen konden niet worden geladen: ${error.message}`);

  const memberships: Membership[] = (rows ?? []).flatMap((r) => {
    const org = Array.isArray(r.organization) ? r.organization[0] : r.organization;
    return org && isRole(r.role) ? [{ id: r.id as string, role: r.role, organization: { id: org.id as string, name: org.name as string } }] : [];
  });
  if (memberships.length === 0) redirect("/onboarding");

  const cookieOrg = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  const membership = memberships.find((m) => m.organization.id === cookieOrg) ?? memberships[0];

  const { data: settings, error: settingsError } = await supabase
    .from("organization_settings")
    .select("*")
    .eq("organization_id", membership.organization.id)
    .single();
  if (settingsError || !settings) throw new Error("Organisatie-instellingen ontbreken");

  const orgId = membership.organization.id;
  const [{ data: profile }, { data: sub }, { data: employee }, { data: platformAdmin }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle(),
    supabase
      .from("organization_subscriptions")
      .select("plan_code, status, trial_ends_at, max_users_override, plan:subscription_plans(name, modules, max_users)")
      .eq("organization_id", orgId)
      .maybeSingle(),
    supabase.from("employees").select("id").eq("organization_id", orgId).eq("member_id", membership.id).eq("is_active", true).maybeSingle(),
    supabase.rpc("is_platform_admin"),
  ]);
  const plan = (Array.isArray(sub?.plan) ? sub?.plan[0] : sub?.plan) as { name: string; modules: string[]; max_users: number | null } | null | undefined;
  const status = (sub?.status ?? "suspended") as SubscriptionInfo["status"];
  const trialEndsAt = (sub?.trial_ends_at as string | null) ?? null;
  const subscription: SubscriptionInfo = {
    planCode: (sub?.plan_code as string) ?? "onbekend",
    planName: plan?.name ?? "Geen abonnement",
    status,
    trialEndsAt,
    modules: plan?.modules ?? [],
    maxUsers: (sub?.max_users_override as number | null) ?? plan?.max_users ?? null,
    // Spiegelt public.org_is_writable() in de database (die blijft leidend).
    writable: status === "active" || status === "past_due" || (status === "trialing" && (!trialEndsAt || new Date(trialEndsAt) > new Date())),
  };

  return {
    mode,
    user: { id: auth.user.id, email: auth.user.email ?? null, name: profile?.full_name || auth.user.email || "Gebruiker" },
    memberships,
    membership,
    settings: settings as OrganizationSettings,
    subscription,
    employeeId: (employee?.id as string | undefined) ?? null,
    isPlatformAdmin: platformAdmin === true,
  };
});

/** Gooit een PermissionError als de rol de actie niet toestaat (server-side). */
export function assertPermission(ctx: AppContext, permission: Permission) {
  if (!can(ctx.membership.role, permission)) {
    throw new PermissionError("U heeft geen rechten voor deze actie.");
  }
}
