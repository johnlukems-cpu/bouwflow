import Decimal from "decimal.js";
import { Money, roundMoney, toDecimal, type NumericInput } from "./money";

/** Soorten kostenregels in een voorcalculatie. */
export const COST_TYPES = ["material", "labor", "equipment", "transport", "subcontractor", "other"] as const;
export type CostType = (typeof COST_TYPES)[number];

export const COST_TYPE_LABELS: Record<CostType, string> = {
  material: "Materialen",
  labor: "Arbeid",
  equipment: "Machines",
  transport: "Transport",
  subcontractor: "Onderaannemers",
  other: "Overige kosten",
};

export const MATERIAL_CATEGORIES = [
  "Kabels",
  "Leidingen",
  "Elektrische componenten",
  "Sanitair",
  "Bouwmaterialen",
  "Beton",
  "Hout",
  "Verf",
  "Tegels",
  "Machines",
  "Overig",
] as const;

export interface EstimateLineInput {
  costType: CostType;
  quantity: NumericInput;
  unitCost: NumericInput;
  unitPrice: NumericInput;
  /** Snij-/materiaalverlies in procenten (bijv. 10 = 10%). */
  wastePercent?: NumericInput;
}

export interface EstimateLineResult {
  /** Hoeveelheid inclusief verlies (niet afgerond, voor controle). */
  effectiveQuantity: Decimal;
  costTotal: Decimal;
  saleTotal: Decimal;
  margin: Decimal;
}

function assertNonNegative(value: Decimal, field: string) {
  if (value.isNegative()) throw new Error(`${field} mag niet negatief zijn`);
}

/**
 * Berekent één calculatieregel.
 *   effectieve hoeveelheid = hoeveelheid × (1 + verlies% / 100)
 *   kosten  = effectieve hoeveelheid × kostprijs   (afgerond op centen)
 *   verkoop = effectieve hoeveelheid × verkoopprijs (afgerond op centen)
 */
export function calculateEstimateLine(line: EstimateLineInput): EstimateLineResult {
  const quantity = toDecimal(line.quantity);
  const unitCost = toDecimal(line.unitCost);
  const unitPrice = toDecimal(line.unitPrice);
  const waste = toDecimal(line.wastePercent ?? 0);
  assertNonNegative(quantity, "Hoeveelheid");
  assertNonNegative(unitCost, "Kostprijs");
  assertNonNegative(unitPrice, "Verkoopprijs");
  if (waste.isNegative() || waste.greaterThan(100)) throw new Error("Verliespercentage moet tussen 0 en 100 liggen");

  const effectiveQuantity = quantity.times(new Money(1).plus(waste.dividedBy(100)));
  const costTotal = roundMoney(effectiveQuantity.times(unitCost));
  const saleTotal = roundMoney(effectiveQuantity.times(unitPrice));
  return { effectiveQuantity, costTotal, saleTotal, margin: saleTotal.minus(costTotal) };
}

export type CostBreakdown = Record<CostType, Decimal>;

export function emptyBreakdown(): CostBreakdown {
  return Object.fromEntries(COST_TYPES.map((t) => [t, new Money(0)])) as CostBreakdown;
}

export interface EstimateSummary {
  costByType: CostBreakdown;
  saleByType: CostBreakdown;
  totalCost: Decimal;
  totalSale: Decimal;
  margin: Decimal;
  /** Marge als % van de verkoopwaarde; null als verkoopwaarde 0 is. */
  marginPercent: Decimal | null;
}

/** Telt regels op. Totalen zijn de som van afgeronde regelbedragen (controleerbaar). */
export function summarizeEstimate(lines: EstimateLineInput[]): EstimateSummary {
  const costByType = emptyBreakdown();
  const saleByType = emptyBreakdown();
  for (const line of lines) {
    const r = calculateEstimateLine(line);
    costByType[line.costType] = costByType[line.costType].plus(r.costTotal);
    saleByType[line.costType] = saleByType[line.costType].plus(r.saleTotal);
  }
  const totalCost = COST_TYPES.reduce((a, t) => a.plus(costByType[t]), new Money(0));
  const totalSale = COST_TYPES.reduce((a, t) => a.plus(saleByType[t]), new Money(0));
  const margin = totalSale.minus(totalCost);
  return {
    costByType,
    saleByType,
    totalCost,
    totalSale,
    margin,
    marginPercent: totalSale.greaterThan(0) ? margin.dividedBy(totalSale).times(100).toDecimalPlaces(2) : null,
  };
}
