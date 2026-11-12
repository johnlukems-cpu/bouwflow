import type { Metadata } from "next";
import { EntityForm } from "@/components/ui/entity-form";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { listProjects, parseProjectFilters } from "@/lib/data/projects";
import { listSuppliers } from "@/lib/data/resources";
import { todayISO } from "@/lib/format";
import { savePurchaseOrder } from "../actions";
import { purchaseOrderSections } from "../config";

export const metadata: Metadata = { title: "Nieuwe inkooporder" };

export default async function NewPurchaseOrderPage({ searchParams }: PageProps<"/inkoop/nieuw">) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const [suppliers, projects] = await Promise.all([listSuppliers(ctx), listProjects(ctx, { ...parseProjectFilters({}), status: "open" })]);
  return (
    <ModuleGate ctx={ctx} module="inkoop">
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Nieuwe inkooporder" breadcrumbs={[{ label: "Inkoop", href: "/inkoop" }, { label: "Nieuw" }]} description="Orderregels voegt u na het opslaan toe." />
        <EntityForm action={savePurchaseOrder} sections={purchaseOrderSections(suppliers, projects)} initialValues={{ order_date: todayISO(ctx.settings.timezone), project_id: typeof sp.project === "string" ? sp.project : "" }} submitLabel="Inkooporder aanmaken" cancelHref="/inkoop" readOnly={ctx.mode === "demo"} />
      </div>
    </ModuleGate>
  );
}
