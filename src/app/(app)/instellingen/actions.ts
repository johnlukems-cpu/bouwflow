"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage, guardWrite, type FormState } from "@/lib/actions";
import { getAppContext } from "@/lib/auth/context";
import { isUuid } from "@/lib/data/shared";
import { withFlash } from "@/lib/flash";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formDataToObject, toFieldErrors } from "@/lib/validation/common";
import { organizationSettingsSchema, taxRateSchema } from "@/lib/validation/settings";

export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getAppContext();
  const raw = formDataToObject(formData);
  const blocked = guardWrite(ctx, "settings.write");
  if (blocked) return { ...blocked, values: raw };

  const parsed = organizationSettingsSchema.safeParse(raw);
  if (!parsed.success) return { message: "Controleer de gemarkeerde velden.", errors: toFieldErrors(parsed.error), values: raw };

  const { org_name, ...settings } = parsed.data;
  const orgId = ctx.membership.organization.id;
  const supabase = await createSupabaseServerClient();

  const { error: orgError } = await supabase.from("organizations").update({ name: org_name }).eq("id", orgId);
  if (orgError) return { message: dbErrorMessage(orgError, "Organisatienaam kon niet worden opgeslagen."), values: raw };

  const { error } = await supabase.from("organization_settings").update(settings).eq("organization_id", orgId);
  if (error) return { message: dbErrorMessage(error, "Instellingen konden niet worden opgeslagen."), values: raw };

  revalidatePath("/", "layout");
  redirect(withFlash("/instellingen", "instellingen-opgeslagen"));
}

export async function addTaxRate(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getAppContext();
  const raw = formDataToObject(formData);
  const blocked = guardWrite(ctx, "tax_rates.write");
  if (blocked) return { ...blocked, values: raw };

  const parsed = taxRateSchema.safeParse(raw);
  if (!parsed.success) return { errors: toFieldErrors(parsed.error), values: raw };

  const orgId = ctx.membership.organization.id;
  const supabase = await createSupabaseServerClient();
  if (parsed.data.is_default) {
    await supabase.from("tax_rates").update({ is_default: false }).eq("organization_id", orgId).eq("is_default", true);
  }
  const { error } = await supabase.from("tax_rates").insert({ ...parsed.data, organization_id: orgId });
  if (error) return { message: dbErrorMessage(error, "Belastingtarief kon niet worden toegevoegd."), values: raw };
  revalidatePath("/instellingen");
  redirect(withFlash("/instellingen", "tarief-toegevoegd"));
}

export async function updateTaxRate(formData: FormData) {
  const ctx = await getAppContext();
  const id = String(formData.get("id") ?? "");
  const op = String(formData.get("op") ?? "");
  if (!isUuid(id) || !["default", "archive", "restore"].includes(op)) redirect("/instellingen");
  if (guardWrite(ctx, "tax_rates.write")) redirect(withFlash("/instellingen", "demo-alleen-lezen"));

  const orgId = ctx.membership.organization.id;
  const supabase = await createSupabaseServerClient();
  if (op === "default") {
    await supabase.from("tax_rates").update({ is_default: false }).eq("organization_id", orgId).eq("is_default", true);
    await supabase.from("tax_rates").update({ is_default: true }).eq("organization_id", orgId).eq("id", id);
  } else {
    await supabase
      .from("tax_rates")
      .update(op === "archive" ? { is_archived: true, is_default: false } : { is_archived: false })
      .eq("organization_id", orgId)
      .eq("id", id);
  }
  revalidatePath("/instellingen");
  redirect(withFlash("/instellingen", "tarief-bijgewerkt"));
}
