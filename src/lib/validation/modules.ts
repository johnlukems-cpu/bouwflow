import { z } from "zod";
import { MATERIAL_CATEGORIES } from "@/lib/finance/estimate";
import {
  checkbox,
  countryCode,
  decimalValue,
  intInRange,
  optionalDate,
  optionalEmail,
  optionalPhone,
  optionalText,
  optionalTime,
  optionalUuid,
  requiredDate,
  requiredText,
} from "./common";

const COST_TYPES = ["material", "labor", "equipment", "transport", "subcontractor", "other"] as const;
const qty = (label: string, extra: Partial<Parameters<typeof decimalValue>[1]> = {}) => decimalValue(label, { decimals: 3, max: "99999999999", ...extra });
const price = (label: string, extra: Partial<Parameters<typeof decimalValue>[1]> = {}) => decimalValue(label, { decimals: 4, max: "9999999999", ...extra });
const money = (label: string, extra: Partial<Parameters<typeof decimalValue>[1]> = {}) => decimalValue(label, { decimals: 2, max: "999999999999.99", ...extra });
const percent = (label: string) => decimalValue(label, { decimals: 2, min: "0", max: "100", defaultValue: "0" });
const uuid = (label: string) => z.uuid(`Kies een ${label}`);

export const supplierSchema = z.object({
  name: requiredText(200, "Naam"),
  supplier_type: z.enum(["supplier", "subcontractor", "rental", "other"], { error: "Kies een soort" }),
  contact_person: optionalText(200, "Contactpersoon"),
  email: optionalEmail,
  phone: optionalPhone,
  address_line: optionalText(200, "Adres"),
  city: optionalText(100, "Plaats"),
  country_code: countryCode,
  vat_number: optionalText(50, "BTW-nummer"),
  payment_term_days: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().min(0).max(365).nullable()),
  notes: optionalText(5000, "Opmerkingen"),
});

export const employeeSchema = z.object({
  full_name: requiredText(200, "Naam"),
  job_title: optionalText(100, "Functie"),
  email: optionalEmail,
  phone: optionalPhone,
  member_id: optionalUuid("Gebruikersaccount"),
  hourly_cost: money("Interne kostprijs per uur", { defaultValue: "0" }),
  hourly_rate: money("Verkooptarief per uur", { defaultValue: "0" }),
  is_active: checkbox,
  notes: optionalText(5000, "Opmerkingen"),
});

export const materialSchema = z.object({
  article_number: requiredText(50, "Artikelnummer"),
  description: requiredText(300, "Omschrijving"),
  category: z.enum(MATERIAL_CATEGORIES as unknown as [string, ...string[]], { error: "Kies een categorie" }),
  unit: requiredText(20, "Eenheid"),
  cost_price: price("Kostprijs", { defaultValue: "0" }),
  sale_price: price("Verkoopprijs", { defaultValue: "0" }),
  waste_percent: percent("Snij-/materiaalverlies"),
  track_stock: checkbox,
  min_stock: qty("Minimale voorraad", { optional: true }),
  supplier_id: optionalUuid("Leverancier"),
});

export const estimateLineSchema = z.object({
  cost_type: z.enum(COST_TYPES, { error: "Kies een kostensoort" }),
  material_id: optionalUuid("Materiaal"),
  description: requiredText(300, "Omschrijving"),
  category: optionalText(60, "Categorie"),
  unit: requiredText(20, "Eenheid"),
  quantity: qty("Hoeveelheid"),
  unit_cost: price("Kostprijs per eenheid"),
  unit_price: price("Verkoopprijs per eenheid"),
  waste_percent: percent("Verlies"),
});

export const taskSchema = z
  .object({
    project_id: uuid("project"),
    title: requiredText(200, "Taak"),
    description: optionalText(5000, "Omschrijving"),
    employee_id: optionalUuid("Medewerker"),
    start_date: optionalDate("Startdatum"),
    end_date: optionalDate("Einddatum"),
    planned_hours: decimalValue("Geplande uren", { decimals: 2, optional: true, max: "100000" }),
    status: z.enum(["todo", "in_progress", "done", "cancelled"]),
  })
  .refine((t) => !t.start_date || !t.end_date || t.end_date >= t.start_date, { message: "Einddatum ligt vóór de startdatum", path: ["end_date"] });

export const timeEntrySchema = z
  .object({
    project_id: uuid("project"),
    employee_id: uuid("medewerker"),
    entry_date: requiredDate("Datum"),
    start_time: optionalTime("Begintijd"),
    end_time: optionalTime("Eindtijd"),
    break_minutes: intInRange("Pauze (minuten)", 0, 600, 0),
    hours: decimalValue("Uren", { decimals: 2, optional: true, min: "0.01", max: "24" }),
    description: optionalText(2000, "Omschrijving"),
  })
  .refine((t) => (t.start_time === null) === (t.end_time === null), { message: "Vul zowel begin- als eindtijd in", path: ["end_time"] })
  .refine((t) => !t.start_time || !t.end_time || t.end_time > t.start_time, { message: "Eindtijd moet na begintijd liggen", path: ["end_time"] })
  .refine((t) => t.start_time !== null || t.hours !== null, { message: "Vul uren in, of begin- en eindtijd", path: ["hours"] });

export const workOrderSchema = z
  .object({
    project_id: uuid("project"),
    employee_id: uuid("medewerker"),
    work_date: requiredDate("Datum"),
    start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Vul een begintijd in"),
    end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Vul een eindtijd in"),
    break_minutes: intInRange("Pauze (minuten)", 0, 600, 0),
    work_description: requiredText(5000, "Uitgevoerde werkzaamheden"),
    notes: optionalText(5000, "Opmerkingen"),
  })
  .refine((w) => w.end_time > w.start_time, { message: "Eindtijd moet na begintijd liggen", path: ["end_time"] })
  .refine((w) => minutesBetween(w.start_time, w.end_time) > w.break_minutes, { message: "Pauze is langer dan de werktijd", path: ["break_minutes"] });

export function minutesBetween(start: string, end: string) {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return toMin(end) - toMin(start);
}

export const workOrderMaterialSchema = z.object({
  material_id: optionalUuid("Materiaal"),
  description: requiredText(300, "Omschrijving"),
  unit: requiredText(20, "Eenheid"),
  quantity: qty("Hoeveelheid", { nonZero: true }),
});

export const purchaseOrderSchema = z.object({
  supplier_id: uuid("leverancier"),
  project_id: optionalUuid("Project"),
  order_date: requiredDate("Orderdatum"),
  expected_date: optionalDate("Verwachte levering"),
  notes: optionalText(5000, "Opmerkingen"),
});

export const purchaseLineSchema = z
  .object({
    material_id: optionalUuid("Materiaal"),
    description: requiredText(300, "Omschrijving"),
    unit: requiredText(20, "Eenheid"),
    quantity: qty("Hoeveelheid", { nonZero: true }),
    unit_cost: price("Inkoopprijs"),
    destination: z.enum(["stock", "project"]),
    project_id: optionalUuid("Project"),
    cost_type: z.enum(COST_TYPES),
  })
  .refine((l) => l.destination === "project" || l.material_id !== null, { message: "Levering naar voorraad vereist een materiaal", path: ["material_id"] });

export const receiptSchema = z.object({
  line_id: z.uuid(),
  quantity: qty("Ontvangen hoeveelheid", { nonZero: true }),
  received_on: requiredDate("Ontvangstdatum"),
  idempotency_key: z.string().min(8).max(100),
});

export const stockMovementSchema = z
  .object({
    material_id: uuid("materiaal"),
    movement_type: z.enum(["adjustment", "issue", "return"]),
    quantity: qty("Hoeveelheid", { nonZero: true, allowNegative: true }),
    project_id: optionalUuid("Project"),
    occurred_on: requiredDate("Datum"),
    note: optionalText(500, "Toelichting"),
  })
  .refine((m) => m.movement_type === "adjustment" || !(m.quantity ?? "").startsWith("-"), { message: "Hoeveelheid moet positief zijn", path: ["quantity"] })
  .refine((m) => m.movement_type === "adjustment" || m.project_id !== null, { message: "Kies het project", path: ["project_id"] })
  .transform((m) => (m.movement_type === "adjustment" ? { ...m, project_id: null } : m));

export const costEntrySchema = z.object({
  project_id: uuid("project"),
  cost_type: z.enum(COST_TYPES),
  description: requiredText(300, "Omschrijving"),
  amount: money("Bedrag", { allowNegative: true, nonZero: true }),
  entry_date: requiredDate("Datum"),
});

export const quoteSchema = z
  .object({
    customer_id: uuid("klant"),
    project_id: optionalUuid("Project"),
    title: requiredText(200, "Titel"),
    introduction: optionalText(5000, "Inleiding"),
    terms: optionalText(10000, "Voorwaarden"),
    quote_date: requiredDate("Offertedatum"),
    valid_until: optionalDate("Geldig tot"),
    prices_include_tax: checkbox,
  })
  .refine((q) => !q.valid_until || q.valid_until >= q.quote_date, { message: "Geldig tot ligt vóór de offertedatum", path: ["valid_until"] });

export const documentLineSchema = z.object({
  description: requiredText(1000, "Omschrijving"),
  quantity: qty("Aantal", { nonZero: true, allowNegative: true }),
  unit: requiredText(20, "Eenheid"),
  unit_price: price("Prijs per eenheid", { allowNegative: true }),
  discount_percent: percent("Korting"),
  tax_rate_id: optionalUuid("Belastingtarief"),
});

export const invoiceSchema = z
  .object({
    customer_id: uuid("klant"),
    project_id: optionalUuid("Project"),
    invoice_type: z.enum(["standard", "advance", "installment", "final"]),
    title: requiredText(200, "Titel"),
    invoice_date: requiredDate("Factuurdatum"),
    due_date: optionalDate("Vervaldatum"),
    payment_terms: optionalText(2000, "Betalingsvoorwaarden"),
    notes: optionalText(5000, "Opmerkingen"),
    prices_include_tax: checkbox,
  })
  .refine((i) => !i.due_date || i.due_date >= i.invoice_date, { message: "Vervaldatum ligt vóór de factuurdatum", path: ["due_date"] });

export const paymentSchema = z.object({
  invoice_id: z.uuid("Kies een factuur"),
  amount: money("Bedrag", { nonZero: true }),
  paid_on: requiredDate("Betaaldatum"),
  method: z.enum(["bank_transfer", "cash", "card", "cheque", "other"]),
  reference: optionalText(200, "Referentie"),
  notes: optionalText(2000, "Opmerkingen"),
  idempotency_key: z.string().regex(/^[a-zA-Z0-9-]{8,100}$/, "Ongeldige sleutel"),
});

export const invitationSchema = z.object({
  email: z.email("Vul een geldig e-mailadres in").transform((e) => e.trim().toLowerCase()),
  role: z.enum(["admin", "manager", "finance", "employee", "viewer"], { error: "Kies een rol" }),
});

export const memberUpdateSchema = z.object({
  member_id: z.uuid(),
  role: z.enum(["owner", "admin", "manager", "finance", "employee", "viewer"]),
  is_active: checkbox,
});

export const invoiceFromQuoteSchema = z
  .object({
    quote_id: z.uuid(),
    invoice_type: z.enum(["standard", "advance", "installment", "final"]),
    percent: decimalValue("Percentage", { decimals: 2, optional: true, min: "0.01", max: "100" }),
  })
  .refine((v) => !["advance", "installment"].includes(v.invoice_type) || v.percent !== null, { message: "Vul een percentage in", path: ["percent"] });
