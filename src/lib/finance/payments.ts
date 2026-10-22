import Decimal from "decimal.js";
import { Money, toDecimal, type NumericInput } from "./money";

export type PaymentStatus = "open" | "partially_paid" | "paid" | "overdue" | "overpaid";

export interface PaymentSummary {
  total: Decimal;
  paid: Decimal;
  outstanding: Decimal;
  status: PaymentStatus;
}

/** Datumvergelijking op kalenderdag (YYYY-MM-DD), onafhankelijk van tijdzone. */
function isBefore(a: string, b: string) {
  return a < b;
}

export function summarizePayments(
  invoiceTotal: NumericInput,
  payments: NumericInput[],
  dueDate: string | null,
  today: string,
): PaymentSummary {
  const total = toDecimal(invoiceTotal);
  const paid = payments.reduce<Decimal>((a, p) => a.plus(toDecimal(p)), new Money(0));
  const outstanding = total.minus(paid);
  let status: PaymentStatus;
  if (outstanding.isNegative()) status = "overpaid";
  else if (outstanding.isZero()) status = "paid";
  else if (dueDate && isBefore(dueDate, today)) status = "overdue";
  else if (paid.greaterThan(0)) status = "partially_paid";
  else status = "open";
  return { total, paid, outstanding, status };
}
