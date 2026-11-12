import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown, Send, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EntityForm, InlineForm } from "@/components/ui/entity-form";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { PurchaseOrderBadge } from "@/components/ui/status";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getPurchaseOrder } from "@/lib/data/execution";
import { listProjects, parseProjectFilters } from "@/lib/data/projects";
import { listMaterials, listSuppliers } from "@/lib/data/resources";
import { COST_TYPES, COST_TYPE_LABELS } from "@/lib/finance/estimate";
import { formatMoney, sum, toDecimal } from "@/lib/finance/money";
import { formatDate, todayISO } from "@/lib/format";
import { addPurchaseLine, removePurchaseLine, savePurchaseOrder, setPurchaseOrderStatus } from "../actions";
import { purchaseOrderSections } from "../config";
import { ReceiveForm } from "../receive-form";

export const metadata: Metadata = { title: "Inkooporder" };

export default async function PurchaseOrderPage({ params }: PageProps<"/inkoop/[id]">) {
  const { id } = await params;
  const ctx = await getAppContext();
  const data = await getPurchaseOrder(ctx, id);
  if (!data) notFound();
  const { order: o, lines } = data;
  const canWrite = can(ctx.membership.role, "purchasing.write") && ctx.mode !== "demo";
  const draft = o.status === "draft";
  const [suppliers, projects, materials] = await Promise.all([listSuppliers(ctx), listProjects(ctx, { ...parseProjectFilters({}), status: "open" }), listMaterials(ctx)]);
  const m = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, o.currency_code, ctx.settings.locale);
  const total = sum(lines.map((l) => l.line_total));
  const values = Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v !== "object" || v === null).map(([k, v]) => [k, v === null ? "" : String(v)]));

  return (
    <ModuleGate ctx={ctx} module="inkoop">
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title={`Inkooporder ${o.purchase_order_number}`}
          breadcrumbs={[{ label: "Inkoop", href: "/inkoop" }, { label: o.purchase_order_number }]}
          meta={<PurchaseOrderBadge status={o.status} />}
          actions={
            <>
              <LinkButton href={`/pdf/inkooporder/${o.id}`} variant="secondary" target="_blank" prefetch={false}><FileDown className="size-4" aria-hidden /> PDF</LinkButton>
              {canWrite && draft && lines.length > 0 && (
                <form action={setPurchaseOrderStatus}>
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="status" value="ordered" />
                  <Button type="submit"><Send className="size-4" aria-hidden /> Bestellen</Button>
                </form>
              )}
              {canWrite && (draft || o.status === "ordered") && (
                <ConfirmAction action={setPurchaseOrderStatus} fields={{ id: o.id, status: "cancelled" }} trigger={<><XCircle className="size-4" aria-hidden /> Annuleren</>} title="Inkooporder annuleren?" description="Een geannuleerde order kan niet meer worden ontvangen." confirmLabel="Annuleren" />
              )}
            </>
          }
        />
        <Card>
          <CardHeader title="Gegevens" />
          <CardBody>
            <DescriptionList
              items={[
                { label: "Leverancier", value: o.supplier ? <Link href={`/leveranciers/${o.supplier_id}`} className="text-brand-700 hover:underline">{o.supplier.name}</Link> : null },
                { label: "Project", value: o.project ? <Link href={`/projecten/${o.project_id}?tab=inkoop`} className="text-brand-700 hover:underline">{o.project.project_number} {o.project.name}</Link> : "Magazijn" },
                { label: "Orderdatum", value: formatDate(o.order_date) },
                { label: "Verwachte levering", value: formatDate(o.expected_date) },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Orderregels" description="Levering naar voorraad verhoogt de voorraad; levering naar een project boekt direct de kosten op dat project." />
          {lines.length === 0 ? <p className="px-5 py-4 text-sm text-slate-600">Nog geen regels.</p> : (
            <ul className="divide-y divide-slate-100">
              {lines.map((l) => {
                const remaining = toDecimal(l.quantity).minus(l.quantity_received);
                return (
                  <li key={l.id} className="space-y-3 px-5 py-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{l.description}</p>
                        <p className="text-xs text-slate-600">
                          {Number(l.quantity).toLocaleString("nl-NL")} {l.unit} × {m(l.unit_cost)} ·{" "}
                          <Badge tone={l.destination === "stock" ? "blue" : "orange"}>{l.destination === "stock" ? "Naar voorraad" : `Project — ${COST_TYPE_LABELS[l.cost_type]}`}</Badge>
                        </p>
                        {!draft && <p className="mt-1 text-xs text-slate-600">Ontvangen: {Number(l.quantity_received).toLocaleString("nl-NL")} van {Number(l.quantity).toLocaleString("nl-NL")} {l.unit}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium tabular-nums">{m(l.line_total)}</span>
                        {canWrite && draft && (
                          <form action={removePurchaseLine}>
                            <input type="hidden" name="purchase_order_id" value={o.id} />
                            <input type="hidden" name="line_id" value={l.id} />
                            <button type="submit" className="rounded p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label={`${l.description} verwijderen`}><Trash2 className="size-4" /></button>
                          </form>
                        )}
                      </div>
                    </div>
                    {canWrite && (o.status === "ordered" || o.status === "partially_received") && remaining.greaterThan(0) && (
                      <ReceiveForm lineId={l.id} orderId={o.id} remaining={remaining.toString()} today={todayISO(ctx.settings.timezone)} unit={l.unit} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="border-t border-slate-100 px-5 py-3 text-right text-sm">Totaal: <strong className="tabular-nums">{m(total)}</strong></p>
          {canWrite && draft && (
            <CardBody className="border-t border-slate-100">
              <InlineForm
                action={addPurchaseLine}
                submitLabel="Regel toevoegen"
                hidden={{ purchase_order_id: o.id }}
                initialValues={{ destination: o.project_id ? "project" : "stock", cost_type: "material", project_id: o.project_id ?? "" }}
                fields={[
                  { name: "material_id", label: "Artikel", type: "select", span: 6, options: [{ value: "", label: "Geen — handmatige regel" }, ...materials.map((mat) => ({ value: mat.id, label: `${mat.article_number} — ${mat.description}${mat.track_stock ? " (voorraad)" : ""}` }))] },
                  { name: "description", label: "Omschrijving", span: 3, hint: "Leeg = uit bibliotheek" },
                  { name: "quantity", label: "Hoeveelheid", type: "decimal", required: true, span: 1 },
                  { name: "unit", label: "Eenheid", span: 1 },
                  { name: "unit_cost", label: "Inkoopprijs", type: "decimal", span: 1 },
                  { name: "destination", label: "Levering naar", type: "select", span: 2, options: [{ value: "stock", label: "Voorraad (magazijn)" }, { value: "project", label: "Project (directe kosten)" }] },
                  { name: "project_id", label: "Project", type: "select", span: 2, options: [{ value: "", label: "Projectorder" }, ...projects.map((p) => ({ value: p.id, label: `${p.project_number} — ${p.name}` }))] },
                  { name: "cost_type", label: "Kostensoort", type: "select", span: 2, options: COST_TYPES.map((t) => ({ value: t, label: COST_TYPE_LABELS[t] })) },
                ]}
              />
            </CardBody>
          )}
        </Card>

        {canWrite && draft && <EntityForm action={savePurchaseOrder} sections={purchaseOrderSections(suppliers, projects)} initialValues={values} hidden={{ id: o.id }} submitLabel="Ordergegevens opslaan" />}
      </div>
    </ModuleGate>
  );
}
