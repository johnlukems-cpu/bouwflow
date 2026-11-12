import { LogOut } from "lucide-react";
import { signOut, switchOrganization } from "@/app/(auth)/actions";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { enabledModules, type AppContext } from "@/lib/auth/context";
import { DemoBadge } from "@/components/ui/badge";
import { BrandIcon } from "./brand";
import { MobileNav } from "./mobile-nav";

export function Topbar({ ctx }: { ctx: AppContext }) {
  const initials = ctx.user.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <MobileNav modules={enabledModules(ctx)} isPlatformAdmin={ctx.isPlatformAdmin} />
      <span className="lg:hidden">
        <BrandIcon className="size-8" />
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {ctx.memberships.length > 1 ? (
          <form action={switchOrganization} className="min-w-0">
            <label htmlFor="org-switch" className="sr-only">Organisatie</label>
            <select
              id="org-switch"
              name="organization_id"
              defaultValue={ctx.membership.organization.id}
              className="h-9 max-w-[14rem] truncate rounded-lg border-0 bg-slate-50 pl-3 pr-8 text-sm font-medium text-slate-800 ring-1 ring-inset ring-slate-200"
            >
              {ctx.memberships.map((m) => (
                <option key={m.organization.id} value={m.organization.id}>
                  {m.organization.name}
                </option>
              ))}
            </select>
            <button type="submit" className="ml-2 text-sm font-medium text-brand-700 hover:underline">Wissel</button>
          </form>
        ) : (
          <p className="truncate text-sm font-semibold text-slate-800">{ctx.membership.organization.name}</p>
        )}
        {ctx.mode === "demo" && <DemoBadge />}
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-slate-800">{ctx.user.name}</p>
          <p className="text-xs text-slate-600">{ROLE_LABELS[ctx.membership.role]}</p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-full bg-navy-900 text-sm font-semibold text-white" aria-hidden>
          {initials || "?"}
        </span>
        {ctx.mode === "supabase" && (
          <form action={signOut}>
            <button type="submit" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-800" aria-label="Uitloggen" title="Uitloggen">
              <LogOut className="size-5" />
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
