import type { Metadata } from "next";
import { EntityForm } from "@/components/ui/entity-form";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listProjects, parseProjectFilters } from "@/lib/data/projects";
import { listEmployees } from "@/lib/data/resources";
import { todayISO } from "@/lib/format";
import { saveWorkOrder } from "../actions";
import { workOrderSections } from "../form-config";

export const metadata: Metadata = { title: "Nieuwe werkbon" };

export default async function NewWorkOrderPage({ searchParams }: PageProps<"/werkbonnen/nieuw">) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const [projects, employees] = await Promise.all([listProjects(ctx, { ...parseProjectFilters({}), status: "open" }), listEmployees(ctx)]);
  return (
    <ModuleGate ctx={ctx} module="werkbonnen">
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Nieuwe werkbon" breadcrumbs={[{ label: "Werkbonnen", href: "/werkbonnen" }, { label: "Nieuw" }]} description="Materialen en foto's voegt u na het opslaan toe." />
        <EntityForm
          action={saveWorkOrder}
          sections={workOrderSections(projects, employees, can(ctx.membership.role, "time.approve"))}
          initialValues={{ work_date: todayISO(ctx.settings.timezone), start_time: "07:00", end_time: "16:00", break_minutes: "30", project_id: typeof sp.project === "string" ? sp.project : "", employee_id: ctx.employeeId ?? "" }}
          submitLabel="Werkbon opslaan"
          cancelHref="/werkbonnen"
          readOnly={ctx.mode === "demo"}
        />
      </div>
    </ModuleGate>
  );
}
