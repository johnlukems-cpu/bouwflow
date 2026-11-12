import { z } from "zod";
import { parseAmountInput } from "@/lib/finance/money";

/** Lege strings worden null; overige strings worden getrimd. */
export const optionalText = (max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v ?? null),
    z.string().max(max, `${label} mag maximaal ${max} tekens bevatten`).nullable(),
  );

export const requiredText = (max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string({ error: `${label} is verplicht` })
      .min(1, `${label} is verplicht`)
      .max(max, `${label} mag maximaal ${max} tekens bevatten`),
  );

export const optionalEmail = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim().toLowerCase()) : v ?? null),
  z.email("Vul een geldig e-mailadres in").max(200).nullable(),
);

export const optionalPhone = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v ?? null),
  z
    .string()
    .max(50, "Telefoonnummer is te lang")
    .regex(/^[+0-9()\-\s./]{5,}$/, "Vul een geldig telefoonnummer in")
    .nullable(),
);

export const countryCode = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? v.trim().toUpperCase() : "SR"),
  z.string().regex(/^[A-Z]{2}$/, "Gebruik een landcode van 2 letters (bijv. SR)"),
);

export const optionalUuid = (label: string) =>
  z.preprocess((v) => (v === "" || v === undefined ? null : v), z.uuid(`${label} is ongeldig`).nullable());

export const optionalDate = (label: string) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.iso.date(`${label} is geen geldige datum`).nullable(),
  );

const MAX_AMOUNT = "999999999999.99";

/** Geldbedrag als invoerstring → genormaliseerde string met 2 decimalen. */
export const moneyAmount = (label: string) =>
  z.preprocess(
    (v) => (v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? "0" : String(v)),
    z.string().transform((raw, ctx) => {
      const d = parseAmountInput(raw);
      if (!d) {
        ctx.addIssue({ code: "custom", message: `${label} is geen geldig bedrag` });
        return z.NEVER;
      }
      if (d.isNegative()) {
        ctx.addIssue({ code: "custom", message: `${label} mag niet negatief zijn` });
        return z.NEVER;
      }
      if (d.decimalPlaces() > 2) {
        ctx.addIssue({ code: "custom", message: `${label} mag maximaal 2 decimalen hebben` });
        return z.NEVER;
      }
      if (d.greaterThan(MAX_AMOUNT)) {
        ctx.addIssue({ code: "custom", message: `${label} is te groot` });
        return z.NEVER;
      }
      return d.toFixed(2);
    }),
  );

export type FieldErrors = Record<string, string>;

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function formDataToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string" && !key.startsWith("$ACTION")) obj[key] = value;
  });
  return obj;
}

/**
 * Generiek decimaal veld (hoeveelheden, prijzen, percentages) met Nederlandse
 * invoernotatie. Retourneert een genormaliseerde string (bijv. "12.500").
 */
export function decimalValue(
  label: string,
  opts: { decimals: number; min?: string; max?: string; allowNegative?: boolean; nonZero?: boolean; optional?: boolean; defaultValue?: string },
) {
  return z.preprocess(
    (v) => {
      if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) return opts.defaultValue ?? (opts.optional ? null : "");
      return String(v);
    },
    z
      .string({ error: `${label} is verplicht` })
      .nullable()
      .transform((raw, ctx) => {
        if (raw === null) return null;
        if (raw === "") {
          ctx.addIssue({ code: "custom", message: `${label} is verplicht` });
          return z.NEVER;
        }
        const d = parseAmountInput(raw);
        if (!d) {
          ctx.addIssue({ code: "custom", message: `${label} is geen geldig getal` });
          return z.NEVER;
        }
        if (!opts.allowNegative && d.isNegative()) {
          ctx.addIssue({ code: "custom", message: `${label} mag niet negatief zijn` });
          return z.NEVER;
        }
        if (opts.nonZero && d.isZero()) {
          ctx.addIssue({ code: "custom", message: `${label} mag niet 0 zijn` });
          return z.NEVER;
        }
        if (d.decimalPlaces() > opts.decimals) {
          ctx.addIssue({ code: "custom", message: `${label} mag maximaal ${opts.decimals} decimalen hebben` });
          return z.NEVER;
        }
        if (opts.min !== undefined && d.lessThan(opts.min)) {
          ctx.addIssue({ code: "custom", message: `${label} moet minimaal ${opts.min.replace(".", ",")} zijn` });
          return z.NEVER;
        }
        if (opts.max !== undefined && d.greaterThan(opts.max)) {
          ctx.addIssue({ code: "custom", message: `${label} mag maximaal ${opts.max.replace(".", ",")} zijn` });
          return z.NEVER;
        }
        return d.toFixed(opts.decimals);
      }),
  );
}

export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const optionalTime = (label: string) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, `${label} is geen geldige tijd`).nullable(),
  );

export const requiredDate = (label: string) =>
  z.preprocess((v) => (v === "" ? undefined : v), z.iso.date(`${label} is geen geldige datum`));

export const intInRange = (label: string, min: number, max: number, def?: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? def : v),
    z.coerce.number({ error: `${label} moet een getal zijn` }).int(`${label} moet een geheel getal zijn`).min(min, `${label} moet minimaal ${min} zijn`).max(max, `${label} mag maximaal ${max} zijn`),
  );
