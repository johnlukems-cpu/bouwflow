"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ACTIVE_ORG_COOKIE, getAppContext } from "@/lib/auth/context";
import { getAppMode, getSiteUrl } from "@/lib/env";
import { withFlash } from "@/lib/flash";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formDataToObject, toFieldErrors, type FieldErrors } from "@/lib/validation/common";

export interface AuthFormState {
  message?: string;
  info?: string;
  errors?: FieldErrors;
  values?: Record<string, string>;
}

function requireSupabaseMode(): AuthFormState | null {
  if (getAppMode() !== "supabase") {
    return { message: "Supabase is nog niet gekoppeld. Inloggen is beschikbaar zodra de verbinding is ingesteld (zie README)." };
  }
  return null;
}

const loginSchema = z.object({
  email: z.email("Vul een geldig e-mailadres in"),
  password: z.string().min(1, "Vul uw wachtwoord in"),
});

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const blocked = requireSupabaseMode();
  if (blocked) return blocked;
  const raw = formDataToObject(formData);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { errors: toFieldErrors(parsed.error), values: { email: raw.email ?? "" } };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Bewust generiek: geen onderscheid tussen onbekend e-mailadres en fout wachtwoord.
    return {
      message: error.code === "email_not_confirmed" ? "Bevestig eerst uw e-mailadres via de link in uw mailbox." : "Onjuist e-mailadres of wachtwoord.",
      values: { email: parsed.data.email },
    };
  }
  redirect(safeRedirectPath(raw.volgende));
}

const signUpSchema = z.object({
  full_name: z.string().trim().min(2, "Vul uw naam in").max(200),
  email: z.email("Vul een geldig e-mailadres in"),
  password: z
    .string()
    .min(10, "Gebruik minimaal 10 tekens")
    .max(72, "Gebruik maximaal 72 tekens")
    .regex(/[a-zA-Z]/, "Gebruik minimaal één letter")
    .regex(/[0-9]/, "Gebruik minimaal één cijfer"),
});

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const blocked = requireSupabaseMode();
  if (blocked) return blocked;
  const raw = formDataToObject(formData);
  const parsed = signUpSchema.safeParse(raw);
  const values = { full_name: raw.full_name ?? "", email: raw.email ?? "" };
  if (!parsed.success) return { errors: toFieldErrors(parsed.error), values };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${getSiteUrl()}/auth/callback?volgende=/onboarding`,
    },
  });
  if (error) {
    return { message: error.code === "weak_password" ? "Dit wachtwoord is te zwak." : "Registreren is niet gelukt. Probeer het later opnieuw.", values };
  }
  if (data.session) redirect("/onboarding");
  return { info: "Controleer uw e-mail en klik op de bevestigingslink om uw account te activeren." };
}

export async function signOut() {
  if (getAppMode() === "supabase") {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  (await cookies()).delete(ACTIVE_ORG_COOKIE);
  redirect("/login");
}

/** Wisselt de actieve organisatie — alleen naar een organisatie waarvan de gebruiker lid is. */
export async function switchOrganization(formData: FormData) {
  const ctx = await getAppContext();
  const target = String(formData.get("organization_id") ?? "");
  const membership = ctx.memberships.find((m) => m.organization.id === target);
  if (!membership) redirect("/dashboard");
  (await cookies()).set(ACTIVE_ORG_COOKIE, membership.organization.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(withFlash("/dashboard", "organisatie-gewisseld"));
}

const orgSchema = z.object({ name: z.string().trim().min(2, "Vul een bedrijfsnaam in (minimaal 2 tekens)").max(200) });

export async function createOrganization(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const blocked = requireSupabaseMode();
  if (blocked) return blocked;
  const raw = formDataToObject(formData);
  const parsed = orgSchema.safeParse(raw);
  if (!parsed.success) return { errors: toFieldErrors(parsed.error), values: { name: raw.name ?? "" } };

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data, error } = await supabase.rpc("create_organization", { org_name: parsed.data.name });
  if (error || !data) {
    return { message: error?.code === "54000" ? "U heeft het maximale aantal organisaties bereikt." : "De organisatie kon niet worden aangemaakt.", values: { name: parsed.data.name } };
  }
  (await cookies()).set(ACTIVE_ORG_COOKIE, String(data), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(withFlash("/dashboard", "welkom"));
}
