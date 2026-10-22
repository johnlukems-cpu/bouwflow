import Decimal from "decimal.js";
import { Money, roundMoney, toDecimal, type NumericInput } from "./money";

/**
 * Documenttotalen (offertes/facturen) met configureerbare belastingtarieven.
 * BouwFlow neemt GEEN tarief aan: elk tarief komt uit de instellingen van de
 * organisatie en wordt als momentopname op het document opgeslagen.
 */
export interface TaxedLineInput {
  quantity: NumericInput;
  unitPrice: NumericInput;
  /** Korting in procenten op de regel (0–100). */
  discountPercent?: NumericInput;
  /** Tarief in procenten, bijv. 10 voor 10%. null = geen belasting van toepassing. */
  taxRatePercent: NumericInput | null;
}

export interface TaxGroup {
  ratePercent: Decimal;
  taxableAmount: Decimal;
  taxAmount: Decimal;
}

export interface DocumentTotals {
  lineAmounts: Decimal[];
  subtotal: Decimal;
  taxGroups: TaxGroup[];
  taxTotal: Decimal;
  total: Decimal;
}

export function calculateLineAmount(line: Pick<TaxedLineInput, "quantity" | "unitPrice" | "discountPercent">): Decimal {
  const qty = toDecimal(line.quantity);
  const price = toDecimal(line.unitPrice);
  const discount = toDecimal(line.discountPercent ?? 0);
  if (discount.isNegative() || discount.greaterThan(100)) throw new Error("Korting moet tussen 0 en 100% liggen");
  return roundMoney(qty.times(price).times(new Money(100).minus(discount)).dividedBy(100));
}

/**
 * Bedragen zijn exclusief belasting (pricesIncludeTax = false) of inclusief
 * (true). Belasting wordt per tarief berekend over het groepstotaal en daarna
 * afgerond — zo blijft de som controleerbaar per tarief.
 */
export function calculateDocumentTotals(lines: TaxedLineInput[], pricesIncludeTax = false): DocumentTotals {
  const lineAmounts = lines.map(calculateLineAmount);
  const groups = new Map<string, { rate: Decimal; amount: Decimal }>();
  lines.forEach((line, i) => {
    if (line.taxRatePercent === null || line.taxRatePercent === undefined) return;
    const rate = toDecimal(line.taxRatePercent);
    if (rate.isNegative() || rate.greaterThan(100)) throw new Error("Belastingtarief moet tussen 0 en 100% liggen");
    const key = rate.toFixed(3);
    const g = groups.get(key) ?? { rate, amount: new Money(0) };
    g.amount = g.amount.plus(lineAmounts[i]);
    groups.set(key, g);
  });

  const taxGroups: TaxGroup[] = [...groups.values()]
    .sort((a, b) => a.rate.comparedTo(b.rate))
    .map(({ rate, amount }) => {
      if (pricesIncludeTax) {
        const taxable = roundMoney(amount.times(100).dividedBy(rate.plus(100)));
        return { ratePercent: rate, taxableAmount: taxable, taxAmount: amount.minus(taxable) };
      }
      return { ratePercent: rate, taxableAmount: amount, taxAmount: roundMoney(amount.times(rate).dividedBy(100)) };
    });

  const gross = lineAmounts.reduce((a, b) => a.plus(b), new Money(0));
  const taxTotal = taxGroups.reduce((a, g) => a.plus(g.taxAmount), new Money(0));
  const subtotal = pricesIncludeTax ? gross.minus(taxTotal) : gross;
  return { lineAmounts, subtotal, taxGroups, taxTotal, total: subtotal.plus(taxTotal) };
}
