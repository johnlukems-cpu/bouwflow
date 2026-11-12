"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage, guardWrite, guardWriteOrRedirect, type FormState } from "@/lib/actions";
import { getAppContext } from "@/lib/auth/context";
import { isUuid } from "@/lib/data/shared";
import { withFlash } from "@/lib/flash";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/types";
import { formDataToObject, toFieldErrors } from "@/lib/validation/common";
import { projectSchema } from "@/lib/validation/project";
import { costEntrySchema, estimateLineSchema, taskSchema } from "@/lib/validation/modules";
import { getMaterial } from "@/lib/data/resources";
import { runRpc, saveEntity, setErrorFlash } from "@/lib/save";

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

// ---------------------------------------------------------------------------
// Calculatie, planning, kosten en workflowstappen vanuit het project
// ---------------------------------------------------------------------------

const tabUrl = (projectId: string, tab: string) => `/projecten/${projectId}?tab=${tab}`;

export async function addEstimateLine(_prev: FormState, formData: FormData): Promise<FormState> {
  const projectId = String(formData.get("project_id") ?? "");
  // Materiaal gekozen en prijzen leeg? Neem gegevens uit de bibliotheek over.
  const materialId = String(formData.get("material_id") ?? "");
  if (isUuid(materialId)) {
    const ctx = await getAppContext();
    const m = await getMaterial(ctx, materialId);
    if (m) {
      const fill = (k: string, v: string) => {
        if (!String(formData.get(k) ?? "").trim()) formData.set(k, v);
      };
      fill("description", m.description);
      fill("unit", m.unit);
      fill("unit_cost", m.cost_price);
      fill("unit_price", m.sale_price);
      fill("waste_percent", m.waste_percent);
      fill("category", m.category);
      formData.set("article_number_hidden", m.article_number);
    }
  }
  const article = String(formData.get("article_number_hidden") ?? "") || null;
  return saveEntity({
    table: "project_estimate_lines",
    schema: estimateLineSchema,
    permission: "estimate.write",
    module: "calculatie",
    formData,
    extra: { project_id: projectId, article_number: article },
    redirectTo: () => tabUrl(projectId, "calculatie"),
    flash: "opgeslagen",
    revalidate: [`/projecten/${projectId}`],
  });
}

export async function deleteEstimateLine(formData: FormData) {
  const ctx = await getAppContext();
  const projectId = String(formData.get("project_id") ?? "");
  const lineId = String(formData.get("line_id") ?? "");
  const back = tabUrl(projectId, "calculatie");
  guardWriteOrRedirect(ctx, "estimate.write", back, "calculatie");
  if (!isUuid(lineId)) redirect(back);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("project_estimate_lines").delete().eq("id", lineId).eq("organization_id", ctx.membership.organization.id);
  if (error) await setErrorFlash(dbErrorMessage(error, "Verwijderen is niet gelukt."));
  revalidatePath(`/projecten/${projectId}`);
  redirect(withFlash(back, error ? "actie-mislukt" : "verwijderd"));
}

/** Neemt de calculatietotalen over als begroot budget en verkoopwaarde (alleen zolang er geen geaccepteerde offerte is). */
export async function applyEstimateToProject(formData: FormData) {
  const ctx = await getAppContext();
  const projectId = String(formData.get("project_id") ?? "");
  const back = tabUrl(projectId, "calculatie");
  guardWriteOrRedirect(ctx, "projects.write", back);
  if (!isUuid(projectId)) redirect("/projecten");
  const supabase = await createSupabaseServerClient();
  const { data: fin } = await supabase.from("project_financials").select("budget_cost_total, budget_sale_total").eq("project_id", projectId).maybeSingle();
  if (!fin) redirect(back);
  const { error } = await supabase
    .from("projects")
    .update({ budget_amount: String(fin.budget_cost_total), contract_value: String(fin.budget_sale_total) })
    .eq("id", projectId)
    .eq("organization_id", ctx.membership.organization.id);
  if (error) await setErrorFlash(dbErrorMessage(error, "Overnemen is niet gelukt."));
  revalidatePath(`/projecten/${projectId}`);
  redirect(withFlash(back, error ? "actie-mislukt" : "opgeslagen"));
}

export async function createQuoteFromEstimate(formData: FormData) {
  const projectId = String(formData.get("project_id") ?? "");
  const mode = formData.get("mode") === "line" ? "line" : "type";
  await runRpc({
    fn: "create_quote_from_estimate",
    args: { p_id: projectId, group_mode: mode, quote_title: String(formData.get("title") ?? "") },
    permission: "quotes.write",
    module: "offertes",
    backTo: tabUrl(projectId, "calculatie"),
    successTo: (id) => `/offertes/${id}`,
    flash: "aangemaakt",
    revalidate: ["/offertes"],
  });
}

export async function saveTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const projectId = String(formData.get("project_id") ?? "");
  const back = String(formData.get("back") ?? "") === "planning" ? "/planning" : tabUrl(projectId, "planning");
  return saveEntity({
    table: "project_tasks",
    schema: taskSchema,
    permission: "tasks.write",
    module: "planning",
    formData,
    redirectTo: () => back,
    revalidate: [`/projecten/${projectId}`, "/planning"],
  });
}

export async function setTaskStatus(formData: FormData) {
  const ctx = await getAppContext();
  const taskId = String(formData.get("task_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const back = String(formData.get("back") ?? "/planning");
  const safeBack = back.startsWith("/") && !back.startsWith("//") ? back : "/planning";
  guardWriteOrRedirect(ctx, "tasks.write", safeBack, "planning");
  if (!isUuid(taskId) || !["todo", "in_progress", "done", "cancelled"].includes(status)) redirect(safeBack);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("project_tasks").update({ status }).eq("id", taskId).eq("organization_id", ctx.membership.organization.id);
  if (error) await setErrorFlash(dbErrorMessage(error, "Bijwerken is niet gelukt."));
  revalidatePath("/planning");
  redirect(withFlash(safeBack, error ? "actie-mislukt" : "opgeslagen"));
}

export async function addCostEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  const projectId = String(formData.get("project_id") ?? "");
  formData.delete("id");
  return saveEntity({
    table: "project_cost_entries",
    schema: costEntrySchema,
    permission: "costs.write",
    formData,
    extra: { source_type: "manual" },
    redirectTo: () => tabUrl(projectId, "na-calculatie"),
    flash: "kosten-geboekt",
    revalidate: [`/projecten/${projectId}`, "/na-calculatie"],
  });
}
