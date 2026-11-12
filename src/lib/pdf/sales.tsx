import "server-only";
import type { AppContext } from "@/lib/auth/context";
import { getCustomer } from "@/lib/data/customers";
import { formatDate } from "@/lib/format";
import { INVOICE_TYPE_LABELS, type DocumentLine, type Invoice, type Quote } from "@/lib/types";
import { issuerFromSettings, loadLogo } from "./render";
import { SalesDocumentPdf, type PdfLine, type PdfParty } from "./templates";

type Snapshot = { organization?: Record<string, unknown>; customer?: PdfParty; project?: { project_number: string; name: string; location?: string } | null; lines?: PdfLine[] };

/** Bouwt het PDF-document; definitieve documenten uit de momentopname, concepten uit actuele gegevens. */
export async function buildSalesPdf(ctx: AppContext, kind: "quote" | "invoice", doc: Quote | Invoice, liveLines: DocumentLine[]) {
  const snap = (doc.snapshot ?? null) as Snapshot | null;
  const live = snap ? null : await getCustomer(ctx, doc.customer_id);
  const issuer = snap?.organization ? issuerFromSettings(String(snap.organization.name ?? ctx.membership.organization.name), snap.organization) : issuerFromSettings(ctx.membership.organization.name, ctx.settings);
  const customer: PdfParty = snap?.customer ?? (live ? { ...live } : { name: doc.customer?.name ?? "Klant" });
  const lines: PdfLine[] = snap?.lines ?? liveLines;
  const project = snap?.project ?? (doc.project ? { project_number: doc.project.project_number, name: doc.project.name } : null);
  const logo = await loadLogo();
  const draft = doc.status === "draft";

  if (kind === "quote") {
    const q = doc as Quote;
    const number = `${q.quote_number}${q.version > 1 ? ` v${q.version}` : ""}`;
    return {
      filename: `Offerte-${number}.pdf`,
      element: (
        <SalesDocumentPdf
          logo={logo}
          issuer={issuer}
          kind="offerte"
          heading="Offerte"
          number={number}
          title={q.title}
          customer={customer}
          meta={[
            ["Offertenummer", number],
            ["Datum", formatDate(q.quote_date)],
            ["Geldig tot", formatDate(q.valid_until)],
            ...(project ? ([["Project", `${project.project_number} ${project.name}`]] as [string, string][]) : []),
          ]}
          intro={q.introduction}
          lines={lines}
          subtotal={q.subtotal}
          taxGroups={q.tax_breakdown}
          total={q.total}
          currency={q.currency_code}
          pricesIncludeTax={q.prices_include_tax}
          closing={q.terms}
          draft={draft}
        />
      ),
    };
  }
  const inv = doc as Invoice;
  const credit = inv.invoice_type === "credit";
  const number = inv.invoice_number ?? "CONCEPT";
  return {
    filename: `${credit ? "Creditnota" : "Factuur"}-${number}.pdf`,
    element: (
      <SalesDocumentPdf
        logo={logo}
        issuer={issuer}
        kind={credit ? "creditnota" : "factuur"}
        heading={INVOICE_TYPE_LABELS[inv.invoice_type]}
        number={number}
        title={inv.title}
        customer={customer}
        meta={[
          [credit ? "Creditnotanummer" : "Factuurnummer", number],
          ["Factuurdatum", formatDate(inv.invoice_date)],
          ...(!credit ? ([["Vervaldatum", formatDate(inv.due_date)]] as [string, string][]) : []),
          ...(project ? ([["Project", `${project.project_number} ${project.name}`]] as [string, string][]) : []),
        ]}
        lines={lines}
        subtotal={inv.subtotal}
        taxGroups={inv.tax_breakdown}
        total={inv.total}
        currency={inv.currency_code}
        pricesIncludeTax={inv.prices_include_tax}
        closingTitle="Betalingsvoorwaarden"
        closing={[inv.payment_terms, issuer.iban ? `Gelieve te betalen op rekening ${issuer.iban} onder vermelding van ${number}.` : null, inv.notes].filter(Boolean).join("\n")}
        payment={inv.status === "final" && !credit ? { paid: inv.paid ?? "0", credited: inv.credited ?? "0", outstanding: inv.outstanding ?? inv.total } : null}
        draft={draft}
      />
    ),
  };
}
