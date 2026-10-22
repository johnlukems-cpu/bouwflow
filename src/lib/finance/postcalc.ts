import Decimal from "decimal.js";
import { COST_TYPES, emptyBreakdown, type CostBreakdown, type CostType } from "./estimate";
import { Money, toDecimal, type NumericInput } from "./money";

/**
 * Na-calculatie: vergelijkt begroting met werkelijkheid.
 *   Kostenverschil             = werkelijke kosten − begrote kosten
 *   Begrote projectwinst       = begrote omzet − begrote kosten
 *   Gerealiseerde projectwinst = gerealiseerde omzet − werkelijke kosten
 *   Winstmarge                 = winst / omzet × 100%   (alleen als omzet > 0)
 */
export type RevenueBasis = "contract_value" | "invoiced" | "received";

export const REVENUE_BASIS_LABELS: Record<RevenueBasis, string> = {
  contract_value: "Verkoopwaarde (opdrachtsom)",
  invoiced: "Gefactureerde omzet",
  received: "Ontvangen betalingen",
};

export interface RevenueFigures {
  contractValue: NumericInput;
  invoiced: NumericInput;
  received: NumericInput;
}

export interface PostCalcInput {
  budgetCost: Partial<Record<CostType, NumericInput>>;
  actualCost: Partial<Record<CostType, NumericInput>>;
  budgetLaborHours?: NumericInput;
  actualLaborHours?: NumericInput;
  budgetRevenue: NumericInput;
  revenue: RevenueFigures;
  revenueBasis: RevenueBasis;
  /** Waarschuwingsdrempel in % van het budget (bijv. 90). */
  warningPercent?: NumericInput;
}

export interface Comparison {
  budget: Decimal;
  actual: Decimal;
  /** werkelijk − begroot; positief = duurder dan begroot */
  variance: Decimal;
  /** variance / budget × 100; null als budget 0 is */
  variancePercent: Decimal | null;
}

export type BudgetStatus = "ok" | "warning" | "exceeded";

export interface PostCalcResult {
  byType: Record<CostType, Comparison>;
  laborHours: Comparison;
  totalCost: Comparison;
  revenue: { budget: Decimal; realized: Decimal; basis: RevenueBasis; invoiced: Decimal; received: Decimal; contractValue: Decimal };
  budgetProfit: Decimal;
  realizedProfit: Decimal;
  budgetMarginPercent: Decimal | null;
  realizedMarginPercent: Decimal | null;
  /** Gebruik van het kostenbudget in %; null bij budget 0 */
  budgetUsedPercent: Decimal | null;
  budgetStatus: BudgetStatus;
}

export function compare(budget: NumericInput, actual: NumericInput): Comparison {
  const b = toDecimal(budget);
  const a = toDecimal(actual);
  const variance = a.minus(b);
  return {
    budget: b,
    actual: a,
    variance,
    variancePercent: b.isZero() ? null : variance.dividedBy(b).times(100).toDecimalPlaces(2),
  };
}

export function marginPercent(profit: Decimal, revenue: Decimal): Decimal | null {
  return revenue.greaterThan(0) ? profit.dividedBy(revenue).times(100).toDecimalPlaces(2) : null;
}

export function selectRealizedRevenue(revenue: RevenueFigures, basis: RevenueBasis): Decimal {
  switch (basis) {
    case "contract_value":
      return toDecimal(revenue.contractValue);
    case "invoiced":
      return toDecimal(revenue.invoiced);
    case "received":
      return toDecimal(revenue.received);
  }
}

export function budgetStatus(budget: Decimal, actual: Decimal, warningPercent: NumericInput = 90): BudgetStatus {
  if (budget.isZero()) return actual.greaterThan(0) ? "exceeded" : "ok";
  if (actual.greaterThan(budget)) return "exceeded";
  if (actual.dividedBy(budget).times(100).greaterThanOrEqualTo(toDecimal(warningPercent))) return "warning";
  return "ok";
}

export function calculatePostCalculation(input: PostCalcInput): PostCalcResult {
  const budget: CostBreakdown = emptyBreakdown();
  const actual: CostBreakdown = emptyBreakdown();
  for (const t of COST_TYPES) {
    budget[t] = toDecimal(input.budgetCost[t]);
    actual[t] = toDecimal(input.actualCost[t]);
  }
  const byType = Object.fromEntries(COST_TYPES.map((t) => [t, compare(budget[t], actual[t])])) as Record<CostType, Comparison>;
  const totalBudget = COST_TYPES.reduce((a, t) => a.plus(budget[t]), new Money(0));
  const totalActual = COST_TYPES.reduce((a, t) => a.plus(actual[t]), new Money(0));
  const totalCost = compare(totalBudget, totalActual);

  const budgetRevenue = toDecimal(input.budgetRevenue);
  const realized = selectRealizedRevenue(input.revenue, input.revenueBasis);
  const budgetProfit = budgetRevenue.minus(totalBudget);
  const realizedProfit = realized.minus(totalActual);

  return {
    byType,
    laborHours: compare(input.budgetLaborHours, input.actualLaborHours),
    totalCost,
    revenue: {
      budget: budgetRevenue,
      realized,
      basis: input.revenueBasis,
      contractValue: toDecimal(input.revenue.contractValue),
      invoiced: toDecimal(input.revenue.invoiced),
      received: toDecimal(input.revenue.received),
    },
    budgetProfit,
    realizedProfit,
    budgetMarginPercent: marginPercent(budgetProfit, budgetRevenue),
    realizedMarginPercent: marginPercent(realizedProfit, realized),
    budgetUsedPercent: totalBudget.isZero() ? null : totalActual.dividedBy(totalBudget).times(100).toDecimalPlaces(2),
    budgetStatus: budgetStatus(totalBudget, totalActual, input.warningPercent),
  };
}
