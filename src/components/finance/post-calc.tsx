import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { COST_TYPES, COST_TYPE_LABELS } from "@/lib/finance/estimate";
import { formatMoney, formatPercent, toDecimal } from "@/lib/finance/money";
import { calculatePostCalculation, REVENUE_BASIS_LABELS, type RevenueBasis } from "@/lib/finance/postcalc";
import type { ProjectFinancials } from "@/lib/types";

/** Bouwt de invoer voor de na-calculatie uit de projectfinanciën (database-view). */
export function postCalcFromFinancials(f: ProjectFinancials, basis: RevenueBasis, warningPercent: string | number) {
  const hasEstimate = f.estimate_line_count > 0;
  const budgetCost = hasEstimate
    ? { material: f.budget_material, labor: f.budget_labor, equipment: f.budget_equipment, transport: f.budget_transport, subcontractor: f.budget_subcontractor, other: f.budget_other }
    : { other: f.budget_amount }; // geen calculatie: totaalbudget als 'overig'
  const budgetRevenue = toDecimal(f.contract_value).greaterThan(0) ? f.contract_value : f.budget_sale_total;
  const result = calculatePostCalculation({
    budgetCost,
    actualCost: { material: f.actual_material, labor: f.actual_labor, equipment: f.actual_equipment, transport: f.actual_transport, subcontractor: f.actual_subcontractor, other: f.actual_other },
    budgetLaborHours: f.budget_labor_hours,
    actualLaborHours: f.actual_labor_hours,
    budgetRevenue,
    revenue: { contractValue: f.contract_value, invoiced: f.invoiced_excl_tax, received: f.received_excl_tax },
    revenueBasis: basis,
    warningPercent,
  });
  return { result, hasEstimate };
}

function Variance({ value, currency, locale, invert = false, unit }: { value: ReturnType<typeof toDecimal>; currency: string; locale: string; invert?: boolean; unit?: string }) {
  if (value.isZero()) return <span className="text-slate-500">0</span>;
  // Voor kosten: positief verschil = duurder dan begroot (ongunstig)
  const unfavourable = invert ? value.isNegative() : value.isPositive();
  return (
    <span className={cn("font-medium", unfavourable ? "text-red-700" : "text-emerald-700")}>
      {value.isPositive() ? "+" : "−"}
      {unit ? `${value.abs().toNumber().toLocaleString("nl-NL")} ${unit}` : formatMoney(value.abs(), currency, locale)}
    </span>
  );
}

export function PostCalcTable({ financials: f, basis, warningPercent, locale }: { financials: ProjectFinancials; basis: RevenueBasis; warningPercent: string | number; locale: string }) {
  const { result: r, hasEstimate } = postCalcFromFinancials(f, basis, warningPercent);
  const cur = f.currency_code;
  const m = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, cur, locale);
  const status = r.budgetStatus;

  return (
    <div className="space-y-4">
      <div
        role={status === "ok" ? "status" : "alert"}
        className={cn(
          "flex items-start gap-3 rounded-xl p-4 text-sm ring-1",
          status === "exceeded" ? "bg-red-50 text-red-900 ring-red-200" : status === "warning" ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-emerald-50 text-emerald-900 ring-emerald-200",
        )}
      >
        {status === "ok" ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden /> : <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />}
        <p>
          {status === "exceeded" ? "Budget overschreden" : status === "warning" ? `Budget bijna bereikt (waarschuwing vanaf ${warningPercent}%)` : "Binnen budget"}
          {r.budgetUsedPercent && ` — ${formatPercent(r.budgetUsedPercent, locale)} van het kostenbudget gebruikt.`}
        </p>
      </div>
      {!hasEstimate && (
        <p className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Dit project heeft nog geen voorcalculatie; het totale begrote budget wordt als één post vergeleken.
        </p>
      )}
      <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
        <table className="min-w-full bg-white text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Onderdeel</th>
              <th className="px-4 py-3 text-right font-semibold">Begroot</th>
              <th className="px-4 py-3 text-right font-semibold">Werkelijk</th>
              <th className="px-4 py-3 text-right font-semibold">Verschil</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {COST_TYPES.map((t) => {
              const c = r.byType[t];
              if (c.budget.isZero() && c.actual.isZero()) return null;
              return (
                <tr key={t}>
                  <td className="px-4 py-2.5">{COST_TYPE_LABELS[t]}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{m(c.budget)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{m(c.actual)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums"><Variance value={c.variance} currency={cur} locale={locale} /></td>
                </tr>
              );
            })}
            <tr className="bg-slate-50/60">
              <td className="px-4 py-2.5 text-slate-600">Arbeidsuren</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{r.laborHours.budget.toNumber().toLocaleString("nl-NL")} uur</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{r.laborHours.actual.toNumber().toLocaleString("nl-NL")} uur</td>
              <td className="px-4 py-2.5 text-right tabular-nums"><Variance value={r.laborHours.variance} currency={cur} locale={locale} unit="uur" /></td>
            </tr>
            <tr className="font-semibold">
              <td className="px-4 py-3">Totale kosten</td>
              <td className="px-4 py-3 text-right tabular-nums">{m(r.totalCost.budget)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{m(r.totalCost.actual)}</td>
              <td className="px-4 py-3 text-right tabular-nums"><Variance value={r.totalCost.variance} currency={cur} locale={locale} /></td>
            </tr>
            <tr>
              <td className="px-4 py-2.5">Omzet <span className="text-xs text-slate-500">({REVENUE_BASIS_LABELS[basis]})</span></td>
              <td className="px-4 py-2.5 text-right tabular-nums">{m(r.revenue.budget)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{m(r.revenue.realized)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums"><Variance value={r.revenue.realized.minus(r.revenue.budget)} currency={cur} locale={locale} invert /></td>
            </tr>
            <tr className="font-semibold">
              <td className="px-4 py-3">Winst</td>
              <td className="px-4 py-3 text-right tabular-nums">{m(r.budgetProfit)}</td>
              <td className={cn("px-4 py-3 text-right tabular-nums", r.realizedProfit.isNegative() && "text-red-700")}>{m(r.realizedProfit)}</td>
              <td className="px-4 py-3 text-right tabular-nums"><Variance value={r.realizedProfit.minus(r.budgetProfit)} currency={cur} locale={locale} invert /></td>
            </tr>
            <tr>
              <td className="px-4 py-2.5">Winstmarge</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{r.budgetMarginPercent ? formatPercent(r.budgetMarginPercent, locale) : "n.v.t."}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{r.realizedMarginPercent ? formatPercent(r.realizedMarginPercent, locale) : "n.v.t."}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Verkoopwaarde (opdracht)</dt>
          <dd className="mt-1 font-semibold tabular-nums">{m(f.contract_value)}</dd>
        </div>
        <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Gefactureerd (excl. belasting)</dt>
          <dd className="mt-1 font-semibold tabular-nums">{m(f.invoiced_excl_tax)}</dd>
          <dd className="text-xs text-slate-500">incl. belasting {m(f.invoiced_incl_tax)}</dd>
        </div>
        <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Ontvangen betalingen</dt>
          <dd className="mt-1 font-semibold tabular-nums">{m(f.received_incl_tax)}</dd>
          <dd className="text-xs text-slate-500">≈ {m(f.received_excl_tax)} excl. belasting</dd>
        </div>
      </dl>
      <p className="text-xs text-slate-500">
        Kostenverschil = werkelijk − begroot. Winst = omzet − kosten. Marge = winst / omzet × 100% (alleen bij omzet &gt; 0). De omzetbasis stelt u in bij Instellingen; gefactureerde
        bedragen, ontvangen betalingen en verkoopwaarde blijven altijd apart zichtbaar.
      </p>
    </div>
  );
}
