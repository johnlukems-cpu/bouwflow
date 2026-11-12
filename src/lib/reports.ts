import Decimal from "decimal.js";
import { Money, toDecimal } from "@/lib/finance/money";
import type { Invoice, Payment } from "@/lib/types";

export interface MonthRow {
  month: string; // YYYY-MM
  invoicedExcl: Decimal;
  invoicedIncl: Decimal;
  received: Decimal;
}

/** Omzet per maand: gefactureerd (definitieve facturen incl. creditnota's) en ontvangen (betalingen) — gescheiden. */
export function revenueByMonth(invoices: Invoice[], payments: Payment[], year: number): MonthRow[] {
  const rows = new Map<string, MonthRow>();
  for (let m = 1; m <= 12; m++) {
    const k = `${year}-${String(m).padStart(2, "0")}`;
    rows.set(k, { month: k, invoicedExcl: new Money(0), invoicedIncl: new Money(0), received: new Money(0) });
  }
  for (const i of invoices) {
    if (i.status !== "final") continue;
    const r = rows.get(i.invoice_date.slice(0, 7));
    if (!r) continue;
    r.invoicedExcl = r.invoicedExcl.plus(toDecimal(i.subtotal));
    r.invoicedIncl = r.invoicedIncl.plus(toDecimal(i.total));
  }
  for (const p of payments) {
    const r = rows.get(p.paid_on.slice(0, 7));
    if (r) r.received = r.received.plus(toDecimal(p.amount));
  }
  return [...rows.values()];
}

/** CSV met puntkomma (Excel NL) en veilige waarden (geen formule-injectie). */
export function toCsv(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n");
}
