import type { Metadata } from "next";
import { EntityForm } from "@/components/ui/entity-form";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { listSuppliers } from "@/lib/data/resources";
import { saveMaterial } from "../actions";
import { materialSections } from "../config";

export const metadata: Metadata = { title: "Nieuw artikel" };

export default async function NewMaterialPage() {
  const ctx = await getAppContext();
  const suppliers = await listSuppliers(ctx);
  return (
    <ModuleGate ctx={ctx} module="materialen">
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Nieuw artikel" breadcrumbs={[{ label: "Materiaalbibliotheek", href: "/materialen" }, { label: "Nieuw" }]} />
        <EntityForm action={saveMaterial} sections={materialSections(suppliers)} initialValues={{ category: "Overig", unit: "st", cost_price: "0", sale_price: "0", waste_percent: "0" }} submitLabel="Artikel aanmaken" cancelHref="/materialen" readOnly={ctx.mode === "demo"} />
      </div>
    </ModuleGate>
  );
}
