import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { InvoiceTable } from "@/components/lists/documents-lists";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { KpiCard } from "@/components/ui/kpi-card";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { AlertTriangle, Receipt, Wallet } from "lucide-react";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listInvoices } from "@/lib/data/finance";
import { formatMoney, sum } from "@/lib/finance/money";
import { PAYMENT_STATUS_LABELS } from "@/lib/types";

export const metadata: Metadata = { title: "Facturatie" };

export default async function InvoicesPage({ searchParams }: PageProps<"/facturatie">) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const ps = typeof sp.betaalstatus === "string" && sp.betaalstatus in PAYMENT_STATUS_LABELS ? sp.betaalstatus : "";
  const all = await listInvoices(ctx);
  const invoices = ps ? all.filter((i) => i.payment_status === ps) : all;
  const open = all.filter((i) => i.status === "final" && i.invoice_type !== "credit");
  const { currency_code: cur, locale } = ctx.settings;
  return (
    <ModuleGate ctx={ctx} module="facturatie">
      <PageHeader
        title="Facturatie"
        description="Facturen, termijnfacturen en creditnota's. Factuurnummers worden doorlopend toegekend bij definitief maken."
        actions={can(ctx.membership.role, "invoices.write") && <LinkButton href="/facturatie/nieuw"><Plus className="size-4" aria-hidden /> Nieuwe factuur</LinkButton>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Gefactureerd (incl.)" value={formatMoney(sum(all.filter((i) => i.status === "final").map((i) => i.total)), cur, locale)} icon={Receipt} />
        <KpiCard label="Openstaand" value={formatMoney(sum(open.map((i) => i.outstanding ?? 0)), cur, locale)} icon={Wallet} tone="orange" />
        <KpiCard label="Vervallen" value={formatMoney(sum(open.filter((i) => i.payment_status === "overdue").map((i) => i.outstanding ?? 0)), cur, locale)} icon={AlertTriangle} tone="red" />
      </div>
      <Card>
        <FilterBar placeholder="Filter op betaalstatus">
          <FilterSelect name="betaalstatus" label="Betaalstatus" value={ps} options={[{ value: "", label: "Alle facturen" }, ...Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))]} />
        </FilterBar>
        <InvoiceTable invoices={invoices} locale={locale} />
      </Card>
    </ModuleGate>
  );
}
