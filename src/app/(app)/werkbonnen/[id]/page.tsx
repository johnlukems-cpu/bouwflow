import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, FileDown, Send, Trash2, X } from "lucide-react";
import { DocumentList } from "@/components/lists/documents";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/card";
import { EntityForm, InlineForm } from "@/components/ui/entity-form";
import { FormAlert } from "@/components/ui/field";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { ApprovalBadge } from "@/components/ui/status";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getWorkOrder } from "@/lib/data/execution";
import { listDocuments } from "@/lib/data/finance";
import { listProjects, parseProjectFilters } from "@/lib/data/projects";
import { listEmployees, listMaterials } from "@/lib/data/resources";
import { formatDate } from "@/lib/format";
import { addWorkOrderMaterial, approveWorkOrder, removeWorkOrderMaterial, saveWorkOrder, setWorkOrderStatus } from "../actions";
import { workOrderSections } from "../form-config";

export const metadata: Metadata = { title: "Werkbon" };

export default async function WorkOrderPage({ params }: PageProps<"/werkbonnen/[id]">) {
  const { id } = await params;
  const ctx = await getAppContext();
  const data = await getWorkOrder(ctx, id);
  if (!data) notFound();
  const { workOrder: w, materials } = data;
  const manager = can(ctx.membership.role, "time.approve");
  const own = w.employee_id === ctx.employeeId;
  if (!manager && !own && !can(ctx.membership.role, "documents.write") && ctx.membership.role === "employee") notFound();
  const editable = (w.status === "draft" || w.status === "rejected") && (manager || own) && ctx.mode !== "demo";
  const [projects, employees, library, photos] = await Promise.all([
    listProjects(ctx, { ...parseProjectFilters({}), status: "all" }),
    listEmployees(ctx),
    listMaterials(ctx),
    listDocuments(ctx, { workOrderId: id }),
  ]);
  const values = Object.fromEntries(Object.entries(w).filter(([, v]) => typeof v !== "object" || v === null).map(([k, v]) => [k, v === null ? "" : String(v).slice(0, k.endsWith("_time") ? 5 : undefined)]));

  return (
    <ModuleGate ctx={ctx} module="werkbonnen">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title={`Werkbon ${w.work_order_number}`}
          breadcrumbs={[{ label: "Werkbonnen", href: "/werkbonnen" }, { label: w.work_order_number }]}
          meta={<ApprovalBadge status={w.status} />}
          actions={
            <>
              <LinkButton href={`/pdf/werkbon/${w.id}`} variant="secondary" target="_blank" prefetch={false}><FileDown className="size-4" aria-hidden /> PDF</LinkButton>
              {editable && (
                <form action={setWorkOrderStatus}>
                  <input type="hidden" name="id" value={w.id} />
                  <input type="hidden" name="status" value="submitted" />
                  <Button type="submit"><Send className="size-4" aria-hidden /> Indienen</Button>
                </form>
              )}
              {manager && w.status !== "approved" && ctx.mode !== "demo" && (
                <form action={approveWorkOrder}>
                  <input type="hidden" name="id" value={w.id} />
                  <Button type="submit" variant="info"><Check className="size-4" aria-hidden /> Goedkeuren</Button>
                </form>
              )}
            </>
          }
        />
        {w.status === "approved" && <FormAlert tone="info" message="Deze werkbon is goedgekeurd. Uren en materialen zijn eenmalig als projectkosten geboekt; de werkbon is vergrendeld." />}
        {w.status === "rejected" && w.rejection_reason && <FormAlert message={`Afgekeurd: ${w.rejection_reason}`} />}

        <Card>
          <CardHeader title="Gegevens" />
          <CardBody>
            <DescriptionList
              items={[
                { label: "Project", value: w.project ? <Link className="text-brand-700 hover:underline" href={`/projecten/${w.project_id}`}>{w.project.project_number} {w.project.name}</Link> : null },
                { label: "Medewerker", value: w.employee?.full_name },
                { label: "Datum", value: formatDate(w.work_date) },
                { label: "Tijd", value: `${w.start_time.slice(0, 5)} – ${w.end_time.slice(0, 5)} (pauze ${w.break_minutes} min.)` },
                { label: "Gewerkte uren", value: <strong>{Number(w.hours).toLocaleString("nl-NL")} uur</strong> },
              ]}
            />
            <div className="mt-5 rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Uitgevoerde werkzaamheden</p>
              <p className="mt-1 whitespace-pre-line text-sm">{w.work_description}</p>
              {w.notes && <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{w.notes}</p>}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Gebruikte materialen" description="Materialen met voorraadbeheer worden bij goedkeuring van de voorraad afgeboekt." />
          {materials.length === 0 ? <p className="px-5 py-4 text-sm text-slate-500">Geen materialen geregistreerd.</p> : (
            <ul className="divide-y divide-slate-100">
              {materials.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span>{m.description}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{Number(m.quantity).toLocaleString("nl-NL")} {m.unit}</span>
                    {editable && (
                      <form action={removeWorkOrderMaterial}>
                        <input type="hidden" name="work_order_id" value={w.id} />
                        <input type="hidden" name="material_line_id" value={m.id} />
                        <button type="submit" className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`${m.description} verwijderen`}><Trash2 className="size-4" /></button>
                      </form>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {editable && (
            <CardBody className="border-t border-slate-100">
              <InlineForm
                action={addWorkOrderMaterial}
                submitLabel="Materiaal toevoegen"
                hidden={{ work_order_id: w.id }}
                fields={[
                  { name: "material_id", label: "Materiaal", type: "select", span: 6, options: [{ value: "", label: "Overig (handmatig)" }, ...library.map((m) => ({ value: m.id, label: `${m.article_number} — ${m.description}` }))] },
                  { name: "description", label: "Omschrijving", span: 3, hint: "Leeg = uit bibliotheek" },
                  { name: "quantity", label: "Hoeveelheid", type: "decimal", required: true, span: 2 },
                  { name: "unit", label: "Eenheid", span: 1 },
                ]}
              />
            </CardBody>
          )}
        </Card>

        <DocumentList documents={photos} demo={ctx.mode === "demo"} canUpload={editable || (manager && ctx.mode !== "demo")} hidden={{ work_order_id: w.id, project_id: w.project_id }} back={`/werkbonnen/${w.id}`} title="Foto's en bijlagen" />

        {editable && (
          <EntityForm action={saveWorkOrder} sections={workOrderSections(projects, employees, manager)} initialValues={values} hidden={{ id: w.id }} submitLabel="Werkbon bijwerken" />
        )}

        {manager && w.status === "submitted" && ctx.mode !== "demo" && (
          <Card>
            <CardHeader title="Afkeuren" />
            <CardBody>
              <form action={setWorkOrderStatus} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <input type="hidden" name="id" value={w.id} />
                <input type="hidden" name="status" value="rejected" />
                <label className="flex-1 text-sm">
                  <span className="mb-1.5 block font-medium text-slate-700">Reden</span>
                  <input name="reason" className="h-11 w-full rounded-lg border-0 px-3 ring-1 ring-inset ring-slate-300" maxLength={1000} />
                </label>
                <Button type="submit" variant="danger"><X className="size-4" aria-hidden /> Afkeuren</Button>
              </form>
            </CardBody>
          </Card>
        )}
      </div>
    </ModuleGate>
  );
}
