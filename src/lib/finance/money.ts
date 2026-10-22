import Decimal from "decimal.js";

/**
 * Alle geldberekeningen in BouwFlow gebruiken decimale rekenkunde (geen
 * JavaScript-floats) en ronden expliciet af op 2 decimalen, "half up".
 */
export const Money = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type MoneyValue = Decimal;
export type NumericInput = Decimal.Value | null | undefined;

export function toDecimal(value: NumericInput): Decimal {
  if (value === null || value === undefined || value === "") return new Money(0);
  const d = new Money(value);
  if (!d.isFinite()) throw new Error(`Ongeldig bedrag: ${String(value)}`);
  return d;
}

/** Rondt af op centen (2 decimalen, half up). */
export function roundMoney(value: NumericInput, decimals = 2): Decimal {
  return toDecimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}

export function sum(values: NumericInput[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(toDecimal(v)), new Money(0));
}

/** Converteert naar een string met vaste decimalen, geschikt voor de database (numeric). */
export function toDbAmount(value: NumericInput): string {
  return roundMoney(value).toFixed(2);
}

/**
 * Parseert gebruikersinvoer ("1.234,56", "1234.56", "1 234,56").
 * Eén punt gevolgd door precies drie cijfers ("2.500") geldt — conform de
 * Nederlandse notatie — als duizendtalscheiding.
 * Retourneert null bij ongeldige invoer.
 */
export function parseAmountInput(raw: string): Decimal | null {
  const s = raw.trim().replace(/\s| /g, "").replace(/^(SRD|USD|EUR|€|\$)/i, "");
  if (s === "") return null;
  let normalized = s;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Het laatst voorkomende scheidingsteken is het decimaalteken.
    normalized = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    normalized = s.replace(",", ".");
  } else if ((s.match(/\./g) ?? []).length > 1 || /^-?\d{1,3}\.\d{3}$/.test(s)) {
    // Nederlandse notatie: punt als duizendtalscheiding ("2.500" = 2500).
    normalized = s.replace(/\./g, "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return new Money(normalized);
}

const formatterCache = new Map<string, Intl.NumberFormat>();

export function formatMoney(value: NumericInput, currency = "SRD", locale = "nl-SR"): string {
  const key = `${locale}|${currency}`;
  let fmt = formatterCache.get(key);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "code" });
    } catch {
      fmt = new Intl.NumberFormat("nl-NL", { style: "currency", currency, currencyDisplay: "code" });
    }
    formatterCache.set(key, fmt);
  }
  return fmt.format(roundMoney(value).toNumber());
}

export function formatPercent(value: NumericInput, locale = "nl-SR", decimals = 1): string {
  const d = toDecimal(value).toDecimalPlaces(decimals);
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(d.toNumber())}%`;
}
