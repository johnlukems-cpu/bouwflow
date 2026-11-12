"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage, guardWrite, guardWriteOrRedirect, idempotencyKeyFrom, type FormState } from "@/lib/actions";
import { getAppContext } from "@/lib/auth/context";
import { isUuid } from "@/lib/data/shared";
import { getMaterial } from "@/lib/data/resources";
import { withFlash } from "@/lib/flash";
import { saveEntity, setErrorFlash } from "@/lib/save";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formDataToObject, toFieldErrors } from "@/lib/validation/common";
import { purchaseLineSchema, purchaseOrderSchema, receiptSchema } from "@/lib/validation/modules";

export async function savePurchaseOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  return saveEntity({
    table: "purchase_orders",
    schema: purchaseOrderSchema,
    permission: "purchasing.write",
    module: "inkoop",
    formData,
    updateFilter: { status: "draft" },
    redirectTo: (id) => `/inkoop/${id}`,
    revalidate: ["/inkoop"],
  });
}

export async function addPurchaseLine(_prev: FormState, formData: FormData): Promise<FormState> {
  const poId = String(formData.get("purchase_order_id") ?? "");
  const materialId = String(formData.get("material_id") ?? "");
  if (isUuid(materialId)) {
    const ctx = await getAppContext();
    const m = await getMaterial(ctx, materialId);
    if (m) {
      if (!String(formData.get("description") ?? "").trim()) formData.set("description", m.description);
      if (!String(formData.get("unit") ?? "").trim()) formData.set("unit", m.unit);
      if (!String(formData.get("unit_cost") ?? "").trim()) formData.set("unit_cost", m.cost_price);
    }
  }
  formData.delete("id");
  return saveEntity({
    table: "purchase_order_lines",
    schema: purchaseLineSchema,
    permission: "purchasing.write",
    module: "inkoop",
    formData,
    extra: { purchase_order_id: poId },
    redirectTo: () => `/inkoop/${poId}`,
    flash: "opgeslagen",
  });
}

export async function removePurchaseLine(formData: FormData) {
  const ctx = await getAppContext();
  const poId = String(formData.get("purchase_order_id") ?? "");
  const id = String(formData.get("line_id") ?? "");
  const back = `/inkoop/${poId}`;
  guardWriteOrRedirect(ctx, "purchasing.write", back, "inkoop");
  if (!isUuid(id)) redirect(back);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("purchase_order_lines").delete().eq("id", id).eq("organization_id", ctx.membership.organization.id);
  if (error) await setErrorFlash(dbErrorMessage(error, "Verwijderen is niet gelukt."));
  redirect(withFlash(back, error ? "actie-mislukt" : "verwijderd"));
}

export async function setPurchaseOrderStatus(formData: FormData) {
  const ctx = await getAppContext();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const back = `/inkoop/${id}`;
  guardWriteOrRedirect(ctx, "purchasing.write", back, "inkoop");
  if (!isUuid(id) || !["ordered", "cancelled"].includes(status)) redirect(back);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("purchase_orders").update({ status }).eq("id", id).eq("organization_id", ctx.membership.organization.id);
  if (error) await setErrorFlash(dbErrorMessage(error, "Bijwerken is niet gelukt."));
  revalidatePath("/inkoop");
  redirect(withFlash(back, error ? "actie-mislukt" : status === "ordered" ? "besteld" : "opgeslagen"));
}

/** Ontvangst boeken; de idempotentiesleutel uit het formulier voorkomt dubbele boeking bij dubbelklikken. */
export async function receivePurchaseLine(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getAppContext();
  const raw = formDataToObject(formData);
  const poId = raw.purchase_order_id;
  const blocked = guardWrite(ctx, "purchasing.write", "inkoop");
  if (blocked) return blocked;
  const parsed = receiptSchema.safeParse({ ...raw, idempotency_key: idempotencyKeyFrom(raw.idempotency_key) });
  if (!parsed.success) return { errors: toFieldErrors(parsed.error), values: raw };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("receive_purchase_line", {
    line_id: parsed.data.line_id,
    qty: parsed.data.quantity,
    received: parsed.data.received_on,
    idem_key: parsed.data.idempotency_key,
  });
  if (error) return { message: dbErrorMessage(error, "Ontvangst boeken is niet gelukt."), values: raw };
  revalidatePath("/inkoop");
  revalidatePath("/voorraad");
  redirect(withFlash(`/inkoop/${isUuid(poId) ? poId : ""}`, "ontvangst-geboekt"));
}
