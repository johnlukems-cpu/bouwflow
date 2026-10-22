import { z } from "zod";
import { countryCode, optionalEmail, optionalPhone, optionalText, requiredText } from "./common";

const prefix = (label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
    z.string().min(1, `${label} is verplicht`).max(10, `${label} mag maximaal 10 tekens bevatten`).regex(/^[A-Z0-9]+$/, `${label}: alleen letters en cijfers`),
  );

const intInRange = (label: string, min: number, max: number) =>
  z.coerce.number({ error: `${label} moet een getal zijn` }).int(`${label} moet een geheel getal zijn`).min(min, `${label} moet minimaal ${min} zijn`).max(max, `${label} mag maximaal ${max} zijn`);

export const organizationSettingsSchema = z.object({
  org_name: requiredText(200, "Organisatienaam"),
  legal_name: optionalText(200, "Statutaire naam"),
  chamber_of_commerce_no: optionalText(50, "KvK-nummer"),
  vat_number: optionalText(50, "BTW-nummer"),
  address_line: optionalText(200, "Adres"),
  postal_code: optionalText(20, "Postcode"),
  city: optionalText(100, "Plaats"),
  country_code: countryCode,
  phone: optionalPhone,
  email: optionalEmail,
  website: optionalText(200, "Website"),
  iban: optionalText(50, "Bankrekening"),
  currency_code: z.preprocess((v) => (typeof v === "string" ? v.trim().toUpperCase() : v), z.string().regex(/^[A-Z]{3}$/, "Gebruik een ISO-valutacode van 3 letters (bijv. SRD)")),
  locale: z.enum(["nl-SR", "nl-NL", "nl-BE", "en-US", "en-GB"], { error: "Kies een ondersteunde taal/notatie" }),
  timezone: z.string().trim().min(1).max(64).regex(/^[A-Za-z_]+(\/[A-Za-z_+-]+)*$/, "Ongeldige tijdzone"),
  prices_include_vat: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  payment_term_days: intInRange("Betalingstermijn", 0, 365),
  quote_validity_days: intInRange("Geldigheid offerte", 0, 365),
  budget_warning_percent: intInRange("Waarschuwingsdrempel", 1, 1000),
  revenue_basis: z.enum(["contract_value", "invoiced", "received"], { error: "Kies een omzetbasis" }),
  customer_number_prefix: prefix("Voorvoegsel klantnummer"),
  project_number_prefix: prefix("Voorvoegsel projectnummer"),
  quote_number_prefix: prefix("Voorvoegsel offertenummer"),
  invoice_number_prefix: prefix("Voorvoegsel factuurnummer"),
});

export const taxRateSchema = z.object({
  name: requiredText(100, "Naam"),
  rate_percent: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().replace(",", ".") : v),
    z.string().regex(/^\d{1,3}(\.\d{1,3})?$/, "Vul een percentage in, bijv. 10 of 8,5").refine((s) => Number(s) <= 100, "Maximaal 100%"),
  ),
  description: optionalText(500, "Toelichting"),
  is_default: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});
