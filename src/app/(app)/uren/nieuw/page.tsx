import type { Metadata } from "next";
import { EntityForm } from "@/components/ui/entity-form";
import { FormAlert } from "@/components/ui/field";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listProjects, parseProjectFilters } from "@/lib/data/projects";
import { listEmployees } from "@/lib/data/resources";
import { todayISO } from "@/lib/format";
import { saveTimeEntry } from "../actions";

export const metadata: Metadata = { title: "Uren registreren" };

export default async function NewTimeEntryPage({ searchParams }: PageProps<"/uren/nieuw">) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const [projects, employees] = await Promise.all([listProjects(ctx, { ...parseProjectFilters({}), status: "open" }), listEmployees(ctx)]);
  const manager = can(ctx.membership.role, "time.approve");
  const projectId = typeof sp.project === "string" ? sp.project : "";
  return (
    <ModuleGate ctx={ctx} module="uren">
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Uren registreren" breadcrumbs={[{ label: "Urenregistratie", href: "/uren" }, { label: "Nieuw" }]} />
        {!manager && !ctx.employeeId && ctx.mode !== "demo" && (
          <div className="mb-4"><FormAlert message="Uw account is nog niet gekoppeld aan een medewerker. Vraag uw beheerder dit in te stellen bij Medewerkers." /></div>
        )}
        <EntityForm
          action={saveTimeEntry}
          submitLabel="Uren opslaan"
          cancelHref="/uren"
          readOnly={ctx.mode === "demo"}
          hidden={{ back: projectId ? `/projecten/${projectId}?tab=uren` : "/uren" }}
          initialValues={{ entry_date: todayISO(ctx.settings.timezone), project_id: projectId, employee_id: ctx.employeeId ?? "", break_minutes: "0", submit_for_approval: "true" }}
          sections={[
            {
              fields: [
                { name: "project_id", label: "Project", type: "select", required: true, span: 6, options: [{ value: "", label: "Kies een project…" }, ...projects.map((p) => ({ value: p.id, label: `${p.project_number} — ${p.name}` }))] },
                ...(manager
                  ? [{ name: "employee_id", label: "Medewerker", type: "select" as const, required: true, span: 6 as const, options: [{ value: "", label: "Kies een medewerker…" }, ...employees.map((e) => ({ value: e.id, label: e.full_name }))] }]
                  : []),
                { name: "entry_date", label: "Datum", type: "date", required: true, span: 2 },
                { name: "start_time", label: "Begintijd", type: "time", span: 2 },
                { name: "end_time", label: "Eindtijd", type: "time", span: 2 },
                { name: "break_minutes", label: "Pauze (min.)", type: "number", span: 2, min: "0", max: "600" },
                { name: "hours", label: "Of: aantal uren", type: "decimal", span: 2, hint: "Alleen als u geen tijden invult" },
                { name: "description", label: "Werkzaamheden", type: "textarea", span: 6 },
                { name: "submit_for_approval", label: "Direct indienen ter goedkeuring", type: "checkbox", span: 6 },
              ],
            },
          ]}
        />
      </div>
    </ModuleGate>
  );
}
