import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Copy, FileDown, Send, X } from "lucide-react";
import { DocumentLinesCard } from "@/components/finance/document-lines";
import { InvoiceTable } from "@/components/lists/documents-lists";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EntityForm } from "@/components/ui/entity-form";
import { FormAlert } from "@/components/ui/field";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { QuoteBadge } from "@/components/ui/status";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listCustomerOptions } from "@/lib/data/customers";
import { getQuote, listActiveTaxRates, listInvoices } from "@/lib/data/finance";
import { listProjects, parseProjectFilters } from "@/lib/data/projects";
import { formatDate, formatDateTime, todayISO } from "@/lib/format";
import { addQuoteLine, cancelQuote, removeQuoteLine, respondQuote, reviseQuote, saveQuote, sendQuote } from "../actions";
import { quoteSections } from "../config";
import { InvoiceFromQuoteForm } from "../invoice-from-quote";

export const metadata: Metadata = { title: "Offerte" };

export default async function QuotePage({ params }: PageProps<"/offertes/[id]">) {
  const { id } = await params;
  const ctx = await getAppContext();
  const data = await getQuote(ctx, id);
  if (!data) notFound();
  const { quote: q, lines } = data;
  const canWrite = can(ctx.membership.role, "quotes.write") && ctx.mode !== "demo";
  const draft = q.status === "draft";
  const today = todayISO(ctx.settings.timezone);
  const [taxRates, customers, projects, invoices] = await Promise.all([
    listActiveTaxRates(ctx),
    listCustomerOptions(ctx),
    listProjects(ctx, { ...parseProjectFilters({}), status: "all" }),
    listInvoices(ctx, {}),
  ]);
  const quoteInvoices = invoices.filter((i) => i.quote_id === q.id);
  const values = Object.fromEntries(Object.entries(q).filter(([, v]) => typeof v !== "object" || v === null).map(([k, v]) => [k, v === null ? "" : String(v)]));

  return (
    <ModuleGate ctx={ctx} module="offertes">
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title={q.title}
          breadcrumbs={[{ label: "Offertes", href: "/offertes" }, { label: `${q.quote_number}${q.version > 1 ? ` v${q.version}` : ""}` }]}
          meta={
            <>
              <span className="font-mono text-sm text-slate-600">{q.quote_number}{q.version > 1 && ` versie ${q.version}`}</span>
              <QuoteBadge status={q.status} validUntil={q.valid_until} today={today} />
            </>
          }
          actions={
            <>
              <LinkButton href={`/pdf/offerte/${q.id}`} variant="secondary" target="_blank" prefetch={false}><FileDown className="size-4" aria-hidden /> PDF</LinkButton>
              {canWrite && draft && lines.length > 0 && (
                <ConfirmAction action={sendQuote} fields={{ id: q.id }} variant="secondary" trigger={<><Send className="size-4" aria-hidden /> Definitief maken</>} title="Offerte definitief maken?" description="De offerte wordt vergrendeld en er wordt een momentopname van klant, regels, prijzen en belasting bewaard. Daarna kan de klant accepteren (ook via het klantportaal)." confirmLabel="Definitief maken" confirmVariant="primary" />
              )}
              {canWrite && (q.status === "sent" || q.status === "rejected") && (
                <form action={reviseQuote}><input type="hidden" name="id" value={q.id} /><Button type="submit" variant="secondary"><Copy className="size-4" aria-hidden /> Nieuwe versie</Button></form>
              )}
              {canWrite && draft && <ConfirmAction action={cancelQuote} fields={{ id: q.id }} trigger={<><X className="size-4" aria-hidden /> Annuleren</>} title="Offerte annuleren?" description="De concept-offerte wordt geannuleerd (niet verwijderd)." confirmLabel="Annuleren" />}
            </>
          }
        />
        {q.status === "sent" && q.valid_until && q.valid_until < today && <FormAlert message="Deze offerte is verlopen. Maak een nieuwe versie om de klant opnieuw een aanbod te doen." />}

        <Card>
          <CardHeader title="Gegevens" />
          <CardBody>
            <DescriptionList
              items={[
                { label: "Klant", value: q.customer ? <Link href={`/klanten/${q.customer_id}`} className="text-brand-700 hover:underline">{q.customer.name}</Link> : null },
                { label: "Project", value: q.project ? <Link href={`/projecten/${q.project_id}?tab=offertes`} className="text-brand-700 hover:underline">{q.project.project_number} {q.project.name}</Link> : null },
                { label: "Offertedatum", value: formatDate(q.quote_date) },
                { label: "Geldig tot", value: formatDate(q.valid_until) },
                ...(q.sent_at ? [{ label: "Definitief gemaakt", value: formatDateTime(q.sent_at, ctx.settings.locale, ctx.settings.timezone) }] : []),
                ...(q.responded_at ? [{ label: q.status === "accepted" ? "Geaccepteerd" : "Afgewezen", value: `${formatDateTime(q.responded_at, ctx.settings.locale, ctx.settings.timezone)} door ${q.responded_by_name ?? "—"} (${q.responded_via === "portal" ? "klantportaal" : "intern"})` }] : []),
              ]}
            />
          </CardBody>
        </Card>

        <DocumentLinesCard
          lines={lines}
          totals={q}
          currency={q.currency_code}
          locale={ctx.settings.locale}
          editable={canWrite && draft}
          taxRates={taxRates}
          parentField="quote_id"
          parentId={q.id}
          addAction={addQuoteLine}
          removeAction={removeQuoteLine}
          pricesIncludeTax={q.prices_include_tax}
        />

        {canWrite && q.status === "sent" && (
          <Card>
            <CardHeader title="Reactie van de klant registreren" description="Bij acceptatie wordt de verkoopwaarde van het project bijgewerkt (opdracht)." />
            <CardBody>
              <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <input type="hidden" name="id" value={q.id} />
                <label className="flex-1 text-sm">
                  <span className="mb-1.5 block font-medium text-slate-700">Naam ondertekenaar</span>
                  <input name="by_name" maxLength={200} className="h-11 w-full rounded-lg border-0 px-3 ring-1 ring-inset ring-slate-300 sm:h-10" />
                </label>
                <Button type="submit" formAction={respondQuote} name="accept" value="true"><Check className="size-4" aria-hidden /> Geaccepteerd</Button>
                <Button type="submit" formAction={respondQuote} name="accept" value="false" variant="danger"><X className="size-4" aria-hidden /> Afgewezen</Button>
              </form>
            </CardBody>
          </Card>
        )}

        {q.status === "accepted" && can(ctx.membership.role, "invoices.write") && (
          <Card>
            <CardHeader title="Factureren" description="Workflow: offerte → voorschot-/termijnfacturen → eindfactuur → betalingen." />
            <CardBody><InvoiceFromQuoteForm quoteId={q.id} disabled={ctx.mode === "demo"} /></CardBody>
          </Card>
        )}
        {quoteInvoices.length > 0 && (
          <Card>
            <CardHeader title="Facturen bij deze offerte" />
            <InvoiceTable invoices={quoteInvoices} locale={ctx.settings.locale} showCustomer={false} />
          </Card>
        )}

        {canWrite && draft && <EntityForm action={saveQuote} sections={quoteSections(customers, projects)} initialValues={values} hidden={{ id: q.id }} submitLabel="Offertegegevens opslaan" />}
      </div>
    </ModuleGate>
  );
}
