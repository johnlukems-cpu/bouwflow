import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { EntityForm } from "@/components/ui/entity-form";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { ApprovalBadge } from "@/components/ui/status";
import { Table, Td, Th } from "@/components/ui/table";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listTimeEntries } from "@/lib/data/execution";
import { listMembers } from "@/lib/data/projects";
import { getEmployee } from "@/lib/data/resources";
import { formatDate } from "@/lib/format";
import { saveEmployee } from "../actions";
import { employeeSections } from "../config";

export const metadata: Metadata = { title: "Medewerker" };

export default async function EmployeePage({ params }: PageProps<"/medewerkers/[id]">) {
  const { id } = await params;
  const ctx = await getAppContext();
  const employee = await getEmployee(ctx, id);
  if (!employee) notFound();
  const [members, entries] = await Promise.all([listMembers(ctx), listTimeEntries(ctx, { employeeId: id })]);
  const canWrite = can(ctx.membership.role, "employees.write");
  const values = Object.fromEntries(Object.entries(employee).map(([k, v]) => [k, v === null ? "" : String(v)]));
  return (
    <ModuleGate ctx={ctx} module="medewerkers">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader title={employee.full_name} breadcrumbs={[{ label: "Medewerkers", href: "/medewerkers" }, { label: employee.employee_number }]} />
        <EntityForm action={saveEmployee} sections={employeeSections(members)} initialValues={values} hidden={{ id: employee.id }} submitLabel="Wijzigingen opslaan" readOnly={ctx.mode === "demo" || !canWrite} />
        <Card>
          <CardHeader title="Recente uren" />
          {entries.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-600">Nog geen uren geregistreerd.</p>
          ) : (
            <Table>
              <thead>
                <tr><Th>Datum</Th><Th>Project</Th><Th className="text-right">Uren</Th><Th>Status</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {entries.slice(0, 20).map((t) => (
                  <tr key={t.id}>
                    <Td className="whitespace-nowrap">{formatDate(t.entry_date)}</Td>
                    <Td>{t.project?.project_number} {t.project?.name}</Td>
                    <Td className="text-right tabular-nums">{Number(t.hours).toLocaleString("nl-NL")}</Td>
                    <Td><ApprovalBadge status={t.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </ModuleGate>
  );
}
