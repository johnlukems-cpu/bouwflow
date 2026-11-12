import type { Metadata } from "next";
import { EntityForm } from "@/components/ui/entity-form";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { saveSupplier } from "../actions";
import { supplierSections } from "../config";

export const metadata: Metadata = { title: "Nieuwe leverancier" };

export default async function NewSupplierPage() {
  const ctx = await getAppContext();
  return (
    <ModuleGate ctx={ctx} module="leveranciers">
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Nieuwe leverancier" breadcrumbs={[{ label: "Leveranciers", href: "/leveranciers" }, { label: "Nieuw" }]} />
        <EntityForm action={saveSupplier} sections={supplierSections} initialValues={{ supplier_type: "supplier", country_code: "SR" }} submitLabel="Leverancier aanmaken" cancelHref="/leveranciers" readOnly={ctx.mode === "demo"} />
      </div>
    </ModuleGate>
  );
}
