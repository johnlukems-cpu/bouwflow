"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage, guardWrite, type FormState } from "@/lib/actions";
import { getAppContext } from "@/lib/auth/context";
import { isUuid } from "@/lib/data/shared";
import { withFlash } from "@/lib/flash";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/types";
import { formDataToObject, toFieldErrors } from "@/lib/validation/common";
import { projectSchema } from "@/lib/validation/project";

export async function saveProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getAppContext();
  const raw = formDataToObject(formData);
  const blocked = guardWrite(ctx, "projects.write");
  if (blocked) return { ...blocked, values: raw };

  const parsed = projectSchema.safeParse(raw);
  if (!parsed.success) {
    return { message: "Controleer de gemarkeerde velden.", errors: toFieldErrors(parsed.error), values: raw };
  }

  const supabase = await createSupabaseServerClient();
  const orgId = ctx.membership.organization.id;

  // Extra servercontrole: klant moet binnen deze organisatie bestaan en actief zijn.
  // (De samengestelde foreign key in de database dwingt dit ook af.)
  const { data: customer } = await supabase
    .from("customers")
    .select("id, is_archived")
    .eq("id", parsed.data.customer_id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!customer) return { errors: { customer_id: "Kies een bestaande klant" }, values: raw };

  const id = raw.id;
  if (id) {
    if (!isUuid(id)) return { message: "Ongeldig project.", values: raw };
    const { data, error } = await supabase
      .from("projects")
      .update(parsed.data)
      .eq("id", id)
      .eq("organization_id", orgId)
      .select("id")
      .maybeSingle();
    if (error || !data) return { message: dbErrorMessage(error, "Het project kon niet worden opgeslagen."), values: raw };
    revalidatePath("/projecten");
    redirect(withFlash(`/projecten/${id}`, "project-bijgewerkt"));
  }

  if (customer.is_archived) return { errors: { customer_id: "Deze klant is gearchiveerd" }, values: raw };

  const { data, error } = await supabase
    .from("projects")
    .insert({ ...parsed.data, organization_id: orgId, currency_code: ctx.settings.currency_code })
    .select("id")
    .single();
  if (error || !data) return { message: dbErrorMessage(error, "Het project kon niet worden aangemaakt."), values: raw };
  revalidatePath("/projecten");
  redirect(withFlash(`/projecten/${data.id}`, "project-aangemaakt"));
}

export async function setProjectStatus(formData: FormData) {
  const ctx = await getAppContext();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as ProjectStatus;
  if (!isUuid(id) || !PROJECT_STATUSES.includes(status)) redirect("/projecten");
  if (guardWrite(ctx, "projects.write")) redirect(withFlash(`/projecten/${id}`, "demo-alleen-lezen"));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("projects").update({ status }).eq("id", id).eq("organization_id", ctx.membership.organization.id);
  if (error) throw new Error("Status wijzigen is niet gelukt");
  revalidatePath("/projecten");
  redirect(withFlash(`/projecten/${id}`, "status-gewijzigd"));
}

export async function setProjectArchived(formData: FormData) {
  const ctx = await getAppContext();
  const id = String(formData.get("id") ?? "");
  const archive = formData.get("archive") === "true";
  if (!isUuid(id)) redirect("/projecten");
  if (guardWrite(ctx, "projects.write")) redirect(withFlash(`/projecten/${id}`, "demo-alleen-lezen"));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("projects").update({ is_archived: archive }).eq("id", id).eq("organization_id", ctx.membership.organization.id);
  if (error) throw new Error("Archiveren is niet gelukt");
  revalidatePath("/projecten");
  redirect(withFlash(`/projecten/${id}`, archive ? "project-gearchiveerd" : "project-hersteld"));
}
