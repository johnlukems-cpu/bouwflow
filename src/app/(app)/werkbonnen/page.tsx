import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { WorkOrderTable } from "@/components/lists/execution-lists";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listWorkOrders } from "@/lib/data/execution";
import { APPROVAL_STATUS_LABELS } from "@/lib/types";

export const metadata: Metadata = { title: "Werkbonnen" };

export default async function WorkOrdersPage({ searchParams }: PageProps<"/werkbonnen">) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const status = typeof sp.status === "string" && sp.status in APPROVAL_STATUS_LABELS ? sp.status : "";
  const manager = can(ctx.membership.role, "time.approve");
  const workOrders = await listWorkOrders(ctx, { status, employeeId: manager ? undefined : (ctx.employeeId ?? "00000000-0000-0000-0000-000000000000") });
  return (
    <ModuleGate ctx={ctx} module="werkbonnen">
      <PageHeader
        title="Werkbonnen"
        description="Digitale werkbonnen. Na goedkeuring worden uren en materialen automatisch (en eenmalig) als projectkosten geboekt."
        actions={can(ctx.membership.role, "time.register") && <LinkButton href="/werkbonnen/nieuw"><Plus className="size-4" aria-hidden /> Nieuwe werkbon</LinkButton>}
      />
      <Card>
        <FilterBar placeholder="Filter op status">
          <FilterSelect name="status" label="Status" value={status} options={[{ value: "", label: "Alle statussen" }, ...Object.entries(APPROVAL_STATUS_LABELS).map(([value, label]) => ({ value, label }))]} />
        </FilterBar>
        <WorkOrderTable workOrders={workOrders} />
      </Card>
    </ModuleGate>
  );
}
