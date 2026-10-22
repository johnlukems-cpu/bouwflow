import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAppMode, type AppMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEMO_MEMBERSHIP, DEMO_SETTINGS, DEMO_USER } from "@/lib/demo/data";
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
    return { mode, user: DEMO_USER, memberships: [DEMO_MEMBERSHIP], membership: DEMO_MEMBERSHIP, settings: DEMO_SETTINGS };
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

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle();

  return {
    mode,
    user: { id: auth.user.id, email: auth.user.email ?? null, name: profile?.full_name || auth.user.email || "Gebruiker" },
    memberships,
    membership,
    settings: settings as OrganizationSettings,
  };
});

/** Gooit een PermissionError als de rol de actie niet toestaat (server-side). */
export function assertPermission(ctx: AppContext, permission: Permission) {
  if (!can(ctx.membership.role, permission)) {
    throw new PermissionError("U heeft geen rechten voor deze actie.");
  }
}
