import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { InlineForm } from "@/components/ui/entity-form";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { TaskBadge } from "@/components/ui/status";
import { cn } from "@/components/ui/cn";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listTasks } from "@/lib/data/execution";
import { listProjects, parseProjectFilters } from "@/lib/data/projects";
import { listEmployees } from "@/lib/data/resources";
import { todayISO } from "@/lib/format";
import { TASK_STATUS_LABELS } from "@/lib/types";
import { saveTask } from "../projecten/actions";

export const metadata: Metadata = { title: "Planning" };

const DAY = 86400000;
function mondayOf(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  const wd = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - wd * DAY).toISOString().slice(0, 10);
}
const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);
const DAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

export default async function PlanningPage({ searchParams }: PageProps<"/planning">) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const today = todayISO(ctx.settings.timezone);
  const week = typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? mondayOf(sp.week) : mondayOf(today);
  const end = addDays(week, 6);
  const [tasks, employees, projects] = await Promise.all([listTasks(ctx, { from: week, to: end }), listEmployees(ctx), listProjects(ctx, { ...parseProjectFilters({}), status: "open" })]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const rows = [...employees.map((e) => ({ id: e.id, name: e.full_name })), { id: "", name: "Niet toegewezen" }];
  const canWrite = can(ctx.membership.role, "tasks.write") && ctx.mode !== "demo";

  return (
    <ModuleGate ctx={ctx} module="planning">
      <PageHeader
        title="Planning"
        description={`Week van ${days[0].split("-").reverse().join("-")} t/m ${end.split("-").reverse().join("-")}`}
        actions={
          <div className="flex gap-2">
            <LinkButton href={`/planning?week=${addDays(week, -7)}`} variant="secondary" aria-label="Vorige week"><ChevronLeft className="size-4" /></LinkButton>
            <LinkButton href="/planning" variant="secondary">Deze week</LinkButton>
            <LinkButton href={`/planning?week=${addDays(week, 7)}`} variant="secondary" aria-label="Volgende week"><ChevronRight className="size-4" /></LinkButton>
          </div>
        }
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-[56rem] w-full table-fixed text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-44 px-3 py-2 text-left">Medewerker</th>
                {days.map((d, i) => (
                  <th key={d} className={cn("px-2 py-2 text-left", d === today && "text-accent-700")}>{DAYS[i]} {d.slice(8)}-{d.slice(5, 7)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const mine = tasks.filter((t) => (t.employee_id ?? "") === r.id);
                if (r.id === "" && mine.length === 0) return null;
                return (
                  <tr key={r.id || "none"} className="align-top">
                    <td className="px-3 py-2 font-medium text-slate-800">{r.name}</td>
                    {days.map((d) => (
                      <td key={d} className={cn("px-1.5 py-1.5", d === today && "bg-accent-50/40")}>
                        {mine
                          .filter((t) => (!t.start_date || t.start_date <= d) && (!t.end_date || t.end_date >= d))
                          .map((t) => (
                            <Link key={t.id} href={`/projecten/${t.project_id}?tab=planning`} className="mb-1 block rounded-md bg-brand-50 px-2 py-1 text-xs text-brand-700 ring-1 ring-brand-100 hover:bg-brand-100" title={`${t.title} — ${t.project?.name ?? ""}`}>
                              <span className="block truncate font-medium">{t.title}</span>
                              <span className="block truncate text-[11px] text-slate-500">{t.project?.project_number}</span>
                            </Link>
                          ))}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Taken deze week" />
          {tasks.length === 0 ? <p className="px-5 py-4 text-sm text-slate-500">Geen taken gepland in deze week.</p> : (
            <ul className="divide-y divide-slate-100">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.title}</p>
                    <p className="truncate text-xs text-slate-500">{t.project?.project_number} {t.project?.name} · {t.employee?.full_name ?? "Niet toegewezen"}</p>
                  </div>
                  <TaskBadge status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        {canWrite && (
          <Card>
            <CardHeader title="Taak inplannen" />
            <CardBody>
              <InlineForm
                action={saveTask}
                submitLabel="Inplannen"
                hidden={{ back: "planning" }}
                initialValues={{ status: "todo", start_date: week, end_date: addDays(week, 4) }}
                fields={[
                  { name: "project_id", label: "Project", type: "select", required: true, span: 6, options: [{ value: "", label: "Kies een project…" }, ...projects.map((p) => ({ value: p.id, label: `${p.project_number} — ${p.name}` }))] },
                  { name: "title", label: "Taak", required: true, span: 6 },
                  { name: "employee_id", label: "Medewerker", type: "select", span: 6, options: [{ value: "", label: "Nog niet toegewezen" }, ...employees.map((e) => ({ value: e.id, label: e.full_name }))] },
                  { name: "start_date", label: "Start", type: "date", span: 3 },
                  { name: "end_date", label: "Einde", type: "date", span: 3 },
                  { name: "planned_hours", label: "Uren", type: "decimal", span: 3 },
                  { name: "status", label: "Status", type: "select", span: 3, options: Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
                ]}
              />
            </CardBody>
          </Card>
        )}
      </div>
    </ModuleGate>
  );
}
