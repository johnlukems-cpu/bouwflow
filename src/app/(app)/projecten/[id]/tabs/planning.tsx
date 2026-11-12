import { CalendarDays } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineForm } from "@/components/ui/entity-form";
import { TaskBadge } from "@/components/ui/status";
import type { AppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listTasks } from "@/lib/data/execution";
import { listEmployees } from "@/lib/data/resources";
import { formatDate } from "@/lib/format";
import { TASK_STATUS_LABELS, type Project } from "@/lib/types";
import { saveTask, setTaskStatus } from "../../actions";

export async function PlanningTab({ ctx, project }: { ctx: AppContext; project: Project }) {
  const [tasks, employees] = await Promise.all([listTasks(ctx, { projectId: project.id }), listEmployees(ctx)]);
  const canWrite = can(ctx.membership.role, "tasks.write") && ctx.mode !== "demo";
  const back = `/projecten/${project.id}?tab=planning`;
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader title="Taken en planning" description={`Projectperiode: ${formatDate(project.start_date)} – ${formatDate(project.expected_end_date)}`} />
        {tasks.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Nog geen taken" description="Plan taken en wijs medewerkers toe; ze verschijnen in de weekplanning." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{t.title}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(t.start_date)} – {formatDate(t.end_date)} · {t.employee?.full_name ?? "Niet toegewezen"}
                    {t.planned_hours && ` · ${Number(t.planned_hours).toLocaleString("nl-NL")} uur`}
                  </p>
                </div>
                {canWrite ? (
                  <form action={setTaskStatus} className="flex items-center gap-2">
                    <input type="hidden" name="task_id" value={t.id} />
                    <input type="hidden" name="back" value={back} />
                    <label className="sr-only" htmlFor={`st-${t.id}`}>Status</label>
                    <select id={`st-${t.id}`} name="status" defaultValue={t.status} className="h-9 rounded-lg border-0 bg-white px-2 text-sm ring-1 ring-inset ring-slate-300">
                      {Object.entries(TASK_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <button type="submit" className="h-9 rounded-lg px-3 text-sm font-medium text-brand-700 hover:bg-brand-50">Opslaan</button>
                  </form>
                ) : (
                  <TaskBadge status={t.status} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {canWrite && (
        <Card>
          <CardHeader title="Taak toevoegen" />
          <CardBody>
            <InlineForm
              action={saveTask}
              submitLabel="Taak toevoegen"
              hidden={{ project_id: project.id }}
              initialValues={{ status: "todo", start_date: project.start_date ?? "", end_date: "" }}
              fields={[
                { name: "title", label: "Taak", required: true, span: 6 },
                { name: "employee_id", label: "Medewerker", type: "select", span: 6, options: [{ value: "", label: "Nog niet toegewezen" }, ...employees.map((e) => ({ value: e.id, label: e.full_name }))] },
                { name: "start_date", label: "Start", type: "date", span: 3 },
                { name: "end_date", label: "Einde", type: "date", span: 3 },
                { name: "planned_hours", label: "Geplande uren", type: "decimal", span: 3 },
                { name: "status", label: "Status", type: "select", span: 3, options: Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
              ]}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
