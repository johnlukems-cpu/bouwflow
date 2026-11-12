import type { Metadata } from "next";
import Link from "next/link";
import { Scale } from "lucide-react";
import { postCalcFromFinancials } from "@/components/finance/post-calc";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { cn } from "@/components/ui/cn";
import { getAppContext } from "@/lib/auth/context";
import { listProjectFinancials } from "@/lib/data/finance";
import { listProjects, parseProjectFilters } from "@/lib/data/projects";
import { formatMoney, formatPercent } from "@/lib/finance/money";
import { REVENUE_BASIS_LABELS } from "@/lib/finance/postcalc";

export const metadata: Metadata = { title: "Na-calculatie" };

export default async function PostCalcOverviewPage() {
  const ctx = await getAppContext();
  const [projects, fins] = await Promise.all([listProjects(ctx, { ...parseProjectFilters({}), status: "all" }), listProjectFinancials(ctx)]);
  const { locale, revenue_basis: basis, budget_warning_percent: warn } = ctx.settings;
  const rows = projects
    .filter((p) => p.status !== "cancelled")
    .map((p) => {
      const f = fins.find((x) => x.project_id === p.id);
      return f ? { p, f, ...postCalcFromFinancials(f, basis, warn) } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  const order = { exceeded: 0, warning: 1, ok: 2 } as const;
  rows.sort((a, b) => order[a.result.budgetStatus] - order[b.result.budgetStatus]);

  return (
    <ModuleGate ctx={ctx} module="nacalculatie">
      <PageHeader title="Na-calculatie" description={`Begroot versus werkelijk per project. Omzetbasis: ${REVENUE_BASIS_LABELS[basis]} (instelbaar). Waarschuwing vanaf ${warn}% van het budget.`} />
      <Card>
        {rows.length === 0 ? <EmptyState icon={Scale} title="Geen projecten" /> : (
          <Table>
            <thead>
              <tr>
                <Th>Project</Th>
                <Th className="text-right">Begrote kosten</Th>
                <Th className="text-right">Werkelijke kosten</Th>
                <Th className="hidden md:table-cell text-right">Verschil</Th>
                <Th className="hidden lg:table-cell text-right">Gerealiseerde winst</Th>
                <Th className="hidden lg:table-cell text-right">Marge</Th>
                <Th>Budget</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map(({ p, f, result: r }) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/projecten/${p.id}?tab=na-calculatie`} className="font-medium text-slate-900 hover:text-brand-700">{p.name}</Link>
                    <p className="font-mono text-xs text-slate-600">{p.project_number}</p>
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{formatMoney(r.totalCost.budget, f.currency_code, locale)}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{formatMoney(r.totalCost.actual, f.currency_code, locale)}</Td>
                  <Td className={cn("hidden md:table-cell whitespace-nowrap text-right tabular-nums", r.totalCost.variance.isPositive() ? "text-red-700" : "text-emerald-700")}>{formatMoney(r.totalCost.variance, f.currency_code, locale)}</Td>
                  <Td className={cn("hidden lg:table-cell whitespace-nowrap text-right tabular-nums", r.realizedProfit.isNegative() && "text-red-700")}>{formatMoney(r.realizedProfit, f.currency_code, locale)}</Td>
                  <Td className="hidden lg:table-cell text-right tabular-nums">{r.realizedMarginPercent ? formatPercent(r.realizedMarginPercent, locale) : "n.v.t."}</Td>
                  <Td>
                    <Badge tone={r.budgetStatus === "exceeded" ? "red" : r.budgetStatus === "warning" ? "amber" : "green"}>
                      {r.budgetStatus === "exceeded" ? "Overschreden" : r.budgetStatus === "warning" ? "Let op" : "Binnen budget"}
                      {r.budgetUsedPercent && ` · ${formatPercent(r.budgetUsedPercent, locale, 0)}`}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </ModuleGate>
  );
}
