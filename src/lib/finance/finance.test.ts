import { describe, expect, it } from "vitest";
import { calculateEstimateLine, summarizeEstimate } from "./estimate";
import { formatMoney, parseAmountInput, roundMoney, sum, toDbAmount } from "./money";
import { summarizePayments } from "./payments";
import { budgetStatus, calculatePostCalculation, compare, marginPercent } from "./postcalc";
import { calculateDocumentTotals, calculateLineAmount } from "./tax";
import { Money } from "./money";

const s = (d: { toFixed: (n: number) => string }, n = 2) => d.toFixed(n);

describe("geld", () => {
  it("vermijdt float-fouten", () => {
    expect(s(sum([0.1, 0.2]))).toBe("0.30");
    expect(sum(["0.1", "0.2"]).equals("0.3")).toBe(true);
  });

  it("rondt half-up af op centen", () => {
    expect(s(roundMoney("2.345"))).toBe("2.35");
    expect(s(roundMoney("2.344"))).toBe("2.34");
    expect(s(roundMoney("-2.345"))).toBe("-2.35");
    expect(toDbAmount("1234.5")).toBe("1234.50");
  });

  it("parseert Nederlandse en internationale invoer", () => {
    expect(parseAmountInput("1.234,56")?.toFixed(2)).toBe("1234.56");
    expect(parseAmountInput("1234.56")?.toFixed(2)).toBe("1234.56");
    expect(parseAmountInput("1,234.56")?.toFixed(2)).toBe("1234.56");
    expect(parseAmountInput("SRD 2.500")?.toFixed(2)).toBe("2500.00");
    expect(parseAmountInput("1.000.000")?.toFixed(2)).toBe("1000000.00");
    expect(parseAmountInput("12,5")?.toFixed(2)).toBe("12.50");
    expect(parseAmountInput("abc")).toBeNull();
    expect(parseAmountInput("")).toBeNull();
  });

  it("toont de valutacode", () => {
    expect(formatMoney("1234.5", "SRD", "nl-NL")).toMatch(/SRD\s?1\.234,50/);
    expect(formatMoney("10", "USD", "nl-NL")).toMatch(/USD/);
  });
});

describe("voorcalculatie", () => {
  it("berekent een materiaalregel met snijverlies", () => {
    const r = calculateEstimateLine({ costType: "material", quantity: 100, unitCost: "12.50", unitPrice: "16.25", wastePercent: 10 });
    expect(r.effectiveQuantity.toString()).toBe("110");
    expect(s(r.costTotal)).toBe("1375.00");
    expect(s(r.saleTotal)).toBe("1787.50");
    expect(s(r.margin)).toBe("412.50");
  });

  it("rondt elke regel af en telt afgeronde regels op", () => {
    const lines = [
      { costType: "material" as const, quantity: "3", unitCost: "0.333", unitPrice: "0.5" },
      { costType: "material" as const, quantity: "3", unitCost: "0.333", unitPrice: "0.5" },
    ];
    const total = summarizeEstimate(lines);
    expect(s(total.totalCost)).toBe("2.00"); // 2 × round(0.999) = 2 × 1.00
    expect(s(total.totalSale)).toBe("3.00");
  });

  it("vat kostensoorten samen en berekent marge", () => {
    const sum = summarizeEstimate([
      { costType: "material", quantity: 10, unitCost: 100, unitPrice: 130 },
      { costType: "labor", quantity: 40, unitCost: 75, unitPrice: 95 },
      { costType: "transport", quantity: 1, unitCost: 500, unitPrice: 600 },
    ]);
    expect(s(sum.costByType.material)).toBe("1000.00");
    expect(s(sum.costByType.labor)).toBe("3000.00");
    expect(s(sum.totalCost)).toBe("4500.00");
    expect(s(sum.totalSale)).toBe("5700.00");
    expect(s(sum.margin)).toBe("1200.00");
    expect(sum.marginPercent?.toFixed(2)).toBe("21.05");
  });

  it("geeft geen marge-% bij verkoopwaarde 0", () => {
    expect(summarizeEstimate([]).marginPercent).toBeNull();
  });

  it("weigert negatieve waarden en ongeldig verlies", () => {
    expect(() => calculateEstimateLine({ costType: "material", quantity: -1, unitCost: 1, unitPrice: 1 })).toThrow();
    expect(() => calculateEstimateLine({ costType: "material", quantity: 1, unitCost: 1, unitPrice: 1, wastePercent: 150 })).toThrow();
  });
});

describe("belasting op documenten", () => {
  it("berekent regelbedragen met korting", () => {
    expect(s(calculateLineAmount({ quantity: 3, unitPrice: "19.99", discountPercent: 10 }))).toBe("53.97");
  });

  it("groepeert per tarief en rondt per groep af (exclusief)", () => {
    const t = calculateDocumentTotals([
      { quantity: 1, unitPrice: "100.05", taxRatePercent: 10 },
      { quantity: 1, unitPrice: "100.05", taxRatePercent: 10 },
      { quantity: 2, unitPrice: 50, taxRatePercent: 8 },
      { quantity: 1, unitPrice: 25, taxRatePercent: null },
    ]);
    expect(s(t.subtotal)).toBe("325.10");
    expect(t.taxGroups.map((g) => [g.ratePercent.toString(), s(g.taxableAmount), s(g.taxAmount)])).toEqual([
      ["8", "100.00", "8.00"],
      ["10", "200.10", "20.01"],
    ]);
    expect(s(t.taxTotal)).toBe("28.01");
    expect(s(t.total)).toBe("353.11");
  });

  it("rekent terug uit prijzen inclusief belasting", () => {
    const t = calculateDocumentTotals([{ quantity: 1, unitPrice: 110, taxRatePercent: 10 }], true);
    expect(s(t.subtotal)).toBe("100.00");
    expect(s(t.taxTotal)).toBe("10.00");
    expect(s(t.total)).toBe("110.00");
  });

  it("ondersteunt een tarief van 0%", () => {
    const t = calculateDocumentTotals([{ quantity: 1, unitPrice: 100, taxRatePercent: 0 }]);
    expect(s(t.taxTotal)).toBe("0.00");
    expect(t.taxGroups).toHaveLength(1);
  });
});

describe("betalingen", () => {
  it("berekent openstaand bedrag en status", () => {
    expect(summarizePayments(1000, [], "2026-12-01", "2026-10-22").status).toBe("open");
    const p = summarizePayments("1000.00", ["250.10", "249.90"], "2026-12-01", "2026-10-22");
    expect(s(p.outstanding)).toBe("500.00");
    expect(p.status).toBe("partially_paid");
    expect(summarizePayments(1000, [400], "2026-10-01", "2026-10-22").status).toBe("overdue");
    expect(summarizePayments(1000, [1000], "2026-10-01", "2026-10-22").status).toBe("paid");
    expect(summarizePayments(1000, [1200], null, "2026-10-22").status).toBe("overpaid");
    expect(summarizePayments(1000, [], "2026-10-22", "2026-10-22").status).toBe("open");
  });
});

describe("na-calculatie", () => {
  const base = {
    budgetCost: { material: 40000, labor: 30000, equipment: 5000, transport: 2000, subcontractor: 10000, other: 3000 },
    actualCost: { material: 45500, labor: 28000, equipment: 5000, transport: 2500, subcontractor: 10000, other: 1000 },
    budgetLaborHours: 400,
    actualLaborHours: 380,
    budgetRevenue: 120000,
    revenue: { contractValue: 120000, invoiced: 90000, received: 60000 },
  };

  it("berekent kostenverschillen per soort", () => {
    const r = calculatePostCalculation({ ...base, revenueBasis: "contract_value" });
    expect(s(r.byType.material.variance)).toBe("5500.00");
    expect(r.byType.material.variancePercent?.toFixed(2)).toBe("13.75");
    expect(s(r.byType.labor.variance)).toBe("-2000.00");
    expect(r.laborHours.variance.toString()).toBe("-20");
    expect(s(r.totalCost.budget)).toBe("90000.00");
    expect(s(r.totalCost.actual)).toBe("92000.00");
    expect(s(r.totalCost.variance)).toBe("2000.00");
  });

  it("berekent begrote en gerealiseerde winst en marge", () => {
    const r = calculatePostCalculation({ ...base, revenueBasis: "contract_value" });
    expect(s(r.budgetProfit)).toBe("30000.00");
    expect(r.budgetMarginPercent?.toFixed(2)).toBe("25.00");
    expect(s(r.realizedProfit)).toBe("28000.00");
    expect(r.realizedMarginPercent?.toFixed(2)).toBe("23.33");
    expect(r.budgetStatus).toBe("exceeded");
  });

  it("gebruikt de gekozen omzetbasis en houdt bedragen gescheiden", () => {
    const invoiced = calculatePostCalculation({ ...base, revenueBasis: "invoiced" });
    expect(s(invoiced.revenue.realized)).toBe("90000.00");
    expect(s(invoiced.realizedProfit)).toBe("-2000.00");
    const received = calculatePostCalculation({ ...base, revenueBasis: "received" });
    expect(s(received.revenue.realized)).toBe("60000.00");
    expect(s(received.revenue.invoiced)).toBe("90000.00");
    expect(s(received.revenue.contractValue)).toBe("120000.00");
  });

  it("geeft geen marge bij omzet 0", () => {
    expect(marginPercent(new Money(-500), new Money(0))).toBeNull();
    const r = calculatePostCalculation({ budgetCost: {}, actualCost: {}, budgetRevenue: 0, revenue: { contractValue: 0, invoiced: 0, received: 0 }, revenueBasis: "invoiced" });
    expect(r.realizedMarginPercent).toBeNull();
    expect(r.budgetUsedPercent).toBeNull();
    expect(compare(0, 10).variancePercent).toBeNull();
  });

  it("waarschuwt bij naderen of overschrijden van het budget", () => {
    expect(budgetStatus(new Money(1000), new Money(800), 90)).toBe("ok");
    expect(budgetStatus(new Money(1000), new Money(900), 90)).toBe("warning");
    expect(budgetStatus(new Money(1000), new Money(1000.01), 90)).toBe("exceeded");
    expect(budgetStatus(new Money(0), new Money(1), 90)).toBe("exceeded");
    expect(budgetStatus(new Money(0), new Money(0), 90)).toBe("ok");
  });
});
