import { describe, expect, it } from "vitest";
import { toFieldErrors } from "./common";
import {
  documentLineSchema,
  estimateLineSchema,
  invoiceFromQuoteSchema,
  materialSchema,
  paymentSchema,
  stockMovementSchema,
  timeEntrySchema,
  workOrderSchema,
} from "./modules";

const uuid = "3f1c1d2e-4b5a-4c6d-8e7f-9a0b1c2d3e4f";

describe("modulevalidatie", () => {
  it("normaliseert calculatieregels met Nederlandse notatie", () => {
    const r = estimateLineSchema.parse({ cost_type: "material", description: "Kabel", unit: "m", quantity: "1.250,5", unit_cost: "12,5", unit_price: "16,25", waste_percent: "10" });
    expect(r.quantity).toBe("1250.500");
    expect(r.unit_cost).toBe("12.5000");
    expect(r.waste_percent).toBe("10.00");
  });

  it("weigert verlies boven 100% en te veel decimalen", () => {
    expect(estimateLineSchema.safeParse({ cost_type: "material", description: "x", unit: "m", quantity: "1", unit_cost: "1", unit_price: "1", waste_percent: "150" }).success).toBe(false);
    expect(estimateLineSchema.safeParse({ cost_type: "material", description: "x", unit: "m", quantity: "1,0001", unit_cost: "1", unit_price: "1" }).success).toBe(false);
  });

  it("controleert urenregistratie", () => {
    const base = { project_id: uuid, employee_id: uuid, entry_date: "2026-11-02" };
    expect(timeEntrySchema.safeParse({ ...base }).success).toBe(false); // geen uren en geen tijden
    expect(timeEntrySchema.safeParse({ ...base, start_time: "08:00" }).success).toBe(false); // alleen begintijd
    expect(timeEntrySchema.safeParse({ ...base, start_time: "12:00", end_time: "08:00" }).success).toBe(false);
    expect(timeEntrySchema.parse({ ...base, hours: "7,5" }).hours).toBe("7.50");
    expect(timeEntrySchema.safeParse({ ...base, hours: "25" }).success).toBe(false);
  });

  it("controleert werkbon (pauze korter dan werktijd)", () => {
    const base = { project_id: uuid, employee_id: uuid, work_date: "2026-11-03", work_description: "Werk" };
    expect(workOrderSchema.safeParse({ ...base, start_time: "08:00", end_time: "09:00", break_minutes: "90" }).success).toBe(false);
    const ok = workOrderSchema.safeParse({ ...base, start_time: "07:30", end_time: "16:00", break_minutes: "30" });
    expect(ok.success).toBe(true);
  });

  it("documentregels mogen negatief zijn (creditnota/korting) maar niet 0", () => {
    expect(documentLineSchema.parse({ description: "Korting", quantity: "-1", unit: "post", unit_price: "100" }).quantity).toBe("-1.000");
    expect(documentLineSchema.safeParse({ description: "x", quantity: "0", unit: "st", unit_price: "1" }).success).toBe(false);
  });

  it("betaling moet positief zijn en een geldige sleutel hebben", () => {
    const base = { invoice_id: uuid, paid_on: "2026-11-02", method: "cash", idempotency_key: "abcd-1234-efgh" };
    expect(paymentSchema.safeParse({ ...base, amount: "-10" }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...base, amount: "10", idempotency_key: "x" }).success).toBe(false);
    expect(paymentSchema.parse({ ...base, amount: "1.234,56" }).amount).toBe("1234.56");
  });

  it("voorraad: uitgifte vereist project en positieve hoeveelheid", () => {
    const base = { material_id: uuid, occurred_on: "2026-11-02" };
    const r = stockMovementSchema.safeParse({ ...base, movement_type: "issue", quantity: "5" });
    expect(r.success).toBe(false);
    if (!r.success) expect(toFieldErrors(r.error).project_id).toBe("Kies het project");
    expect(stockMovementSchema.safeParse({ ...base, movement_type: "issue", quantity: "-5", project_id: uuid }).success).toBe(false);
    expect(stockMovementSchema.parse({ ...base, movement_type: "adjustment", quantity: "-2", project_id: uuid }).project_id).toBeNull();
  });

  it("termijnfactuur vereist een percentage", () => {
    expect(invoiceFromQuoteSchema.safeParse({ quote_id: uuid, invoice_type: "installment" }).success).toBe(false);
    expect(invoiceFromQuoteSchema.parse({ quote_id: uuid, invoice_type: "advance", percent: "30" }).percent).toBe("30.00");
    expect(invoiceFromQuoteSchema.safeParse({ quote_id: uuid, invoice_type: "advance", percent: "120" }).success).toBe(false);
  });

  it("materiaal: alleen bekende categorieën", () => {
    expect(materialSchema.safeParse({ article_number: "A1", description: "x", category: "Snoep", unit: "st" }).success).toBe(false);
    expect(materialSchema.parse({ article_number: "A1", description: "x", category: "Kabels", unit: "m", track_stock: "on" }).track_stock).toBe(true);
  });
});
