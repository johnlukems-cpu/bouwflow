"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage, guardWrite, guardWriteOrRedirect, idempotencyKeyFrom, type FormState } from "@/lib/actions";
import { getAppContext } from "@/lib/auth/context";
import { isUuid } from "@/lib/data/shared";
import { toDecimal } from "@/lib/finance/money";
import { withFlash } from "@/lib/flash";
import { runRpc, saveEntity, setErrorFlash } from "@/lib/save";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formDataToObject, toFieldErrors } from "@/lib/validation/common";
import { documentLineSchema, invoiceSchema, paymentSchema } from "@/lib/validation/modules";

export async function saveInvoice(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getAppContext();
  return saveEntity({
    table: "invoices",
    schema: invoiceSchema,
    permission: "invoices.write",
    module: "facturatie",
    formData,
    extra: formData.get("id") ? {} : { currency_code: ctx.settings.currency_code },
    // Het factuurtype ligt vast na aanmaken
    map: (d) => {
      if (!formData.get("id")) return d;
      const { invoice_type: _ignored, ...rest } = d;
      void _ignored;
      return rest;
    },
    updateFilter: { status: "draft" },
    redirectTo: (id) => `/facturatie/${id}`,
    revalidate: ["/facturatie"],
  });
}

export async function addInvoiceLine(_prev: FormState, formData: FormData): Promise<FormState> {
  const invoiceId = String(formData.get("invoice_id") ?? "");
  formData.delete("id");
  const count = Number(formData.get("line_count") ?? 0);
  return saveEntity({
    table: "invoice_lines",
    schema: documentLineSchema,
    permission: "invoices.write",
    module: "facturatie",
    formData,
    extra: { invoice_id: invoiceId, sort_order: Number.isFinite(count) ? count + 1 : 0 },
    redirectTo: () => `/facturatie/${invoiceId}`,
    flash: "opgeslagen",
  });
}

export async function removeInvoiceLine(formData: FormData) {
  const ctx = await getAppContext();
  const invoiceId = String(formData.get("invoice_id") ?? "");
  const id = String(formData.get("line_id") ?? "");
  const back = `/facturatie/${invoiceId}`;
  guardWriteOrRedirect(ctx, "invoices.write", back, "facturatie");
  if (!isUuid(id)) redirect(back);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("invoice_lines").delete().eq("id", id).eq("organization_id", ctx.membership.organization.id);
  if (error) await setErrorFlash(dbErrorMessage(error, "Verwijderen is niet gelukt."));
  redirect(withFlash(back, error ? "actie-mislukt" : "verwijderd"));
}

export async function finalizeInvoice(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await runRpc({ fn: "finalize_invoice", args: { inv_id: id }, permission: "invoices.write", module: "facturatie", backTo: `/facturatie/${id}`, flash: "factuur-definitief", revalidate: ["/facturatie", "/betalingen"] });
}

export async function createCreditNote(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await runRpc({
    fn: "create_credit_note",
    args: { inv_id: id, full_credit: formData.get("full") === "true" },
    permission: "invoices.write",
    module: "facturatie",
    backTo: `/facturatie/${id}`,
    successTo: (cnId) => `/facturatie/${cnId}`,
    flash: "aangemaakt",
    revalidate: ["/facturatie"],
  });
}

export async function cancelDraftInvoice(formData: FormData) {
  const ctx = await getAppContext();
  const id = String(formData.get("id") ?? "");
  const back = `/facturatie/${id}`;
  guardWriteOrRedirect(ctx, "invoices.write", back, "facturatie");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("invoices").update({ status: "cancelled" }).eq("id", id).eq("organization_id", ctx.membership.organization.id).eq("status", "draft");
  if (error) await setErrorFlash(dbErrorMessage(error, "Annuleren is niet gelukt."));
  revalidatePath("/facturatie");
  redirect(withFlash(back, error ? "actie-mislukt" : "opgeslagen"));
}

/** Betaling registreren. De sleutel wordt bij het tonen van het formulier gemaakt, zodat dubbel verzenden één betaling oplevert. */
export async function registerPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getAppContext();
  const raw = formDataToObject(formData);
  const blocked = guardWrite(ctx, "payments.write", "betalingen");
  if (blocked) return { ...blocked, values: raw };
  const parsed = paymentSchema.safeParse({ ...raw, idempotency_key: idempotencyKeyFrom(raw.idempotency_key) });
  if (!parsed.success) return { message: "Controleer de gemarkeerde velden.", errors: toFieldErrors(parsed.error), values: raw };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("payments").insert({ ...parsed.data, organization_id: ctx.membership.organization.id });
  if (error) {
    if (error.code === "23505") {
      // Zelfde sleutel: deze betaling is al verwerkt (dubbel verzonden formulier).
      redirect(withFlash(`/facturatie/${parsed.data.invoice_id}`, "betaling-geregistreerd"));
    }
    return { message: dbErrorMessage(error, "Betaling registreren is niet gelukt."), values: raw };
  }
  revalidatePath("/facturatie");
  revalidatePath("/betalingen");
  redirect(withFlash(`/facturatie/${parsed.data.invoice_id}`, "betaling-geregistreerd"));
}

/** Tegenboeking van een betaling (betalingen zijn onwijzigbaar). */
export async function reversePayment(formData: FormData) {
  const ctx = await getAppContext();
  const paymentId = String(formData.get("payment_id") ?? "");
  const invoiceId = String(formData.get("invoice_id") ?? "");
  const back = `/facturatie/${invoiceId}`;
  guardWriteOrRedirect(ctx, "payments.write", back, "betalingen");
  if (!isUuid(paymentId)) redirect(back);
  const supabase = await createSupabaseServerClient();
  const { data: p } = await supabase.from("payments").select("amount, invoice_id").eq("id", paymentId).eq("organization_id", ctx.membership.organization.id).maybeSingle();
  if (!p) redirect(back);
  const { error } = await supabase.from("payments").insert({
    organization_id: ctx.membership.organization.id,
    invoice_id: p.invoice_id,
    amount: toDecimal(String(p.amount)).negated().toFixed(2),
    paid_on: new Date().toISOString().slice(0, 10),
    method: "other",
    reference: "Tegenboeking",
    reversed_payment_id: paymentId,
    idempotency_key: `reverse-${paymentId}`,
  });
  if (error) await setErrorFlash(dbErrorMessage(error, "Tegenboeken is niet gelukt (mogelijk al tegengeboekt)."));
  revalidatePath("/betalingen");
  redirect(withFlash(back, error ? "actie-mislukt" : "opgeslagen"));
}
