import "server-only";
import type { AppContext } from "@/lib/auth/context";
import { can, type Permission } from "@/lib/auth/permissions";
import type { FieldErrors } from "@/lib/validation/common";

export interface FormState {
  message?: string;
  errors?: FieldErrors;
  values?: Record<string, string>;
}

/**
 * Gemeenschappelijke controles voor schrijfacties. Retourneert een foutstatus
 * of null als de actie mag doorgaan. De database (RLS) controleert opnieuw.
 */
export function guardWrite(ctx: AppContext, permission: Permission): FormState | null {
  if (ctx.mode === "demo") {
    return { message: "Demo-modus: wijzigingen worden niet opgeslagen. Koppel Supabase om met echte gegevens te werken." };
  }
  if (!can(ctx.membership.role, permission)) {
    return { message: "U heeft geen rechten voor deze actie." };
  }
  return null;
}

/** Vertaalt databasefouten naar begrijpelijke meldingen zonder interne details te lekken. */
export function dbErrorMessage(error: { code?: string; message?: string } | null, fallback: string): string {
  switch (error?.code) {
    case "42501":
      return "U heeft geen rechten voor deze actie.";
    case "23503":
      return "Een gekoppeld record (bijv. klant of projectleider) bestaat niet binnen uw organisatie.";
    case "23505":
      return "Dit record bestaat al.";
    case "23514":
      return "Een of meer waarden voldoen niet aan de regels.";
    default:
      return fallback;
  }
}
