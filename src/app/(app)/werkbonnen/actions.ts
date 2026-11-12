"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage, guardWriteOrRedirect, type FormState } from "@/lib/actions";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { isUuid } from "@/lib/data/shared";
import { getMaterial } from "@/lib/data/resources";
import { withFlash } from "@/lib/flash";
import { runRpc, saveEntity, setErrorFlash } from "@/lib/save";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { workOrderMaterialSchema, workOrderSchema } from "@/lib/validation/modules";

export async function saveWorkOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getAppContext();
  if (!can(ctx.membership.role, "time.approve")) {
    if (!ctx.employeeId) return { message: "Uw account is niet gekoppeld aan een medewerker. Vraag uw beheerder dit in te stellen." };
    formData.set("employee_id", ctx.employeeId);
  }
  return saveEntity({
    table: "work_orders",
    schema: workOrderSchema,
    permission: "time.register",
    module: "werkbonnen",
    formData,
    redirectTo: (id) => `/werkbonnen/${id}`,
    revalidate: ["/werkbonnen"],
  });
}

export async function addWorkOrderMaterial(_prev: FormState, formData: FormData): Promise<FormState> {
  const workOrderId = String(formData.get("work_order_id") ?? "");
  const materialId = String(formData.get("material_id") ?? "");
  if (isUuid(materialId)) {
    const ctx = await getAppContext();
    const m = await getMaterial(ctx, materialId);
    if (m) {
      if (!String(formData.get("description") ?? "").trim()) formData.set("description", m.description);
      if (!String(formData.get("unit") ?? "").trim()) formData.set("unit", m.unit);
    }
  }
  formData.delete("id");
  return saveEntity({
    table: "work_order_materials",
    schema: workOrderMaterialSchema,
    permission: "time.register",
    module: "werkbonnen",
    formData,
    extra: { work_order_id: workOrderId },
    redirectTo: () => `/werkbonnen/${workOrderId}`,
    flash: "opgeslagen",
  });
}

export async function removeWorkOrderMaterial(formData: FormData) {
  const ctx = await getAppContext();
  const workOrderId = String(formData.get("work_order_id") ?? "");
  const id = String(formData.get("material_line_id") ?? "");
  const back = `/werkbonnen/${workOrderId}`;
  guardWriteOrRedirect(ctx, "time.register", back, "werkbonnen");
  if (!isUuid(id)) redirect(back);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("work_order_materials").delete().eq("id", id).eq("organization_id", ctx.membership.organization.id);
  if (error) await setErrorFlash(dbErrorMessage(error, "Verwijderen is niet gelukt."));
  redirect(withFlash(back, error ? "actie-mislukt" : "verwijderd"));
}

export async function setWorkOrderStatus(formData: FormData) {
  const ctx = await getAppContext();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const back = `/werkbonnen/${id}`;
  guardWriteOrRedirect(ctx, status === "rejected" ? "time.approve" : "time.register", back, "werkbonnen");
  if (!isUuid(id) || !["submitted", "rejected", "draft"].includes(status)) redirect(back);
  const supabase = await createSupabaseServerClient();
  const update: Record<string, unknown> = { status };
  if (status === "rejected") update.rejection_reason = String(formData.get("reason") ?? "").slice(0, 1000) || null;
  const { error } = await supabase.from("work_orders").update(update).eq("id", id).eq("organization_id", ctx.membership.organization.id);
  if (error) await setErrorFlash(dbErrorMessage(error, "Bijwerken is niet gelukt."));
  revalidatePath("/werkbonnen");
  redirect(withFlash(back, error ? "actie-mislukt" : status === "rejected" ? "afgekeurd" : "ingediend"));
}

export async function approveWorkOrder(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await runRpc({ fn: "approve_work_order", args: { wo_id: id }, permission: "time.approve", module: "werkbonnen", backTo: `/werkbonnen/${id}`, flash: "goedgekeurd", revalidate: ["/werkbonnen", "/uren", "/voorraad"] });
}
