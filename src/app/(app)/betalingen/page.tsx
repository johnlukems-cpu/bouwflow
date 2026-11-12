import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { InvoiceTable } from "@/components/lists/documents-lists";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { getAppContext } from "@/lib/auth/context";
import { listInvoices, listPayments } from "@/lib/data/finance";
import { formatMoney, toDecimal } from "@/lib/finance/money";
import { formatDate } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/types";

export const metadata: Metadata = { title: "Betalingen" };

export default async function PaymentsPage() {
  const ctx = await getAppContext();
  const [payments, invoices] = await Promise.all([listPayments(ctx, { limit: 300 }), listInvoices(ctx, { status: "final" })]);
  const open = invoices.filter((i) => i.invoice_type !== "credit" && toDecimal(i.outstanding ?? 0).greaterThan(0));
  const { currency_code: cur, locale } = ctx.settings;
  return (
    <ModuleGate ctx={ctx} module="betalingen">
      <PageHeader title="Betalingen" description="Ontvangen betalingen en openstaande facturen. Betalingen registreert u op de factuur; ze zijn onwijzigbaar (correctie via tegenboeking)." />
      <div className="space-y-6">
        <Card>
          <CardHeader title={`Openstaande facturen (${open.length})`} />
          <InvoiceTable invoices={open} locale={locale} />
        </Card>
        <Card>
          <CardHeader title="Ontvangen betalingen" />
          {payments.length === 0 ? <EmptyState icon={Wallet} title="Nog geen betalingen" /> : (
            <Table>
              <thead><tr><Th>Datum</Th><Th>Factuur</Th><Th className="hidden sm:table-cell">Wijze</Th><Th className="hidden md:table-cell">Referentie</Th><Th className="text-right">Bedrag</Th></tr></thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <Td className="whitespace-nowrap">{formatDate(p.paid_on)}</Td>
                    <Td><Link href={`/facturatie/${p.invoice_id}`} className="font-medium text-brand-700 hover:underline">{p.invoice?.invoice_number ?? "Factuur"}</Link><p className="text-xs text-slate-500">{p.invoice?.title}</p></Td>
                    <Td className="hidden sm:table-cell">{PAYMENT_METHOD_LABELS[p.method]}</Td>
                    <Td className="hidden md:table-cell">{p.reference ?? "—"}</Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">{formatMoney(p.amount, cur, locale)}</Td>
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
