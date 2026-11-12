import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { TimeEntryTable } from "@/components/lists/execution-lists";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listTimeEntries } from "@/lib/data/execution";
import { APPROVAL_STATUS_LABELS } from "@/lib/types";

export const metadata: Metadata = { title: "Urenregistratie" };

export default async function HoursPage({ searchParams }: PageProps<"/uren">) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const status = typeof sp.status === "string" && sp.status in APPROVAL_STATUS_LABELS ? sp.status : "";
  const canApprove = can(ctx.membership.role, "time.approve");
  // Medewerkers zien alleen hun eigen uren
  const employeeId = canApprove ? undefined : (ctx.employeeId ?? "00000000-0000-0000-0000-000000000000");
  const entries = await listTimeEntries(ctx, { status, employeeId });
  const total = entries.reduce((a, t) => a + Math.round(Number(t.hours) * 100), 0) / 100;
  return (
    <ModuleGate ctx={ctx} module="uren">
      <PageHeader
        title="Urenregistratie"
        description={canApprove ? "Registreer en keur uren goed. Goedgekeurde uren worden als arbeidskosten op het project geboekt." : "Uw eigen uren. Dien ze in ter goedkeuring."}
        actions={can(ctx.membership.role, "time.register") && <LinkButton href="/uren/nieuw"><Plus className="size-4" aria-hidden /> Uren registreren</LinkButton>}
      />
      <Card>
        <FilterBar placeholder="Zoeken is beschikbaar via projecten en medewerkers">
          <FilterSelect name="status" label="Status" value={status} options={[{ value: "", label: "Alle statussen" }, ...Object.entries(APPROVAL_STATUS_LABELS).map(([value, label]) => ({ value, label }))]} />
        </FilterBar>
        <TimeEntryTable entries={entries} canApprove={canApprove} back="/uren" demo={ctx.mode === "demo"} />
        <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">Totaal: <strong className="tabular-nums">{total.toLocaleString("nl-NL")} uur</strong></p>
      </Card>
    </ModuleGate>
  );
}
