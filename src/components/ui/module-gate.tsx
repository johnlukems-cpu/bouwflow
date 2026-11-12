import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { hasModule, type AppContext } from "@/lib/auth/context";
import { MODULE_LABELS, type ModuleKey } from "@/lib/modules";
import { LinkButton } from "./button";

/** Toont de inhoud alleen als de module in het abonnement zit (server-side controle). */
export function ModuleGate({ ctx, module, children }: { ctx: AppContext; module: ModuleKey; children: ReactNode }) {
  if (hasModule(ctx, module)) return <>{children}</>;
  return (
    <div className="mx-auto max-w-lg rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
      <Lock className="mx-auto size-10 text-slate-500" aria-hidden />
      <h1 className="mt-4 text-lg font-semibold text-navy-900">{MODULE_LABELS[module]} zit niet in uw abonnement</h1>
      <p className="mt-2 text-sm text-slate-600">
        Uw huidige abonnement ({ctx.subscription.planName}) bevat deze module niet. Bekijk de mogelijkheden bij Instellingen → Abonnement.
      </p>
      <LinkButton href="/instellingen/abonnement" className="mt-6" variant="secondary">
        Naar abonnement
      </LinkButton>
    </div>
  );
}
