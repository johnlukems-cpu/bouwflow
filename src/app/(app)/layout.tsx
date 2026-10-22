import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { FlashToast } from "@/components/ui/toast";
import { getAppContext } from "@/lib/auth/context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  return (
    <div className="min-h-dvh">
      <Sidebar orgName={ctx.membership.organization.name} />
      <div className="lg:pl-64">
        {ctx.mode === "demo" && (
          <div className="no-print bg-accent-500 px-4 py-2 text-center text-sm font-medium text-white">
            <span className="sm:hidden">Demo-modus — fictieve gegevens, alleen-lezen</span>
            <span className="hidden sm:inline">
              Demo-modus — u bekijkt fictieve voorbeeldgegevens. Wijzigingen worden niet opgeslagen. Koppel Supabase om met echte gegevens te werken.
            </span>
          </div>
        )}
        <Topbar ctx={ctx} />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <Suspense>
        <FlashToast />
      </Suspense>
    </div>
  );
}
