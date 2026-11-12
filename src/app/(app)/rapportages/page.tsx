import type { Metadata } from "next";
import { Download } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { postCalcFromFinancials } from "@/components/finance/post-calc";
import { getAppContext } from "@/lib/auth/context";
import { listInvoices, listPayments, listProjectFinancials } from "@/lib/data/finance";
import { listProjects, parseProjectFilters } from "@/lib/data/projects";
import { formatMoney, formatPercent, Money, sum } from "@/lib/finance/money";
import { todayISO } from "@/lib/format";
import { revenueByMonth } from "@/lib/reports";

export const metadata: Metadata = { title: "Rapportages" };

const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export default async function ReportsPage({ searchParams }: PageProps<"/rapportages">) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const thisYear = Number(todayISO(ctx.settings.timezone).slice(0, 4));
  const year = typeof sp.jaar === "string" && /^\d{4}$/.test(sp.jaar) ? Number(sp.jaar) : thisYear;
  const [invoices, payments, projects, fins] = await Promise.all([listInvoices(ctx, { status: "final" }), listPayments(ctx, { limit: 5000 }), listProjects(ctx, { ...parseProjectFilters({}), status: "all" }), listProjectFinancials(ctx)]);
  const months = revenueByMonth(invoices, payments, year);
  const { currency_code: cur, locale, revenue_basis: basis, budget_warning_percent: warn } = ctx.settings;
  const m = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, cur, locale);
  const totals = months.reduce((a, r) => ({ ex: a.ex.plus(r.invoicedExcl), inc: a.inc.plus(r.invoicedIncl), rec: a.rec.plus(r.received) }), { ex: new Money(0), inc: new Money(0), rec: new Money(0) });
  const max = Math.max(1, ...months.map((r) => Math.max(r.invoicedIncl.toNumber(), r.received.toNumber())));
  const results = projects
    .filter((p) => p.status === "completed" || p.status === "in_progress")
    .map((p) => {
      const f = fins.find((x) => x.project_id === p.id);
      return f ? { p, r: postCalcFromFinancials(f, basis, warn).result } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <ModuleGate ctx={ctx} module="rapportages">
      <PageHeader
        title="Rapportages"
        description="Omzet per maand (gefactureerd en ontvangen apart) en projectresultaten."
        actions={
          <>
            <LinkButton href={`/rapportages?jaar=${year - 1}`} variant="secondary">{year - 1}</LinkButton>
            {year < thisYear && <LinkButton href={`/rapportages?jaar=${year + 1}`} variant="secondary">{year + 1}</LinkButton>}
            <LinkButton href={`/rapportages/export?soort=omzet&jaar=${year}`} variant="secondary" prefetch={false}><Download className="size-4" aria-hidden /> CSV omzet</LinkButton>
            <LinkButton href="/rapportages/export?soort=projecten" variant="secondary" prefetch={false}><Download className="size-4" aria-hidden /> CSV projecten</LinkButton>
          </>
        }
      />
      <div className="space-y-6">
        <Card>
          <CardHeader title={`Omzet ${year}`} description={`Gefactureerd excl. ${m(totals.ex)} · incl. ${m(totals.inc)} · ontvangen ${m(totals.rec)}`} />
          <div className="px-5 pt-4" aria-hidden>
            <div className="flex h-40 items-end gap-2">
              {months.map((r, i) => (
                <div key={r.month} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-32 w-full items-end justify-center gap-0.5">
                    <div className="w-1/2 rounded-t bg-navy-800" style={{ height: `${(r.invoicedIncl.toNumber() / max) * 100}%` }} />
                    <div className="w-1/2 rounded-t bg-accent-500" style={{ height: `${(r.received.toNumber() / max) * 100}%` }} />
                  </div>
                  <span className="text-[11px] text-slate-500">{MONTHS[i]}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 flex gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-navy-800" /> Gefactureerd (incl.)</span>
              <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-accent-500" /> Ontvangen</span>
            </p>
          </div>
          <Table>
            <thead><tr><Th>Maand</Th><Th className="text-right">Gefactureerd excl.</Th><Th className="hidden sm:table-cell text-right">Gefactureerd incl.</Th><Th className="text-right">Ontvangen</Th></tr></thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {months.map((r, i) => (
                <tr key={r.month}>
                  <Td>{MONTHS[i]} {year}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{m(r.invoicedExcl)}</Td>
                  <Td className="hidden sm:table-cell whitespace-nowrap text-right tabular-nums">{m(r.invoicedIncl)}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{m(r.received)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader title="Projectresultaten (lopend en afgerond)" />
          <Table>
            <thead><tr><Th>Project</Th><Th className="text-right">Omzet</Th><Th className="text-right">Kosten</Th><Th className="text-right">Winst</Th><Th className="hidden sm:table-cell text-right">Marge</Th></tr></thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {results.map(({ p, r }) => (
                <tr key={p.id}>
                  <Td>{p.project_number} {p.name}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{m(r.revenue.realized)}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{m(r.totalCost.actual)}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{m(r.realizedProfit)}</Td>
                  <Td className="hidden sm:table-cell text-right tabular-nums">{r.realizedMarginPercent ? formatPercent(r.realizedMarginPercent, locale) : "n.v.t."}</Td>
                </tr>
              ))}
              <tr className="font-semibold">
                <Td>Totaal</Td>
                <Td className="text-right tabular-nums">{m(sum(results.map((x) => x.r.revenue.realized)))}</Td>
                <Td className="text-right tabular-nums">{m(sum(results.map((x) => x.r.totalCost.actual)))}</Td>
                <Td className="text-right tabular-nums">{m(sum(results.map((x) => x.r.realizedProfit)))}</Td>
                <Td className="hidden sm:table-cell" />
              </tr>
            </tbody>
          </Table>
        </Card>
      </div>
    </ModuleGate>
  );
}
