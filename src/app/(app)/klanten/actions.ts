"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage, guardWrite, type FormState } from "@/lib/actions";
import { getSiteUrl } from "@/lib/env";
import { runRpc } from "@/lib/save";
import { getAppContext } from "@/lib/auth/context";
import { isUuid } from "@/lib/data/shared";
import { withFlash } from "@/lib/flash";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formDataToObject, toFieldErrors } from "@/lib/validation/common";
import { customerSchema } from "@/lib/validation/customer";

export async function saveCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getAppContext();
  const raw = formDataToObject(formData);
  const blocked = guardWrite(ctx, "customers.write");
  if (blocked) return { ...blocked, values: raw };

  const parsed = customerSchema.safeParse(raw);
  if (!parsed.success) {
    return { message: "Controleer de gemarkeerde velden.", errors: toFieldErrors(parsed.error), values: raw };
  }

  const id = raw.id;
  const supabase = await createSupabaseServerClient();
  const orgId = ctx.membership.organization.id;

  if (id) {
    if (!isUuid(id)) return { message: "Ongeldige klant.", values: raw };
    const { data, error } = await supabase
      .from("customers")
      .update(parsed.data)
      .eq("id", id)
      .eq("organization_id", orgId)
      .select("id")
      .maybeSingle();
    if (error || !data) return { message: dbErrorMessage(error, "De klant kon niet worden opgeslagen."), values: raw };
    revalidatePath("/klanten");
    redirect(withFlash(`/klanten/${id}`, "klant-bijgewerkt"));
  }

  // organization_id komt uit de server-side gevalideerde context, nooit uit het formulier.
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...parsed.data, organization_id: orgId })
    .select("id")
    .single();
  if (error || !data) return { message: dbErrorMessage(error, "De klant kon niet worden aangemaakt."), values: raw };
  revalidatePath("/klanten");
  redirect(withFlash(`/klanten/${data.id}`, "klant-aangemaakt"));
}

export async function setCustomerArchived(formData: FormData) {
  const ctx = await getAppContext();
  const id = String(formData.get("id") ?? "");
  const archive = formData.get("archive") === "true";
  if (!isUuid(id)) redirect("/klanten");
  if (guardWrite(ctx, "customers.write")) redirect(withFlash(`/klanten/${id}`, "demo-alleen-lezen"));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("customers")
    .update({ is_archived: archive })
    .eq("id", id)
    .eq("organization_id", ctx.membership.organization.id);
  if (error) throw new Error("Archiveren is niet gelukt");
  revalidatePath("/klanten");
  redirect(withFlash(`/klanten/${id}`, archive ? "klant-gearchiveerd" : "klant-hersteld"));
}

// ---------------------------------------------------------------------------
// Klantportaal
// ---------------------------------------------------------------------------

export async function createPortalLink(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getAppContext();
  const blocked = guardWrite(ctx, "portal.manage", "klantportaal");
  if (blocked) return blocked;
  const customerId = String(formData.get("customer_id") ?? "");
  if (!isUuid(customerId)) return { message: "Ongeldige klant." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_portal_link", { cust_id: customerId });
  if (error || !data) return { message: dbErrorMessage(error, "De portaallink kon niet worden aangemaakt.") };
  revalidatePath(`/klanten/${customerId}`);
  return { result: `${getSiteUrl()}/portaal/${data as string}` };
}

export async function revokePortalLink(formData: FormData) {
  const customerId = String(formData.get("customer_id") ?? "");
  await runRpc({ fn: "revoke_portal_link", args: { link_id: String(formData.get("link_id") ?? "") }, permission: "portal.manage", module: "klantportaal", backTo: `/klanten/${customerId}`, flash: "portaallink-ingetrokken" });
}
