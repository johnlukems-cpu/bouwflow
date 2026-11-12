import { Plus } from "lucide-react";
import { DocumentList } from "@/components/lists/documents";
import { InvoiceTable, QuoteTable } from "@/components/lists/documents-lists";
import { PurchaseOrderTable, TimeEntryTable, WorkOrderTable } from "@/components/lists/execution-lists";
import { PostCalcTable } from "@/components/finance/post-calc";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { InlineForm } from "@/components/ui/entity-form";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import type { AppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listCostEntries, listEstimateLines, listPurchaseOrders, listTimeEntries, listWorkOrders } from "@/lib/data/execution";
import { getProjectFinancials, listDocuments, listInvoices, listQuotes } from "@/lib/data/finance";
import { listStockMovements } from "@/lib/data/resources";
import { COST_TYPES, COST_TYPE_LABELS } from "@/lib/finance/estimate";
import { formatMoney } from "@/lib/finance/money";
import { formatDate, todayISO } from "@/lib/format";
import type { Project } from "@/lib/types";
import { addCostEntry } from "../../actions";

type Props = { ctx: AppContext; project: Project };

const SOURCE_LABELS = { manual: "Handmatig", time_entry: "Uren", stock_movement: "Voorraad", purchase_receipt: "Inkoop", work_order_material: "Werkbon" } as const;

export async function MaterialsTab({ ctx, project }: Props) {
  const [lines, costs, movements] = await Promise.all([listEstimateLines(ctx, project.id), listCostEntries(ctx, project.id), listStockMovements(ctx, { projectId: project.id })]);
  const m = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, project.currency_code, ctx.settings.locale);
  const matLines = lines.filter((l) => l.cost_type === "material");
  const matCosts = costs.filter((c) => c.cost_type === "material");
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Begrote materialen" description="Uit de voorcalculatie (incl. verlies)" />
        {matLines.length === 0 ? <p className="px-5 py-4 text-sm text-slate-600">Geen materiaalregels in de calculatie.</p> : (
          <Table>
            <thead><tr><Th>Materiaal</Th><Th className="text-right">Hoeveelheid</Th><Th className="text-right">Kosten</Th></tr></thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {matLines.map((l) => (
                <tr key={l.id}><Td>{l.description}</Td><Td className="whitespace-nowrap text-right tabular-nums">{Number(l.quantity).toLocaleString("nl-NL")} {l.unit}</Td><Td className="whitespace-nowrap text-right tabular-nums">{m(l.cost_total)}</Td></tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Card>
        <CardHeader title="Werkelijk materiaalverbruik" description="Uit voorraaduitgifte, werkbonnen en inkoop (kostenregister)" />
        {matCosts.length === 0 ? <p className="px-5 py-4 text-sm text-slate-600">Nog geen materiaalkosten geboekt.</p> : (
          <Table>
            <thead><tr><Th>Datum</Th><Th>Omschrijving</Th><Th className="text-right">Bedrag</Th></tr></thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {matCosts.map((c) => (
                <tr key={c.id}><Td className="whitespace-nowrap">{formatDate(c.entry_date)}</Td><Td>{c.description}<p className="text-xs text-slate-600">{SOURCE_LABELS[c.source_type]}</p></Td><Td className="whitespace-nowrap text-right tabular-nums">{m(c.amount)}</Td></tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Card className="xl:col-span-2">
        <CardHeader title="Voorraadmutaties voor dit project" actions={can(ctx.membership.role, "stock.write") && <LinkButton href="/voorraad" size="sm" variant="secondary">Uitgifte boeken</LinkButton>} />
        {movements.length === 0 ? <p className="px-5 py-4 text-sm text-slate-600">Geen voorraadmutaties.</p> : (
          <Table>
            <thead><tr><Th>Datum</Th><Th>Artikel</Th><Th className="text-right">Hoeveelheid</Th></tr></thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {movements.map((s) => (
                <tr key={s.id}><Td>{formatDate(s.occurred_on)}</Td><Td>{s.material?.description}</Td><Td className="text-right tabular-nums">{s.movement_type === "issue" ? "−" : "+"}{Number(s.quantity).toLocaleString("nl-NL")} {s.material?.unit}</Td></tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

export async function HoursTab({ ctx, project }: Props) {
  const entries = await listTimeEntries(ctx, { projectId: project.id });
  const back = `/projecten/${project.id}?tab=uren`;
  return (
    <Card>
      <CardHeader
        title="Uren"
        description="Alleen goedgekeurde uren tellen als werkelijke arbeidskosten (tegen de kostprijs van de medewerker)."
        actions={can(ctx.membership.role, "time.register") && <LinkButton href={`/uren/nieuw?project=${project.id}`} size="sm"><Plus className="size-4" aria-hidden /> Uren registreren</LinkButton>}
      />
      <TimeEntryTable entries={entries} canApprove={can(ctx.membership.role, "time.approve")} back={back} showProject={false} demo={ctx.mode === "demo"} />
    </Card>
  );
}

export async function WorkOrdersTab({ ctx, project }: Props) {
  const workOrders = await listWorkOrders(ctx, { projectId: project.id });
  return (
    <Card>
      <CardHeader title="Werkbonnen" actions={can(ctx.membership.role, "time.register") && <LinkButton href={`/werkbonnen/nieuw?project=${project.id}`} size="sm"><Plus className="size-4" aria-hidden /> Werkbon</LinkButton>} />
      <WorkOrderTable workOrders={workOrders} showProject={false} />
    </Card>
  );
}

export async function PurchasingTab({ ctx, project }: Props) {
  const orders = await listPurchaseOrders(ctx, { projectId: project.id });
  return (
    <Card>
      <CardHeader title="Inkoop" actions={can(ctx.membership.role, "purchasing.write") && <LinkButton href={`/inkoop/nieuw?project=${project.id}`} size="sm"><Plus className="size-4" aria-hidden /> Inkooporder</LinkButton>} />
      <PurchaseOrderTable orders={orders} locale={ctx.settings.locale} showProject={false} />
    </Card>
  );
}

export async function QuotesTab({ ctx, project }: Props) {
  const quotes = await listQuotes(ctx, { projectId: project.id });
  return (
    <Card>
      <CardHeader title="Offertes" actions={can(ctx.membership.role, "quotes.write") && <LinkButton href={`/offertes/nieuw?project=${project.id}`} size="sm"><Plus className="size-4" aria-hidden /> Offerte</LinkButton>} />
      <QuoteTable quotes={quotes} locale={ctx.settings.locale} today={todayISO(ctx.settings.timezone)} showCustomer={false} />
    </Card>
  );
}

export async function InvoicesTab({ ctx, project }: Props) {
  const invoices = await listInvoices(ctx, { projectId: project.id });
  return (
    <Card>
      <CardHeader title="Facturen" description="Voorschot-, termijn- en eindfacturen maakt u vanuit een geaccepteerde offerte." actions={can(ctx.membership.role, "invoices.write") && <LinkButton href={`/facturatie/nieuw?project=${project.id}`} size="sm"><Plus className="size-4" aria-hidden /> Factuur</LinkButton>} />
      <InvoiceTable invoices={invoices} locale={ctx.settings.locale} showCustomer={false} />
    </Card>
  );
}

export async function PostCalcTab({ ctx, project }: Props) {
  const [fin, costs] = await Promise.all([getProjectFinancials(ctx, project.id), listCostEntries(ctx, project.id)]);
  const m = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, project.currency_code, ctx.settings.locale);
  const canCost = can(ctx.membership.role, "costs.write");
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <LinkButton href={`/pdf/nacalculatie/${project.id}`} variant="secondary" target="_blank" prefetch={false}>Na-calculatie als PDF</LinkButton>
      </div>
      {fin && <PostCalcTable financials={fin} basis={ctx.settings.revenue_basis} warningPercent={ctx.settings.budget_warning_percent} locale={ctx.settings.locale} />}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Kostenregister" description="Elke werkelijke kost staat hier precies één keer, met de bron. Correcties boekt u als tegenboeking (negatief bedrag)." />
          {costs.length === 0 ? <p className="px-5 py-4 text-sm text-slate-600">Nog geen werkelijke kosten geboekt.</p> : (
            <Table>
              <thead><tr><Th>Datum</Th><Th>Omschrijving</Th><Th className="hidden sm:table-cell">Bron</Th><Th className="text-right">Bedrag</Th></tr></thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {costs.map((c) => (
                  <tr key={c.id}>
                    <Td className="whitespace-nowrap">{formatDate(c.entry_date)}</Td>
                    <Td>{c.description}<p className="text-xs text-slate-600">{COST_TYPE_LABELS[c.cost_type]}</p></Td>
                    <Td className="hidden sm:table-cell"><Badge tone={c.source_type === "manual" ? "slate" : "blue"}>{SOURCE_LABELS[c.source_type]}</Badge></Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">{m(c.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        {canCost && (
          <Card>
            <CardHeader title="Kosten handmatig boeken" description="Bijv. transport, onderaanneming of overige kosten die niet via inkoop, voorraad of uren lopen." />
            <CardBody>
              <InlineForm
                action={addCostEntry}
                submitLabel="Kosten boeken"
                disabled={ctx.mode === "demo"}
                hidden={{ project_id: project.id }}
                initialValues={{ cost_type: "transport", entry_date: todayISO(ctx.settings.timezone) }}
                fields={[
                  { name: "cost_type", label: "Kostensoort", type: "select", span: 6, options: COST_TYPES.map((t) => ({ value: t, label: COST_TYPE_LABELS[t] })) },
                  { name: "description", label: "Omschrijving", required: true, span: 6 },
                  { name: "amount", label: "Bedrag", type: "decimal", required: true, span: 3 },
                  { name: "entry_date", label: "Datum", type: "date", span: 3 },
                ]}
              />
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

export async function DocumentsTab({ ctx, project }: Props) {
  const docs = await listDocuments(ctx, { projectId: project.id });
  return (
    <DocumentList
      documents={docs}
      demo={ctx.mode === "demo"}
      canUpload={can(ctx.membership.role, "documents.write")}
      hidden={{ project_id: project.id }}
      back={`/projecten/${project.id}?tab=documenten`}
      title="Projectdocumenten"
    />
  );
}
