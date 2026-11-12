import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { PurchaseOrderTable } from "@/components/lists/execution-lists";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listPurchaseOrders } from "@/lib/data/execution";
import { PO_STATUS_LABELS } from "@/lib/types";

export const metadata: Metadata = { title: "Inkoop" };

export default async function PurchasingPage({ searchParams }: PageProps<"/inkoop">) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const status = typeof sp.status === "string" && sp.status in PO_STATUS_LABELS ? sp.status : "";
  const orders = await listPurchaseOrders(ctx, { status });
  return (
    <ModuleGate ctx={ctx} module="inkoop">
      <PageHeader
        title="Inkoop"
        description="Materiaalbehoefte → inkooporder → ontvangst → voorraad of directe projectkosten."
        actions={can(ctx.membership.role, "purchasing.write") && <LinkButton href="/inkoop/nieuw"><Plus className="size-4" aria-hidden /> Nieuwe inkooporder</LinkButton>}
      />
      <Card>
        <FilterBar placeholder="Filter op status">
          <FilterSelect name="status" label="Status" value={status} options={[{ value: "", label: "Alle statussen" }, ...Object.entries(PO_STATUS_LABELS).map(([value, label]) => ({ value, label }))]} />
        </FilterBar>
        <PurchaseOrderTable orders={orders} locale={ctx.settings.locale} />
      </Card>
    </ModuleGate>
  );
}
