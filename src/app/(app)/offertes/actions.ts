"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage, guardWriteOrRedirect, type FormState } from "@/lib/actions";
import { getAppContext } from "@/lib/auth/context";
import { isUuid } from "@/lib/data/shared";
import { withFlash } from "@/lib/flash";
import { runRpc, saveEntity, setErrorFlash } from "@/lib/save";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { documentLineSchema, invoiceFromQuoteSchema, quoteSchema } from "@/lib/validation/modules";
import { formDataToObject } from "@/lib/validation/common";

export async function saveQuote(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getAppContext();
  return saveEntity({
    table: "quotes",
    schema: quoteSchema,
    permission: "quotes.write",
    module: "offertes",
    formData,
    extra: formData.get("id") ? {} : { currency_code: ctx.settings.currency_code },
    updateFilter: { status: "draft" },
    redirectTo: (id) => `/offertes/${id}`,
    revalidate: ["/offertes"],
  });
}

export async function addQuoteLine(_prev: FormState, formData: FormData): Promise<FormState> {
  const quoteId = String(formData.get("quote_id") ?? "");
  formData.delete("id");
  const count = Number(formData.get("line_count") ?? 0);
  return saveEntity({
    table: "quote_lines",
    schema: documentLineSchema,
    permission: "quotes.write",
    module: "offertes",
    formData,
    extra: { quote_id: quoteId, sort_order: Number.isFinite(count) ? count + 1 : 0 },
    redirectTo: () => `/offertes/${quoteId}`,
    flash: "opgeslagen",
  });
}

export async function removeQuoteLine(formData: FormData) {
  const ctx = await getAppContext();
  const quoteId = String(formData.get("quote_id") ?? "");
  const id = String(formData.get("line_id") ?? "");
  const back = `/offertes/${quoteId}`;
  guardWriteOrRedirect(ctx, "quotes.write", back, "offertes");
  if (!isUuid(id)) redirect(back);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("quote_lines").delete().eq("id", id).eq("organization_id", ctx.membership.organization.id);
  if (error) await setErrorFlash(dbErrorMessage(error, "Verwijderen is niet gelukt."));
  redirect(withFlash(back, error ? "actie-mislukt" : "verwijderd"));
}

export async function sendQuote(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await runRpc({ fn: "send_quote", args: { q_id: id }, permission: "quotes.write", module: "offertes", backTo: `/offertes/${id}`, flash: "offerte-verzonden", revalidate: ["/offertes"] });
}

export async function respondQuote(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const accept = formData.get("accept") === "true";
  await runRpc({
    fn: "respond_quote",
    args: { q_id: id, accept, by_name: String(formData.get("by_name") ?? "").slice(0, 200) },
    permission: "quotes.write",
    module: "offertes",
    backTo: `/offertes/${id}`,
    flash: accept ? "offerte-geaccepteerd" : "offerte-afgewezen",
    revalidate: ["/offertes", "/projecten"],
  });
}

export async function reviseQuote(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await runRpc({ fn: "revise_quote", args: { q_id: id }, permission: "quotes.write", module: "offertes", backTo: `/offertes/${id}`, successTo: (newId) => `/offertes/${newId}`, flash: "offerte-herzien", revalidate: ["/offertes"] });
}

export async function cancelQuote(formData: FormData) {
  const ctx = await getAppContext();
  const id = String(formData.get("id") ?? "");
  const back = `/offertes/${id}`;
  guardWriteOrRedirect(ctx, "quotes.write", back, "offertes");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("quotes").update({ status: "cancelled" }).eq("id", id).eq("organization_id", ctx.membership.organization.id).eq("status", "draft");
  if (error) await setErrorFlash(dbErrorMessage(error, "Annuleren is niet gelukt."));
  revalidatePath("/offertes");
  redirect(withFlash(back, error ? "actie-mislukt" : "opgeslagen"));
}

export async function invoiceFromQuote(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const parsed = invoiceFromQuoteSchema.safeParse(raw);
  if (!parsed.success) return { message: "Controleer het percentage.", values: raw };
  await runRpc({
    fn: "create_invoice_from_quote",
    args: { q_id: parsed.data.quote_id, inv_type: parsed.data.invoice_type, pct: parsed.data.percent },
    permission: "invoices.write",
    module: "facturatie",
    backTo: `/offertes/${parsed.data.quote_id}`,
    successTo: (invId) => `/facturatie/${invId}`,
    flash: "aangemaakt",
    revalidate: ["/facturatie"],
  });
  return {};
}
