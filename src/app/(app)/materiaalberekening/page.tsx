import type { Metadata } from "next";
import Link from "next/link";
import { Calculator } from "lucide-react";
import { ProjectStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { getAppContext } from "@/lib/auth/context";
import { listEstimateTotals } from "@/lib/data/execution";
import { listProjects, parseProjectFilters } from "@/lib/data/projects";
import { formatMoney, formatPercent, toDecimal } from "@/lib/finance/money";
import { marginPercent } from "@/lib/finance/postcalc";

export const metadata: Metadata = { title: "Voorcalculatie" };

export default async function EstimatesPage() {
  const ctx = await getAppContext();
  const [projects, totals] = await Promise.all([listProjects(ctx, { ...parseProjectFilters({}), status: "all" }), listEstimateTotals(ctx)]);
  const { locale } = ctx.settings;
  return (
    <ModuleGate ctx={ctx} module="calculatie">
      <PageHeader title="Voorcalculatie" description="Materiaalberekening en begroting per project. Open een project om regels toe te voegen en er een offerte van te maken." />
      <Card>
        {projects.length === 0 ? (
          <EmptyState icon={Calculator} title="Nog geen projecten" description="Maak eerst een project aan." />
        ) : (
          <Table>
            <thead>
              <tr><Th>Project</Th><Th className="hidden sm:table-cell">Status</Th><Th className="hidden md:table-cell text-right">Regels</Th><Th className="text-right">Kosten</Th><Th className="text-right">Verkoop</Th><Th className="hidden lg:table-cell text-right">Marge</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {projects.map((p) => {
                const t = totals.find((x) => x.project_id === p.id);
                const margin = t ? marginPercent(toDecimal(t.sale_total).minus(t.cost_total), toDecimal(t.sale_total)) : null;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <Td>
                      <Link href={`/projecten/${p.id}?tab=calculatie`} className="font-medium text-slate-900 hover:text-brand-700">{p.name}</Link>
                      <p className="font-mono text-xs text-slate-600">{p.project_number}</p>
                    </Td>
                    <Td className="hidden sm:table-cell"><ProjectStatusBadge status={p.status} /></Td>
                    <Td className="hidden md:table-cell text-right tabular-nums">{t?.lines ?? 0}</Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">{t ? formatMoney(t.cost_total, p.currency_code, locale) : <span className="text-slate-500">—</span>}</Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">{t ? formatMoney(t.sale_total, p.currency_code, locale) : <span className="text-slate-500">—</span>}</Td>
                    <Td className="hidden lg:table-cell text-right tabular-nums">{margin ? formatPercent(margin, locale) : "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </ModuleGate>
  );
}
