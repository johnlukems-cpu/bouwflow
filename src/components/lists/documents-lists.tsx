import Link from "next/link";
import { FileCheck2, Receipt } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { InvoiceTypeBadge, PaymentBadge, QuoteBadge } from "@/components/ui/status";
import { Table, Td, Th } from "@/components/ui/table";
import { formatMoney } from "@/lib/finance/money";
import { formatDate } from "@/lib/format";
import type { Invoice, Quote } from "@/lib/types";

export function QuoteTable({ quotes, locale, today, showCustomer = true }: { quotes: Quote[]; locale: string; today: string; showCustomer?: boolean }) {
  if (quotes.length === 0) return <EmptyState icon={FileCheck2} title="Geen offertes" />;
  return (
    <Table>
      <thead>
        <tr>
          <Th>Nummer</Th>
          <Th>Titel</Th>
          {showCustomer && <Th className="hidden md:table-cell">Klant</Th>}
          <Th className="hidden sm:table-cell">Datum</Th>
          <Th className="text-right">Totaal</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {quotes.map((q) => (
          <tr key={q.id} className="hover:bg-slate-50">
            <Td className="whitespace-nowrap font-mono text-xs text-slate-500">
              {q.quote_number}
              {q.version > 1 && <span className="ml-1 text-slate-400">v{q.version}</span>}
            </Td>
            <Td>
              <Link href={`/offertes/${q.id}`} className="font-medium text-slate-900 hover:text-brand-700">{q.title}</Link>
              {q.project && <p className="text-xs text-slate-500">{q.project.project_number} {q.project.name}</p>}
            </Td>
            {showCustomer && <Td className="hidden md:table-cell">{q.customer?.name}</Td>}
            <Td className="hidden sm:table-cell whitespace-nowrap">{formatDate(q.quote_date)}</Td>
            <Td className="whitespace-nowrap text-right tabular-nums">{formatMoney(q.total, q.currency_code, locale)}</Td>
            <Td><QuoteBadge status={q.status} validUntil={q.valid_until} today={today} /></Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function InvoiceTable({ invoices, locale, showCustomer = true }: { invoices: Invoice[]; locale: string; showCustomer?: boolean }) {
  if (invoices.length === 0) return <EmptyState icon={Receipt} title="Geen facturen" />;
  return (
    <Table>
      <thead>
        <tr>
          <Th>Nummer</Th>
          <Th>Omschrijving</Th>
          {showCustomer && <Th className="hidden md:table-cell">Klant</Th>}
          <Th className="hidden sm:table-cell">Vervaldatum</Th>
          <Th className="text-right">Totaal</Th>
          <Th className="hidden sm:table-cell text-right">Openstaand</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {invoices.map((i) => (
          <tr key={i.id} className="hover:bg-slate-50">
            <Td className="whitespace-nowrap font-mono text-xs text-slate-500">{i.invoice_number ?? "Concept"}</Td>
            <Td>
              <Link href={`/facturatie/${i.id}`} className="font-medium text-slate-900 hover:text-brand-700">{i.title}</Link>
              <div className="mt-0.5"><InvoiceTypeBadge type={i.invoice_type} /></div>
            </Td>
            {showCustomer && <Td className="hidden md:table-cell">{i.customer?.name}</Td>}
            <Td className="hidden sm:table-cell whitespace-nowrap">{formatDate(i.due_date)}</Td>
            <Td className="whitespace-nowrap text-right tabular-nums">{formatMoney(i.total, i.currency_code, locale)}</Td>
            <Td className="hidden sm:table-cell whitespace-nowrap text-right tabular-nums">{i.status === "final" && i.invoice_type !== "credit" ? formatMoney(i.outstanding ?? 0, i.currency_code, locale) : "—"}</Td>
            <Td>{i.payment_status && <PaymentBadge status={i.payment_status} />}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
