"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage, guardWriteOrRedirect, type FormState } from "@/lib/actions";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { isUuid } from "@/lib/data/shared";
import { withFlash } from "@/lib/flash";
import { runRpc, saveEntity, setErrorFlash } from "@/lib/save";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { timeEntrySchema } from "@/lib/validation/modules";

function safeBack(v: FormDataEntryValue | null, fallback: string) {
  const s = String(v ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

export async function saveTimeEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getAppContext();
  // Medewerkers registreren alleen voor zichzelf (de database dwingt dit ook af)
  if (!can(ctx.membership.role, "time.approve")) {
    if (!ctx.employeeId) return { message: "Uw account is niet gekoppeld aan een medewerker. Vraag uw beheerder dit in te stellen." };
    formData.set("employee_id", ctx.employeeId);
  }
  const submit = formData.get("submit_for_approval") === "on";
  const back = safeBack(formData.get("back"), "/uren");
  return saveEntity({
    table: "time_entries",
    schema: timeEntrySchema,
    permission: "time.register",
    module: "uren",
    formData,
    extra: { status: submit ? "submitted" : "draft" },
    redirectTo: () => back,
    revalidate: ["/uren"],
  });
}

export async function approveTimeEntry(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await runRpc({ fn: "approve_time_entry", args: { entry_id: id }, permission: "time.approve", module: "uren", backTo: safeBack(formData.get("back"), "/uren"), flash: "goedgekeurd", revalidate: ["/uren", "/na-calculatie"] });
}

export async function setTimeEntryStatus(formData: FormData) {
  const ctx = await getAppContext();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const back = safeBack(formData.get("back"), "/uren");
  const permission = status === "rejected" ? "time.approve" : "time.register";
  guardWriteOrRedirect(ctx, permission, back, "uren");
  if (!isUuid(id) || !["submitted", "rejected", "draft"].includes(status)) redirect(back);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("time_entries").update({ status }).eq("id", id).eq("organization_id", ctx.membership.organization.id);
  if (error) await setErrorFlash(dbErrorMessage(error, "Bijwerken is niet gelukt."));
  revalidatePath("/uren");
  redirect(withFlash(back, error ? "actie-mislukt" : status === "rejected" ? "afgekeurd" : "ingediend"));
}

