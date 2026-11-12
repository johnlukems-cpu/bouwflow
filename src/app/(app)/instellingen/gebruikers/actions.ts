"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage, guardWrite, type FormState } from "@/lib/actions";
import { getAppContext } from "@/lib/auth/context";
import { getSiteUrl } from "@/lib/env";
import { withFlash } from "@/lib/flash";
import { runRpc } from "@/lib/save";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formDataToObject, toFieldErrors } from "@/lib/validation/common";
import { invitationSchema, memberUpdateSchema } from "@/lib/validation/modules";

/**
 * Maakt een uitnodiging. Er is (nog) geen e-mailprovider gekoppeld: de link
 * wordt eenmalig getoond zodat de beheerder hem zelf kan delen.
 */
export async function createInvitation(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getAppContext();
  const raw = formDataToObject(formData);
  const blocked = guardWrite(ctx, "members.manage");
  if (blocked) return { ...blocked, values: raw };
  const parsed = invitationSchema.safeParse(raw);
  if (!parsed.success) return { errors: toFieldErrors(parsed.error), values: raw };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_invitation", { org_id: ctx.membership.organization.id, invite_email: parsed.data.email, invite_role: parsed.data.role });
  if (error || !data) return { message: dbErrorMessage(error, "Uitnodigen is niet gelukt."), values: raw };
  revalidatePath("/instellingen/gebruikers");
  return { result: `${getSiteUrl()}/uitnodiging/${data as string}` };
}

export async function revokeInvitation(formData: FormData) {
  await runRpc({ fn: "revoke_invitation", args: { invitation_id: String(formData.get("id") ?? "") }, permission: "members.manage", backTo: "/instellingen/gebruikers", flash: "opgeslagen" });
}

export async function updateMember(formData: FormData) {
  const raw = formDataToObject(formData);
  const parsed = memberUpdateSchema.safeParse(raw);
  if (!parsed.success) redirect(withFlash("/instellingen/gebruikers", "actie-mislukt"));
  await runRpc({
    fn: "update_member",
    args: { member_id: parsed.data.member_id, new_role: parsed.data.role, new_active: parsed.data.is_active },
    permission: "members.manage",
    backTo: "/instellingen/gebruikers",
    flash: "lid-bijgewerkt",
    revalidate: ["/instellingen/gebruikers"],
  });
}

