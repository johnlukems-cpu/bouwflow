import "server-only";
import { redirect } from "next/navigation";
import type { AppContext } from "@/lib/auth/context";
import { hasModule } from "@/lib/auth/context";
import { can, type Permission } from "@/lib/auth/permissions";
import { withFlash, type FlashKey } from "@/lib/flash";
import type { ModuleKey } from "@/lib/modules";
import type { FieldErrors } from "@/lib/validation/common";

export interface FormState {
  message?: string;
  errors?: FieldErrors;
  values?: Record<string, string>;
  /** Eenmalig te tonen informatie (bijv. een uitnodigingslink). */
  result?: string;
}

/**
 * Gemeenschappelijke controles voor schrijfacties. Retourneert een foutstatus
 * of null als de actie mag doorgaan. De database (RLS) controleert opnieuw.
 */
export function guardWrite(ctx: AppContext, permission: Permission, module?: ModuleKey): FormState | null {
  if (ctx.mode === "demo") {
    return { message: "Demo-modus: wijzigingen worden niet opgeslagen. Koppel Supabase om met echte gegevens te werken." };
  }
  if (!can(ctx.membership.role, permission)) {
    return { message: "U heeft geen rechten voor deze actie." };
  }
  if (module && !hasModule(ctx, module)) {
    return { message: "Deze module zit niet in uw abonnement." };
  }
  if (!ctx.subscription.writable) {
    return { message: "Uw abonnement of proefperiode is niet actief; wijzigen is niet mogelijk." };
  }
  return null;
}

/** Variant voor formulierloze acties (knoppen): stuurt bij weigering terug met een melding. */
export function guardWriteOrRedirect(ctx: AppContext, permission: Permission, backTo: string, module?: ModuleKey) {
  const blocked = guardWrite(ctx, permission, module);
  if (blocked) redirect(withFlash(backTo, ctx.mode === "demo" ? "demo-alleen-lezen" : ("geen-rechten" as FlashKey)));
}

/**
 * Vertaalt databasefouten naar begrijpelijke meldingen. Eigen (Nederlandstalige)
 * meldingen uit de workflowfuncties worden doorgegeven; technische details van
 * constraints worden niet getoond.
 */
export function dbErrorMessage(error: { code?: string; message?: string } | null, fallback: string): string {
  const msg = error?.message ?? "";
  const technical = /violates|relation|column|syntax|permission denied|duplicate key|function|policy/i.test(msg);
  if (msg && !technical && ["23514", "42501", "22023", "54000", "P0002", "23P01", "P0001", "23505"].includes(error?.code ?? "")) {
    return msg;
  }
  switch (error?.code) {
    case "42501":
      return "U heeft geen rechten voor deze actie (of uw abonnement staat wijzigen niet toe).";
    case "23503":
      return "Een gekoppeld record bestaat niet binnen uw organisatie.";
    case "23505":
      return "Dit record bestaat al of is al verwerkt.";
    case "23514":
      return "Een of meer waarden voldoen niet aan de regels.";
    default:
      return fallback;
  }
}

/** Unieke sleutel om dubbele verwerking (dubbelklik, herhaald verzoek) te voorkomen. */
export function idempotencyKeyFrom(raw: string | undefined): string {
  return raw && /^[a-zA-Z0-9-]{8,100}$/.test(raw) ? raw : crypto.randomUUID();
}
