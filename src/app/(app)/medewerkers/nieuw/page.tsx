import type { Metadata } from "next";
import { EntityForm } from "@/components/ui/entity-form";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { listMembers } from "@/lib/data/projects";
import { saveEmployee } from "../actions";
import { employeeSections } from "../config";

export const metadata: Metadata = { title: "Nieuwe medewerker" };

export default async function NewEmployeePage() {
  const ctx = await getAppContext();
  const members = await listMembers(ctx);
  return (
    <ModuleGate ctx={ctx} module="medewerkers">
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Nieuwe medewerker" breadcrumbs={[{ label: "Medewerkers", href: "/medewerkers" }, { label: "Nieuw" }]} />
        <EntityForm action={saveEmployee} sections={employeeSections(members)} initialValues={{ is_active: "true", hourly_cost: "0", hourly_rate: "0" }} submitLabel="Medewerker aanmaken" cancelHref="/medewerkers" readOnly={ctx.mode === "demo"} />
      </div>
    </ModuleGate>
  );
}
