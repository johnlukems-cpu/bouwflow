import type { FieldSection } from "@/components/ui/entity-form";
import type { Employee, Project } from "@/lib/types";

export function workOrderSections(projects: Project[], employees: Employee[], manager: boolean): FieldSection[] {
  return [
    {
      title: "Werkbon",
      fields: [
        { name: "project_id", label: "Project", type: "select", required: true, span: 6, options: [{ value: "", label: "Kies een project…" }, ...projects.map((p) => ({ value: p.id, label: `${p.project_number} — ${p.name}` }))] },
        ...(manager ? [{ name: "employee_id", label: "Medewerker", type: "select" as const, required: true, span: 6 as const, options: [{ value: "", label: "Kies…" }, ...employees.map((e) => ({ value: e.id, label: e.full_name }))] }] : []),
        { name: "work_date", label: "Datum", type: "date", required: true, span: 2 },
        { name: "start_time", label: "Begintijd", type: "time", required: true, span: 2 },
        { name: "end_time", label: "Eindtijd", type: "time", required: true, span: 2 },
        { name: "break_minutes", label: "Pauze (minuten)", type: "number", span: 2, min: "0", max: "600" },
        { name: "work_description", label: "Uitgevoerde werkzaamheden", type: "textarea", required: true, span: 6 },
        { name: "notes", label: "Opmerkingen", type: "textarea", span: 6 },
      ],
    },
  ];
}
