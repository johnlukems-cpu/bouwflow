"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage, guardWrite, type FormState } from "@/lib/actions";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { isUuid } from "@/lib/data/shared";
import { withFlash } from "@/lib/flash";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, safeFileName } from "@/lib/documents";

const CATEGORIES = ["tekening", "vergunning", "foto", "contract", "offerte", "factuur", "werkbon", "overig"];

function safeBack(v: FormDataEntryValue | null) {
  const s = String(v ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/documenten";
}

/**
 * Uploadt een bestand naar de privé-bucket in de map van de eigen organisatie
 * en registreert de metadata. Opslag-RLS controleert het pad opnieuw.
 */
export async function uploadDocument(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getAppContext();
  const back = safeBack(formData.get("back"));
  const workOrderId = String(formData.get("work_order_id") ?? "");
  const isEmployeePhoto = !can(ctx.membership.role, "documents.write") && isUuid(workOrderId);
  const blocked = guardWrite(ctx, isEmployeePhoto ? "time.register" : "documents.write", "documenten");
  if (blocked) return blocked;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { errors: { file: "Kies een bestand" } };
  if (file.size > MAX_DOCUMENT_BYTES) return { errors: { file: "Het bestand is groter dan 25 MB" } };
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) return { errors: { file: "Dit bestandstype is niet toegestaan" } };
  const category = isEmployeePhoto ? "foto" : CATEGORIES.includes(String(formData.get("category"))) ? String(formData.get("category")) : "overig";
  const projectId = String(formData.get("project_id") ?? "");
  const customerId = String(formData.get("customer_id") ?? "");

  const orgId = ctx.membership.organization.id;
  const folder = isEmployeePhoto ? "werkbonnen" : isUuid(projectId) ? `projecten/${projectId}` : "algemeen";
  const path = `${orgId}/${folder}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const supabase = await createSupabaseServerClient();
  const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { message: "Uploaden is niet gelukt. Controleer of de opslag (bucket 'documents') is ingesteld." };

  const { error } = await supabase.from("documents").insert({
    organization_id: orgId,
    project_id: isUuid(projectId) ? projectId : null,
    customer_id: isUuid(customerId) ? customerId : null,
    work_order_id: isUuid(workOrderId) ? workOrderId : null,
    name: file.name.slice(0, 255),
    category,
    storage_path: path,
    mime_type: file.type,
    size_bytes: file.size,
  });
  if (error) {
    await supabase.storage.from("documents").remove([path]); // geen weesbestanden
    return { message: dbErrorMessage(error, "Het document kon niet worden geregistreerd.") };
  }
  revalidatePath("/documenten");
  redirect(withFlash(back, "document-geupload"));
}

export async function archiveDocument(formData: FormData) {
  const ctx = await getAppContext();
  const id = String(formData.get("id") ?? "");
  const back = safeBack(formData.get("back"));
  if (guardWrite(ctx, "documents.write", "documenten") || !isUuid(id)) redirect(withFlash(back, ctx.mode === "demo" ? "demo-alleen-lezen" : "geen-rechten"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("documents").update({ is_archived: true }).eq("id", id).eq("organization_id", ctx.membership.organization.id);
  revalidatePath("/documenten");
  redirect(withFlash(back, error ? "actie-mislukt" : "gearchiveerd"));
}
