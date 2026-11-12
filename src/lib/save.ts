import "server-only";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { dbErrorMessage, guardWrite, guardWriteOrRedirect, type FormState } from "@/lib/actions";
import { getAppContext } from "@/lib/auth/context";
import type { Permission } from "@/lib/auth/permissions";
import { isUuid } from "@/lib/data/shared";
import { withFlash, type FlashKey } from "@/lib/flash";
import type { ModuleKey } from "@/lib/modules";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formDataToObject, toFieldErrors } from "@/lib/validation/common";

interface SaveOptions<S extends z.ZodType> {
  table: string;
  schema: S;
  permission: Permission;
  module?: ModuleKey;
  formData: FormData;
  /** Extra kolommen die de server bepaalt (nooit uit het formulier). */
  extra?: Record<string, unknown>;
  /** Pad na opslaan; krijgt het id van het record. */
  redirectTo: (id: string) => string;
  flash?: FlashKey;
  revalidate?: string[];
  /** Transformeer gevalideerde data vóór opslaan. */
  map?: (data: z.infer<S>) => Record<string, unknown>;
  /** Alleen bijwerken toegestaan als deze kolommen overeenkomen (bijv. status = draft). */
  updateFilter?: Record<string, string>;
}

/**
 * Generieke server-side opslag: rechten, module, abonnement en validatie;
 * organization_id komt altijd uit de server-context. RLS controleert opnieuw.
 */
export async function saveEntity<S extends z.ZodType>(o: SaveOptions<S>): Promise<FormState> {
  const ctx = await getAppContext();
  const raw = formDataToObject(o.formData);
  const blocked = guardWrite(ctx, o.permission, o.module);
  if (blocked) return { ...blocked, values: raw };

  const parsed = o.schema.safeParse(raw);
  if (!parsed.success) return { message: "Controleer de gemarkeerde velden.", errors: toFieldErrors(parsed.error as z.ZodError), values: raw };
  const data = o.map ? o.map(parsed.data) : (parsed.data as Record<string, unknown>);
  const orgId = ctx.membership.organization.id;
  const supabase = await createSupabaseServerClient();
  const id = raw.id;

  let savedId: string;
  if (id) {
    if (!isUuid(id)) return { message: "Ongeldig record.", values: raw };
    let q = supabase.from(o.table).update({ ...data, ...(o.extra ?? {}) }).eq("id", id).eq("organization_id", orgId);
    for (const [k, v] of Object.entries(o.updateFilter ?? {})) q = q.eq(k, v);
    const { data: row, error } = await q.select("id").maybeSingle();
    if (error || !row) return { message: dbErrorMessage(error, "Opslaan is niet gelukt (mogelijk is het record al definitief)."), values: raw };
    savedId = row.id as string;
  } else {
    const { data: row, error } = await supabase
      .from(o.table)
      .insert({ ...data, ...(o.extra ?? {}), organization_id: orgId })
      .select("id")
      .single();
    if (error || !row) return { message: dbErrorMessage(error, "Aanmaken is niet gelukt."), values: raw };
    savedId = row.id as string;
  }
  for (const p of o.revalidate ?? []) revalidatePath(p);
  redirect(withFlash(o.redirectTo(savedId), o.flash ?? (id ? "opgeslagen" : "aangemaakt")));
}

/**
 * Voert een databasefunctie (workflowstap) uit vanuit een knop. Een fout wordt
 * via een kortlevende cookie (alleen door de server gezet) als melding getoond —
 * nooit via de URL, zodat niemand een link met misleidende tekst kan maken.
 */
export async function runRpc(opts: {
  fn: string;
  args: Record<string, unknown>;
  permission: Permission;
  module?: ModuleKey;
  backTo: string;
  successTo?: (result: unknown) => string;
  flash: FlashKey;
  revalidate?: string[];
}) {
  const ctx = await getAppContext();
  guardWriteOrRedirect(ctx, opts.permission, opts.backTo, opts.module);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(opts.fn, opts.args);
  if (error) {
    await setErrorFlash(dbErrorMessage(error, "De actie is niet gelukt."));
    redirect(opts.backTo);
  }
  for (const p of opts.revalidate ?? []) revalidatePath(p);
  redirect(withFlash(opts.successTo ? opts.successTo(data) : opts.backTo, opts.flash));
}

export const ERROR_COOKIE = "bf_fout";

/** Zet een foutmelding die de volgende pagina eenmalig toont. */
export async function setErrorFlash(message: string) {
  (await cookies()).set(ERROR_COOKIE, encodeURIComponent(message.slice(0, 300)), {
    path: "/",
    maxAge: 30,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false, // de melding wordt in de browser getoond en daarna gewist
  });
}

/** Archiveren/herstellen (nooit verwijderen) van een record. */
export async function setArchived(opts: { table: string; id: string; archive: boolean; permission: Permission; module?: ModuleKey; backTo: string; revalidate?: string[] }) {
  const ctx = await getAppContext();
  guardWriteOrRedirect(ctx, opts.permission, opts.backTo, opts.module);
  if (!isUuid(opts.id)) redirect(opts.backTo);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from(opts.table).update({ is_archived: opts.archive }).eq("id", opts.id).eq("organization_id", ctx.membership.organization.id);
  if (error) {
    await setErrorFlash(dbErrorMessage(error, "Archiveren is niet gelukt."));
    redirect(opts.backTo);
  }
  for (const p of opts.revalidate ?? []) revalidatePath(p);
  redirect(withFlash(opts.backTo, opts.archive ? "gearchiveerd" : "hersteld"));
}
