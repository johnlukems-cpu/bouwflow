import { postCalcFromFinancials } from "@/components/finance/post-calc";
import { getAppContext, hasModule } from "@/lib/auth/context";
import { getProjectFinancials } from "@/lib/data/finance";
import { getProject } from "@/lib/data/projects";
import { COST_TYPES, COST_TYPE_LABELS } from "@/lib/finance/estimate";
import { formatMoney, formatPercent } from "@/lib/finance/money";
import { REVENUE_BASIS_LABELS } from "@/lib/finance/postcalc";
import { formatDateTime } from "@/lib/format";
import { issuerFromSettings, loadLogo, pdfResponse } from "@/lib/pdf/render";
import { PostCalcPdf } from "@/lib/pdf/templates";

export async function GET(_req: Request, { params }: RouteContext<"/pdf/nacalculatie/[id]">) {
  const { id } = await params;
  const ctx = await getAppContext();
  if (!hasModule(ctx, "nacalculatie")) return new Response("Niet in abonnement", { status: 403 });
  const [project, f] = await Promise.all([getProject(ctx, id), getProjectFinancials(ctx, id)]);
  if (!project || !f) return new Response("Niet gevonden", { status: 404 });
  const { revenue_basis: basis, budget_warning_percent: warn, locale, timezone } = ctx.settings;
  const r = postCalcFromFinancials(f, basis, warn).result;
  const m = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, f.currency_code, "nl-NL");
  const rows = [
    ...COST_TYPES.filter((t) => !r.byType[t].budget.isZero() || !r.byType[t].actual.isZero()).map((t) => ({ label: COST_TYPE_LABELS[t], budget: m(r.byType[t].budget), actual: m(r.byType[t].actual), variance: m(r.byType[t].variance) })),
    { label: "Arbeidsuren", budget: `${r.laborHours.budget.toNumber().toLocaleString("nl-NL")} uur`, actual: `${r.laborHours.actual.toNumber().toLocaleString("nl-NL")} uur`, variance: `${r.laborHours.variance.toNumber().toLocaleString("nl-NL")} uur` },
    { label: "Totale kosten", budget: m(r.totalCost.budget), actual: m(r.totalCost.actual), variance: m(r.totalCost.variance), bold: true },
    { label: `Omzet (${REVENUE_BASIS_LABELS[basis]})`, budget: m(r.revenue.budget), actual: m(r.revenue.realized), variance: m(r.revenue.realized.minus(r.revenue.budget)) },
    { label: "Winst", budget: m(r.budgetProfit), actual: m(r.realizedProfit), variance: m(r.realizedProfit.minus(r.budgetProfit)), bold: true },
    { label: "Winstmarge", budget: r.budgetMarginPercent ? formatPercent(r.budgetMarginPercent, locale) : "n.v.t.", actual: r.realizedMarginPercent ? formatPercent(r.realizedMarginPercent, locale) : "n.v.t.", variance: "" },
  ];
  const status = r.budgetStatus === "exceeded" ? "Status: budget overschreden" : r.budgetStatus === "warning" ? "Status: budget bijna bereikt" : "Status: binnen budget";
  return pdfResponse(
    <PostCalcPdf
      logo={await loadLogo()}
      issuer={issuerFromSettings(ctx.membership.organization.name, ctx.settings)}
      project={`${project.project_number} ${project.name}`}
      customer={project.customer?.name ?? "-"}
      currency={f.currency_code}
      rows={rows}
      revenueLines={[["Verkoopwaarde (opdracht)", m(f.contract_value)], ["Gefactureerd excl. belasting", m(f.invoiced_excl_tax)], ["Gefactureerd incl. belasting", m(f.invoiced_incl_tax)], ["Ontvangen betalingen", m(f.received_incl_tax)]]}
      status={status}
      generatedAt={formatDateTime(new Date().toISOString(), locale, timezone)}
    />,
    `Nacalculatie-${project.project_number}.pdf`,
  );
}
