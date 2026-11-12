import { describe, expect, it } from "vitest";
import type { Invoice, Payment } from "@/lib/types";
import { revenueByMonth, toCsv } from "./reports";

describe("rapportages", () => {
  it("scheidt gefactureerd en ontvangen per maand, inclusief creditnota's", () => {
    const inv = (d: string, sub: string, tot: string, status: Invoice["status"] = "final") => ({ invoice_date: d, subtotal: sub, total: tot, status }) as Invoice;
    const pay = (d: string, a: string) => ({ paid_on: d, amount: a }) as Payment;
    const rows = revenueByMonth([inv("2026-03-02", "1000.00", "1100.00"), inv("2026-03-20", "-100.00", "-110.00"), inv("2026-04-01", "500", "550", "draft")], [pay("2026-04-05", "990.00")], 2026);
    expect(rows[2].invoicedExcl.toFixed(2)).toBe("900.00");
    expect(rows[2].invoicedIncl.toFixed(2)).toBe("990.00");
    expect(rows[3].invoicedExcl.toFixed(2)).toBe("0.00");
    expect(rows[3].received.toFixed(2)).toBe("990.00");
  });

  it("maakt veilige CSV (geen formule-injectie)", () => {
    const csv = toCsv([["Naam", "Bedrag"], ["=HYPERLINK(\"x\")", "-12.50"], ["a;b", 3]]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("-12.50");
    expect(csv).toContain('"a;b"');
  });
});
