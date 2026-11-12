import { NextResponse, type NextRequest } from "next/server";
import { postCalcFromFinancials } from "@/components/finance/post-calc";
import { getAppContext, hasModule } from "@/lib/auth/context";
import { listInvoices, listPayments, listProjectFinancials } from "@/lib/data/finance";
import { listProjects, parseProjectFilters } from "@/lib/data/projects";
import { todayISO } from "@/lib/format";
import { revenueByMonth, toCsv } from "@/lib/reports";

/** CSV-export (puntkomma, UTF-8 met BOM voor Excel). Alleen voor organisaties met de module Rapportages. */
export async function GET(req: NextRequest) {
  const ctx = await getAppContext();
  if (!hasModule(ctx, "rapportages")) return new NextResponse("Niet beschikbaar in uw abonnement", { status: 403 });
  const kind = req.nextUrl.searchParams.get("soort");
  const { revenue_basis: basis, budget_warning_percent: warn } = ctx.settings;
  let csv: string;
  let name: string;
  if (kind === "projecten") {
    const [projects, fins] = await Promise.all([listProjects(ctx, { ...parseProjectFilters({}), status: "all" }), listProjectFinancials(ctx)]);
    const rows: (string | number)[][] = [["Projectnummer", "Project", "Status", "Begrote kosten", "Werkelijke kosten", "Kostenverschil", "Verkoopwaarde", "Gefactureerd excl.", "Ontvangen incl.", "Gerealiseerde winst", "Marge %"]];
    for (const p of projects) {
      const f = fins.find((x) => x.project_id === p.id);
      if (!f) continue;
      const r = postCalcFromFinancials(f, basis, warn).result;
      rows.push([p.project_number, p.name, p.status, r.totalCost.budget.toFixed(2), r.totalCost.actual.toFixed(2), r.totalCost.variance.toFixed(2), f.contract_value, f.invoiced_excl_tax, f.received_incl_tax, r.realizedProfit.toFixed(2), r.realizedMarginPercent?.toFixed(2) ?? ""]);
    }
    csv = toCsv(rows);
    name = "bouwflow-projectresultaten.csv";
  } else {
    const yr = Number(req.nextUrl.searchParams.get("jaar")) || Number(todayISO(ctx.settings.timezone).slice(0, 4));
    const [invoices, payments] = await Promise.all([listInvoices(ctx, { status: "final" }), listPayments(ctx, { limit: 5000 })]);
    csv = toCsv([["Maand", "Gefactureerd excl.", "Gefactureerd incl.", "Ontvangen"], ...revenueByMonth(invoices, payments, yr).map((r) => [r.month, r.invoicedExcl.toFixed(2), r.invoicedIncl.toFixed(2), r.received.toFixed(2)])]);
    name = `bouwflow-omzet-${yr}.csv`;
  }
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
}
