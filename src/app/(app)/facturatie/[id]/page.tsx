import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown, FileMinus2, Lock, Undo2, X } from "lucide-react";
import { DocumentLinesCard } from "@/components/finance/document-lines";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EntityForm } from "@/components/ui/entity-form";
import { FormAlert } from "@/components/ui/field";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { InvoiceTypeBadge, PaymentBadge } from "@/components/ui/status";
import { Table, Td, Th } from "@/components/ui/table";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listCustomerOptions } from "@/lib/data/customers";
import { getInvoice, listActiveTaxRates } from "@/lib/data/finance";
import { listProjects, parseProjectFilters } from "@/lib/data/projects";
import { formatMoney, toDecimal } from "@/lib/finance/money";
import { formatDate, todayISO } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/types";
import { addInvoiceLine, cancelDraftInvoice, createCreditNote, finalizeInvoice, removeInvoiceLine, reversePayment, saveInvoice } from "../actions";
import { invoiceSections } from "../config";
import { PaymentForm } from "../payment-form";

export const metadata: Metadata = { title: "Factuur" };

export default async function InvoicePage({ params }: PageProps<"/facturatie/[id]">) {
  const { id } = await params;
  const ctx = await getAppContext();
  const data = await getInvoice(ctx, id);
  if (!data) notFound();
  const { invoice: inv, lines, payments } = data;
  const canWrite = can(ctx.membership.role, "invoices.write") && ctx.mode !== "demo";
  const canPay = can(ctx.membership.role, "payments.write") && ctx.mode !== "demo";
  const draft = inv.status === "draft";
  const isCredit = inv.invoice_type === "credit";
  const [taxRates, customers, projects] = await Promise.all([listActiveTaxRates(ctx), listCustomerOptions(ctx), listProjects(ctx, { ...parseProjectFilters({}), status: "all" })]);
  const m = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, inv.currency_code, ctx.settings.locale);
  const values = Object.fromEntries(Object.entries(inv).filter(([, v]) => typeof v !== "object" || v === null).map(([k, v]) => [k, v === null ? "" : String(v)]));
  const reversed = new Set(payments.filter((p) => p.reversed_payment_id).map((p) => p.reversed_payment_id));

  return (
    <ModuleGate ctx={ctx} module="facturatie">
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title={inv.title}
          breadcrumbs={[{ label: "Facturatie", href: "/facturatie" }, { label: inv.invoice_number ?? "Concept" }]}
          meta={
            <>
              <span className="font-mono text-sm text-slate-600">{inv.invoice_number ?? "Concept (nog geen nummer)"}</span>
              <InvoiceTypeBadge type={inv.invoice_type} />
              {inv.payment_status && <PaymentBadge status={inv.payment_status} />}
            </>
          }
          actions={
            <>
              <LinkButton href={`/pdf/factuur/${inv.id}`} variant="secondary" target="_blank" prefetch={false}><FileDown className="size-4" aria-hidden /> PDF</LinkButton>
              {canWrite && draft && lines.length > 0 && (
                <ConfirmAction action={finalizeInvoice} fields={{ id: inv.id }} variant="secondary" trigger={<><Lock className="size-4" aria-hidden /> Definitief maken</>} title={isCredit ? "Creditnota definitief maken?" : "Factuur definitief maken?"} description="Er wordt een doorlopend nummer toegekend en een momentopname bewaard. Daarna kan de factuur niet meer worden gewijzigd of geannuleerd; correcties gaan via een creditnota." confirmLabel="Definitief maken" confirmVariant="primary" />
              )}
              {canWrite && inv.status === "final" && !isCredit && (
                <>
                  <form action={createCreditNote}><input type="hidden" name="id" value={inv.id} /><input type="hidden" name="full" value="true" /><Button type="submit" variant="secondary"><FileMinus2 className="size-4" aria-hidden /> Volledig crediteren</Button></form>
                  <form action={createCreditNote}><input type="hidden" name="id" value={inv.id} /><input type="hidden" name="full" value="false" /><Button type="submit" variant="ghost">Deelcreditnota</Button></form>
                </>
              )}
              {canWrite && draft && <ConfirmAction action={cancelDraftInvoice} fields={{ id: inv.id }} trigger={<><X className="size-4" aria-hidden /> Annuleren</>} title="Conceptfactuur annuleren?" description="Het concept wordt geannuleerd; er is nog geen factuurnummer gebruikt." confirmLabel="Annuleren" />}
            </>
          }
        />
        {isCredit && draft && <FormAlert tone="info" message="Creditnota: gebruik negatieve aantallen (bijv. −1). Het totaal moet negatief zijn en mag niet hoger zijn dan het nog niet gecrediteerde bedrag." />}

        <Card>
          <CardHeader title="Gegevens" />
          <CardBody>
            <DescriptionList
              items={[
                { label: "Klant", value: inv.customer ? <Link href={`/klanten/${inv.customer_id}`} className="text-brand-700 hover:underline">{inv.customer.name}</Link> : null },
                { label: "Project", value: inv.project ? <Link href={`/projecten/${inv.project_id}?tab=facturen`} className="text-brand-700 hover:underline">{inv.project.project_number} {inv.project.name}</Link> : null },
                { label: "Factuurdatum", value: formatDate(inv.invoice_date) },
                { label: "Vervaldatum", value: formatDate(inv.due_date) },
                ...(inv.quote_id ? [{ label: "Offerte", value: <Link href={`/offertes/${inv.quote_id}`} className="text-brand-700 hover:underline">Bekijk offerte</Link> }] : []),
                ...(inv.credited_invoice_id ? [{ label: "Crediteert", value: <Link href={`/facturatie/${inv.credited_invoice_id}`} className="text-brand-700 hover:underline">Oorspronkelijke factuur</Link> }] : []),
                ...(inv.payment_terms ? [{ label: "Betalingsvoorwaarden", value: inv.payment_terms }] : []),
              ]}
            />
          </CardBody>
        </Card>

        <DocumentLinesCard lines={lines} totals={inv} currency={inv.currency_code} locale={ctx.settings.locale} editable={canWrite && draft} taxRates={taxRates} parentField="invoice_id" parentId={inv.id} addAction={addInvoiceLine} removeAction={removeInvoiceLine} pricesIncludeTax={inv.prices_include_tax} allowNegative />

        {inv.status === "final" && !isCredit && (
          <Card>
            <CardHeader title="Betalingen" description={`Totaal ${m(inv.total)} · gecrediteerd ${m(inv.credited ?? 0)} · betaald ${m(inv.paid ?? 0)} · openstaand ${m(inv.outstanding ?? 0)}`} />
            {payments.length > 0 && (
              <Table>
                <thead><tr><Th>Datum</Th><Th>Wijze</Th><Th className="hidden sm:table-cell">Referentie</Th><Th className="text-right">Bedrag</Th>{canPay && <Th><span className="sr-only">Acties</span></Th>}</tr></thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <Td className="whitespace-nowrap">{formatDate(p.paid_on)}</Td>
                      <Td>{PAYMENT_METHOD_LABELS[p.method]}</Td>
                      <Td className="hidden sm:table-cell">{p.reference ?? "—"}</Td>
                      <Td className={`whitespace-nowrap text-right tabular-nums ${toDecimal(p.amount).isNegative() ? "text-red-700" : ""}`}>{m(p.amount)}</Td>
                      {canPay && (
                        <Td className="text-right">
                          {!p.reversed_payment_id && !reversed.has(p.id) && (
                            <ConfirmAction action={reversePayment} fields={{ payment_id: p.id, invoice_id: inv.id }} variant="ghost" trigger={<><Undo2 className="size-4" aria-hidden /> Tegenboeken</>} title="Betaling tegenboeken?" description="Betalingen zijn onwijzigbaar. Er wordt een tegenboeking met hetzelfde bedrag (negatief) geregistreerd." confirmLabel="Tegenboeken" />
                          )}
                        </Td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            {canPay && toDecimal(inv.outstanding ?? 0).greaterThan(0) && (
              <CardBody className="border-t border-slate-100">
                <PaymentForm invoiceId={inv.id} outstanding={inv.outstanding ?? "0"} today={todayISO(ctx.settings.timezone)} />
              </CardBody>
            )}
          </Card>
        )}

        {canWrite && draft && <EntityForm action={saveInvoice} sections={invoiceSections(customers, projects, true)} initialValues={values} hidden={{ id: inv.id }} submitLabel="Factuurgegevens opslaan" />}
      </div>
    </ModuleGate>
  );
}
