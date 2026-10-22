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
