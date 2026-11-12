"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbErrorMessage } from "@/lib/actions";
import { getAppContext } from "@/lib/auth/context";
import { withFlash } from "@/lib/flash";
import { setErrorFlash } from "@/lib/save";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  organization_id: z.uuid(),
  plan_code: z.string().regex(/^[a-z0-9_]{2,40}$/),
  status: z.enum(["trialing", "active", "past_due", "suspended", "cancelled"]),
  trial_ends_at: z.preprocess((v) => (v === "" ? null : v), z.iso.date().nullable()),
  max_users: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().min(1).max(10000).nullable()),
});

/** Alleen platformbeheerders; de databasefunctie controleert dit opnieuw. */
export async function setSubscription(formData: FormData) {
  const ctx = await getAppContext();
  if (!ctx.isPlatformAdmin) redirect("/dashboard");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    await setErrorFlash("Ongeldige invoer.");
    redirect("/platform");
  }
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("platform_set_subscription", {
    org_id: d.organization_id,
    new_plan: d.plan_code,
    new_status: d.status,
    new_trial_ends_at: d.trial_ends_at ? `${d.trial_ends_at}T23:59:59-03:00` : null,
    new_max_users: d.max_users,
  });
  if (error) await setErrorFlash(dbErrorMessage(error, "Bijwerken is niet gelukt."));
  revalidatePath("/platform");
  redirect(withFlash("/platform", error ? "actie-mislukt" : "abonnement-bijgewerkt"));
}
