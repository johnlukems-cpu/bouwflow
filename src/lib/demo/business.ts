/**
 * DEMO-GEGEVENS voor alle bedrijfsmodules — fictief, alleen-lezen.
 * Afgeleide bedragen (totalen, kosten, saldi, voorraad) worden met dezelfde
 * rekenfuncties berekend als de applicatie, zodat de demo intern klopt.
 */
import { calculateEstimateLine } from "@/lib/finance/estimate";
import { Money, roundMoney, toDecimal } from "@/lib/finance/money";
import { calculateDocumentTotals, calculateLineAmount } from "@/lib/finance/tax";
import type {
  CostEntry,
  DocumentFile,
  DocumentLine,
  Employee,
  EstimateLine,
  Invoice,
  Material,
  Payment,
  ProjectFinancials,
  ProjectTask,
  PurchaseOrder,
  PurchaseOrderLine,
  Quote,
  StockLevel,
  StockMovement,
  Supplier,
  TaxRate,
  TimeEntry,
  WorkOrder,
  WorkOrderMaterial,
} from "@/lib/types";
import { DEMO_CUSTOMERS, DEMO_PROJECTS } from "./data";

const id = (prefix: string, n: number) => `00000000-0000-4000-8000-${prefix}${String(n).padStart(10, "0")}`;
const P1 = DEMO_PROJECTS[0];
const P2 = DEMO_PROJECTS[1];
const proj = (p: (typeof DEMO_PROJECTS)[number]) => ({ project_number: p.project_number, name: p.name, customer_id: p.customer_id });

export const DEMO_TAX: TaxRate = {
  id: id("e0", 1),
  name: "Voorbeeldtarief (demo — niet wettelijk gevalideerd)",
  rate_percent: "10.000",
  description: "Uitsluitend voor demonstratie. Stel uw werkelijke tarieven in bij Instellingen.",
  is_default: true,
  is_archived: false,
};

export const DEMO_SUPPLIERS: Supplier[] = [
  { id: id("a0", 1), supplier_number: "L-00001", name: "Groothandel Bouwmaterialen (demo)", supplier_type: "supplier", contact_person: "R. Lie", email: "verkoop@groothandel.example", phone: "+597 400-1001", address_line: "Industrieweg-Noord 4", city: "Paramaribo", country_code: "SR", vat_number: null, payment_term_days: 30, notes: null, is_archived: false, created_at: "2026-01-05T10:00:00Z" },
  { id: id("a0", 2), supplier_number: "L-00002", name: "Elektro Groothandel (demo)", supplier_type: "supplier", contact_person: "K. Ramlal", email: "orders@elektro.example", phone: "+597 400-1002", address_line: "Verlengde Gemenelandsweg 80", city: "Paramaribo", country_code: "SR", vat_number: null, payment_term_days: 14, notes: null, is_archived: false, created_at: "2026-01-06T10:00:00Z" },
  { id: id("a0", 3), supplier_number: "L-00003", name: "Steigerverhuur (demo)", supplier_type: "rental", contact_person: null, email: null, phone: "+597 400-1003", address_line: null, city: "Wanica", country_code: "SR", vat_number: null, payment_term_days: 30, notes: null, is_archived: false, created_at: "2026-02-01T10:00:00Z" },
  { id: id("a0", 4), supplier_number: "L-00004", name: "Grondwerk Onderaanneming (demo)", supplier_type: "subcontractor", contact_person: "J. Kartosen", email: null, phone: "+597 800-1004", address_line: null, city: "Lelydorp", country_code: "SR", vat_number: null, payment_term_days: 30, notes: null, is_archived: false, created_at: "2026-02-10T10:00:00Z" },
];

export const DEMO_EMPLOYEES: Employee[] = [
  { id: id("b0", 1), employee_number: "M-0001", full_name: "R. Kromodimedjo (demo)", job_title: "Projectleider", email: null, phone: null, member_id: "00000000-0000-4000-8000-0000000000e2", hourly_cost: "120.00", hourly_rate: "180.00", is_active: true, notes: null },
  { id: id("b0", 2), employee_number: "M-0002", full_name: "A. Pinas (demo)", job_title: "Elektricien", email: null, phone: "+597 800-2002", member_id: null, hourly_cost: "75.00", hourly_rate: "120.00", is_active: true, notes: null },
  { id: id("b0", 3), employee_number: "M-0003", full_name: "D. Sumter (demo)", job_title: "Timmerman", email: null, phone: null, member_id: null, hourly_cost: "70.00", hourly_rate: "110.00", is_active: true, notes: null },
  { id: id("b0", 4), employee_number: "M-0004", full_name: "S. Bhagwandin (demo)", job_title: "Projectleider installaties", email: null, phone: null, member_id: "00000000-0000-4000-8000-0000000000e3", hourly_cost: "115.00", hourly_rate: "175.00", is_active: true, notes: null },
];
export const DEMO_EMPLOYEE_ID = DEMO_EMPLOYEES[0].id;

export const DEMO_MATERIALS: Material[] = [
  { id: id("c1", 1), article_number: "KAB-325", description: "Installatiekabel 3x2,5 mm² (demo)", category: "Kabels", unit: "m", cost_price: "12.5000", sale_price: "16.2500", waste_percent: "10.00", track_stock: true, min_stock: "200.000", supplier_id: id("a0", 2), is_archived: false },
  { id: id("c1", 2), article_number: "PVC-50", description: "PVC-afvoerbuis 50 mm (demo)", category: "Leidingen", unit: "m", cost_price: "38.0000", sale_price: "52.0000", waste_percent: "5.00", track_stock: true, min_stock: "50.000", supplier_id: id("a0", 1), is_archived: false },
  { id: id("c1", 3), article_number: "CEM-42", description: "Cement 42,5 — zak 42,5 kg (demo)", category: "Beton", unit: "zak", cost_price: "145.0000", sale_price: "175.0000", waste_percent: "3.00", track_stock: true, min_stock: "40.000", supplier_id: id("a0", 1), is_archived: false },
  { id: id("c1", 4), article_number: "GRP-16", description: "Groepenkast 16 groepen (demo)", category: "Elektrische componenten", unit: "st", cost_price: "2450.0000", sale_price: "3150.0000", waste_percent: "0.00", track_stock: false, min_stock: null, supplier_id: id("a0", 2), is_archived: false },
  { id: id("c1", 5), article_number: "HOUT-BAT", description: "Panlat 22x50 mm (demo)", category: "Hout", unit: "m", cost_price: "9.5000", sale_price: "13.0000", waste_percent: "8.00", track_stock: false, min_stock: null, supplier_id: id("a0", 1), is_archived: false },
];

function estimate(n: number, projectId: string, costType: EstimateLine["cost_type"], description: string, unit: string, quantity: string, unitCost: string, unitPrice: string, waste = "0", materialId: string | null = null, category: string | null = null): EstimateLine {
  const r = calculateEstimateLine({ costType, quantity, unitCost, unitPrice, wastePercent: waste });
  return {
    id: id("c2", n), project_id: projectId, cost_type: costType, material_id: materialId, article_number: null, description, category, unit,
    quantity, unit_cost: unitCost, unit_price: unitPrice, waste_percent: waste, cost_total: r.costTotal.toFixed(2), sale_total: r.saleTotal.toFixed(2), sort_order: n,
  };
}

export const DEMO_ESTIMATE_LINES: EstimateLine[] = [
  estimate(1, P1.id, "material", "Installatiekabel 3x2,5 mm²", "m", "4800", "12.50", "16.25", "10", DEMO_MATERIALS[0].id, "Kabels"),
  estimate(2, P1.id, "material", "Cement 42,5 (zakken)", "zak", "1800", "145", "175", "3", DEMO_MATERIALS[2].id, "Beton"),
  estimate(3, P1.id, "material", "Overige bouwmaterialen", "post", "1", "820000", "1010000", "0", null, "Bouwmaterialen"),
  estimate(4, P1.id, "labor", "Ruwbouw en afbouw", "uur", "9600", "75", "110"),
  estimate(5, P1.id, "equipment", "Steigers en machines", "week", "30", "4200", "5400"),
  estimate(6, P1.id, "transport", "Transport materialen", "rit", "120", "650", "850"),
  estimate(7, P1.id, "subcontractor", "Grondwerk en fundering", "post", "1", "260000", "310000"),
  estimate(8, P2.id, "material", "Groepenkasten 16 groepen", "st", "24", "2450", "3150", "0", DEMO_MATERIALS[3].id, "Elektrische componenten"),
  estimate(9, P2.id, "material", "Installatiekabel 3x2,5 mm²", "m", "6000", "12.50", "16.25", "10", DEMO_MATERIALS[0].id, "Kabels"),
  estimate(10, P2.id, "labor", "Elektrische installatie", "uur", "1900", "75", "120"),
];

export const DEMO_TASKS: ProjectTask[] = [
  { id: id("c3", 1), project_id: P1.id, title: "Fundering blok A", description: null, employee_id: DEMO_EMPLOYEES[2].id, start_date: "2026-11-09", end_date: "2026-11-13", planned_hours: "40", status: "in_progress", project: proj(P1), employee: { full_name: DEMO_EMPLOYEES[2].full_name } },
  { id: id("c3", 2), project_id: P1.id, title: "Elektra woningen 1–4", description: null, employee_id: DEMO_EMPLOYEES[1].id, start_date: "2026-11-11", end_date: "2026-11-20", planned_hours: "64", status: "todo", project: proj(P1), employee: { full_name: DEMO_EMPLOYEES[1].full_name } },
  { id: id("c3", 3), project_id: P2.id, title: "Groepenkasten plaatsen", description: null, employee_id: DEMO_EMPLOYEES[1].id, start_date: "2026-11-16", end_date: "2026-11-18", planned_hours: "24", status: "todo", project: proj(P2), employee: { full_name: DEMO_EMPLOYEES[1].full_name } },
  { id: id("c3", 4), project_id: P2.id, title: "Oplevering en keuring", description: null, employee_id: DEMO_EMPLOYEES[3].id, start_date: "2026-11-25", end_date: "2026-11-27", planned_hours: "16", status: "todo", project: proj(P2), employee: { full_name: DEMO_EMPLOYEES[3].full_name } },
];

export const DEMO_WORK_ORDERS: WorkOrder[] = [
  { id: id("c5", 1), work_order_number: "WB-2026-0001", project_id: P1.id, employee_id: DEMO_EMPLOYEES[2].id, work_date: "2026-11-09", start_time: "07:00:00", end_time: "16:00:00", break_minutes: 60, hours: "8.00", work_description: "Bekisting fundering blok A gezet, wapening geplaatst.", notes: null, status: "approved", rejection_reason: null, project: proj(P1), employee: { full_name: DEMO_EMPLOYEES[2].full_name } },
  { id: id("c5", 2), work_order_number: "WB-2026-0002", project_id: P2.id, employee_id: DEMO_EMPLOYEES[1].id, work_date: "2026-11-10", start_time: "07:30:00", end_time: "16:00:00", break_minutes: 30, hours: "8.00", work_description: "Kabels getrokken tweede verdieping, 6 groepen aangesloten.", notes: "Klant vraagt extra wandcontactdozen in lobby.", status: "submitted", rejection_reason: null, project: proj(P2), employee: { full_name: DEMO_EMPLOYEES[1].full_name } },
];
export const DEMO_WORK_ORDER_MATERIALS: WorkOrderMaterial[] = [
  { id: id("c6", 1), work_order_id: id("c5", 1), material_id: DEMO_MATERIALS[2].id, description: DEMO_MATERIALS[2].description, unit: "zak", quantity: "40.000", unit_cost: "145.0000" },
  { id: id("c6", 2), work_order_id: id("c5", 2), material_id: DEMO_MATERIALS[0].id, description: DEMO_MATERIALS[0].description, unit: "m", quantity: "320.000", unit_cost: null },
];

export const DEMO_TIME_ENTRIES: TimeEntry[] = [
  { id: id("c4", 1), project_id: P1.id, employee_id: DEMO_EMPLOYEES[2].id, work_order_id: id("c5", 1), entry_date: "2026-11-09", start_time: "07:00:00", end_time: "16:00:00", break_minutes: 60, hours: "8.00", description: "Werkbon WB-2026-0001", status: "approved", hourly_cost: "70.00", project: proj(P1), employee: { full_name: DEMO_EMPLOYEES[2].full_name } },
  { id: id("c4", 2), project_id: P1.id, employee_id: DEMO_EMPLOYEES[0].id, work_order_id: null, entry_date: "2026-11-10", start_time: null, end_time: null, break_minutes: 0, hours: "6.00", description: "Projectleiding en overleg aannemer", status: "approved", hourly_cost: "120.00", project: proj(P1), employee: { full_name: DEMO_EMPLOYEES[0].full_name } },
  { id: id("c4", 3), project_id: P2.id, employee_id: DEMO_EMPLOYEES[3].id, work_order_id: null, entry_date: "2026-11-11", start_time: "08:00:00", end_time: "12:00:00", break_minutes: 0, hours: "4.00", description: "Werkvoorbereiding", status: "submitted", hourly_cost: null, project: proj(P2), employee: { full_name: DEMO_EMPLOYEES[3].full_name } },
];

export const DEMO_PURCHASE_ORDERS: PurchaseOrder[] = [
  { id: id("c7", 1), purchase_order_number: "IO-2026-0001", supplier_id: DEMO_SUPPLIERS[0].id, project_id: P1.id, status: "partially_received", order_date: "2026-11-02", expected_date: "2026-11-09", currency_code: "SRD", notes: null, supplier: { name: DEMO_SUPPLIERS[0].name, supplier_number: DEMO_SUPPLIERS[0].supplier_number }, project: proj(P1) },
  { id: id("c7", 2), purchase_order_number: "IO-2026-0002", supplier_id: DEMO_SUPPLIERS[2].id, project_id: P1.id, status: "received", order_date: "2026-11-03", expected_date: "2026-11-04", currency_code: "SRD", notes: null, supplier: { name: DEMO_SUPPLIERS[2].name, supplier_number: DEMO_SUPPLIERS[2].supplier_number }, project: proj(P1) },
  { id: id("c7", 3), purchase_order_number: "IO-2026-0003", supplier_id: DEMO_SUPPLIERS[1].id, project_id: P2.id, status: "draft", order_date: "2026-11-11", expected_date: null, currency_code: "SRD", notes: null, supplier: { name: DEMO_SUPPLIERS[1].name, supplier_number: DEMO_SUPPLIERS[1].supplier_number }, project: proj(P2) },
];
const pol = (n: number, po: number, material: Material | null, description: string, unit: string, quantity: string, unitCost: string, destination: "stock" | "project", received: string, projectId: string | null, costType: PurchaseOrderLine["cost_type"] = "material"): PurchaseOrderLine => ({
  id: id("c8", n), purchase_order_id: id("c7", po), material_id: material?.id ?? null, description, unit, quantity, unit_cost: unitCost,
  line_total: roundMoney(toDecimal(quantity).times(unitCost)).toFixed(2), destination, project_id: projectId, cost_type: costType, quantity_received: received,
});
export const DEMO_PO_LINES: PurchaseOrderLine[] = [
  pol(1, 1, DEMO_MATERIALS[2], "Cement 42,5", "zak", "200", "142.50", "stock", "200", null),
  pol(2, 1, DEMO_MATERIALS[1], "PVC-afvoerbuis 50 mm", "m", "150", "37.00", "stock", "0", null),
  pol(3, 2, null, "Huur steigers 4 weken", "week", "4", "4200.00", "project", "4", P1.id, "equipment"),
  pol(4, 3, DEMO_MATERIALS[0], "Installatiekabel 3x2,5 mm²", "m", "2000", "12.10", "stock", "0", null),
];
for (const po of DEMO_PURCHASE_ORDERS) {
  po.total = DEMO_PO_LINES.filter((l) => l.purchase_order_id === po.id).reduce((a, l) => a.plus(l.line_total), new Money(0)).toFixed(2);
}

export const DEMO_STOCK_MOVEMENTS: StockMovement[] = [
  { id: id("cf", 1), material_id: DEMO_MATERIALS[0].id, movement_type: "adjustment", quantity: "850.000", unit_cost: "12.5000", project_id: null, source_type: null, occurred_on: "2026-10-01", note: "Beginvoorraad", material: null, project: null },
  { id: id("cf", 2), material_id: DEMO_MATERIALS[1].id, movement_type: "adjustment", quantity: "35.000", unit_cost: "38.0000", project_id: null, source_type: null, occurred_on: "2026-10-01", note: "Beginvoorraad", material: null, project: null },
  { id: id("cf", 3), material_id: DEMO_MATERIALS[2].id, movement_type: "receipt", quantity: "200.000", unit_cost: "142.5000", project_id: null, source_type: "purchase_receipt", occurred_on: "2026-11-05", note: "Inkooporder IO-2026-0001", material: null, project: null },
  { id: id("cf", 4), material_id: DEMO_MATERIALS[2].id, movement_type: "issue", quantity: "40.000", unit_cost: "145.0000", project_id: P1.id, source_type: "work_order_material", occurred_on: "2026-11-09", note: "Werkbon WB-2026-0001", material: null, project: { project_number: P1.project_number, name: P1.name } },
];
for (const m of DEMO_STOCK_MOVEMENTS) {
  const mat = DEMO_MATERIALS.find((x) => x.id === m.material_id)!;
  m.material = { article_number: mat.article_number, description: mat.description, unit: mat.unit };
}

export const DEMO_STOCK: StockLevel[] = DEMO_MATERIALS.filter((m) => m.track_stock).map((m) => {
  const onHand = DEMO_STOCK_MOVEMENTS.filter((s) => s.material_id === m.id).reduce(
    (a, s) => (s.movement_type === "issue" ? a.minus(s.quantity) : a.plus(s.quantity)),
    new Money(0),
  );
  return { material_id: m.id, article_number: m.article_number, description: m.description, unit: m.unit, category: m.category, min_stock: m.min_stock, cost_price: m.cost_price, on_hand: onHand.toFixed(3) };
});

// --- Offertes en facturen ---------------------------------------------------
function docLines(prefix: string, start: number, rows: [string, string, string, string, string?][]): DocumentLine[] {
  return rows.map(([description, quantity, unit, unitPrice, discount], i) => ({
    id: id(prefix, start + i), description, quantity, unit, unit_price: unitPrice, discount_percent: discount ?? "0",
    tax_rate_id: DEMO_TAX.id, tax_rate_percent: DEMO_TAX.rate_percent,
    line_amount: calculateLineAmount({ quantity, unitPrice, discountPercent: discount ?? 0 }).toFixed(2), sort_order: i,
  }));
}
function withTotals<T extends { prices_include_tax: boolean }>(doc: T, lines: DocumentLine[]) {
  const t = calculateDocumentTotals(lines.map((l) => ({ quantity: l.quantity, unitPrice: l.unit_price, discountPercent: l.discount_percent, taxRatePercent: l.tax_rate_percent })), doc.prices_include_tax);
  return {
    ...doc,
    subtotal: t.subtotal.toFixed(2),
    tax_total: t.taxTotal.toFixed(2),
    total: t.total.toFixed(2),
    tax_breakdown: t.taxGroups.map((g) => ({ rate_percent: g.ratePercent.toFixed(3), taxable_amount: g.taxableAmount.toFixed(2), tax_amount: g.taxAmount.toFixed(2) })),
  };
}

export const DEMO_DOC_LINES: Record<string, DocumentLine[]> = {};
const cust = (cid: string) => {
  const c = DEMO_CUSTOMERS.find((x) => x.id === cid)!;
  return { name: c.name, customer_number: c.customer_number };
};

const quoteBase = {
  version: 1, introduction: "Hierbij ontvangt u onze offerte voor de genoemde werkzaamheden.", terms: "Prijzen in SRD. Geldig tot de vermelde datum.",
  prices_include_tax: false, currency_code: "SRD", snapshot: null, responded_via: null,
};
DEMO_DOC_LINES[id("c9", 1)] = docLines("ca", 1, [["Materialen elektrische installatie", "1", "post", "193650"], ["Arbeid elektrische installatie", "1900", "uur", "120"], ["Keuring en oplevering", "1", "post", "15000"]]);
DEMO_DOC_LINES[id("c9", 2)] = docLines("ca", 10, [["Koelcel 3x2 m incl. montage", "1", "st", "185000"], ["LED-verlichting winkelvloer", "60", "st", "1450", "5"]]);
DEMO_DOC_LINES[id("c9", 3)] = docLines("ca", 20, [["Dakbeschot en dakbedekking vervangen", "640", "m²", "520"], ["Afvoer en container", "1", "post", "12500"]]);

export const DEMO_QUOTES: Quote[] = [
  withTotals({ ...quoteBase, id: id("c9", 1), quote_number: "OFF-2026-0001", customer_id: P2.customer_id, project_id: P2.id, status: "accepted" as const, title: "Elektrische installatie hotelvleugel", quote_date: "2026-05-20", valid_until: "2026-06-19", sent_at: "2026-05-20T12:00:00Z", responded_at: "2026-05-28T09:00:00Z", responded_by_name: "A. Wong", responded_via: "portal", customer: cust(P2.customer_id), project: proj(P2), subtotal: "", tax_total: "", total: "", tax_breakdown: [] }, DEMO_DOC_LINES[id("c9", 1)]),
  withTotals({ ...quoteBase, id: id("c9", 2), quote_number: "OFF-2026-0002", customer_id: DEMO_PROJECTS[4].customer_id, project_id: DEMO_PROJECTS[4].id, status: "sent" as const, title: "Koelinstallatie en verlichting", quote_date: "2026-11-05", valid_until: "2026-12-05", sent_at: "2026-11-05T12:00:00Z", responded_at: null, responded_by_name: null, customer: cust(DEMO_PROJECTS[4].customer_id), project: proj(DEMO_PROJECTS[4]), subtotal: "", tax_total: "", total: "", tax_breakdown: [] }, DEMO_DOC_LINES[id("c9", 2)]),
  withTotals({ ...quoteBase, id: id("c9", 3), quote_number: "OFF-2026-0003", customer_id: DEMO_PROJECTS[3].customer_id, project_id: DEMO_PROJECTS[3].id, status: "draft" as const, title: "Dakvervanging lokalen", quote_date: "2026-11-11", valid_until: "2026-12-11", sent_at: null, responded_at: null, responded_by_name: null, customer: cust(DEMO_PROJECTS[3].customer_id), project: proj(DEMO_PROJECTS[3]), subtotal: "", tax_total: "", total: "", tax_breakdown: [] }, DEMO_DOC_LINES[id("c9", 3)]),
];

const q1 = DEMO_QUOTES[0];
DEMO_DOC_LINES[id("cb", 1)] = [{ ...docLines("cc", 1, [[`Voorschotfactuur 30% van offerte ${q1.quote_number}`, "1", "post", roundMoney(toDecimal(q1.subtotal).times(0.3)).toFixed(2)]])[0] }];
DEMO_DOC_LINES[id("cb", 2)] = [{ ...docLines("cc", 2, [[`Termijnfactuur 40% van offerte ${q1.quote_number}`, "1", "post", roundMoney(toDecimal(q1.subtotal).times(0.4)).toFixed(2)]])[0] }];
DEMO_DOC_LINES[id("cb", 3)] = docLines("cc", 3, [["Badkamerrenovatie volgens afspraak", "1", "post", "89500"]]);

const invBase = { quote_id: null, credited_invoice_id: null, payment_terms: "Betaling binnen 30 dagen na factuurdatum.", notes: null, prices_include_tax: false, currency_code: "SRD", snapshot: null };
export const DEMO_INVOICES: Invoice[] = [
  withTotals({ ...invBase, id: id("cb", 1), invoice_number: "FAC-2026-0001", invoice_type: "advance" as const, customer_id: P2.customer_id, project_id: P2.id, quote_id: q1.id, status: "final" as const, title: `Voorschotfactuur — ${q1.title}`, invoice_date: "2026-06-01", due_date: "2026-07-01", finalized_at: "2026-06-01T10:00:00Z", customer: cust(P2.customer_id), project: proj(P2), subtotal: "", tax_total: "", total: "", tax_breakdown: [] }, DEMO_DOC_LINES[id("cb", 1)]),
  withTotals({ ...invBase, id: id("cb", 2), invoice_number: "FAC-2026-0002", invoice_type: "installment" as const, customer_id: P2.customer_id, project_id: P2.id, quote_id: q1.id, status: "final" as const, title: `Termijnfactuur — ${q1.title}`, invoice_date: "2026-09-15", due_date: "2026-10-15", finalized_at: "2026-09-15T10:00:00Z", customer: cust(P2.customer_id), project: proj(P2), subtotal: "", tax_total: "", total: "", tax_breakdown: [] }, DEMO_DOC_LINES[id("cb", 2)]),
  withTotals({ ...invBase, id: id("cb", 3), invoice_number: "FAC-2026-0003", invoice_type: "standard" as const, customer_id: DEMO_PROJECTS[2].customer_id, project_id: DEMO_PROJECTS[2].id, status: "final" as const, title: "Badkamerrenovatie", invoice_date: "2026-03-25", due_date: "2026-04-24", finalized_at: "2026-03-25T10:00:00Z", customer: cust(DEMO_PROJECTS[2].customer_id), project: proj(DEMO_PROJECTS[2]), subtotal: "", tax_total: "", total: "", tax_breakdown: [] }, DEMO_DOC_LINES[id("cb", 3)]),
];

export const DEMO_PAYMENTS: Payment[] = [
  { id: id("cd", 1), invoice_id: id("cb", 1), amount: DEMO_INVOICES[0].total, paid_on: "2026-06-20", method: "bank_transfer", reference: "Bankref 88231", notes: null, reversed_payment_id: null },
  { id: id("cd", 2), invoice_id: id("cb", 2), amount: "100000.00", paid_on: "2026-10-01", method: "bank_transfer", reference: "Bankref 90412", notes: "Deelbetaling", reversed_payment_id: null },
  { id: id("cd", 3), invoice_id: id("cb", 3), amount: DEMO_INVOICES[2].total, paid_on: "2026-04-10", method: "cash", reference: null, notes: null, reversed_payment_id: null },
];

/** Saldo per factuur — zelfde logica als de databaseview invoice_balances. */
export function demoInvoiceBalances(today: string): Invoice[] {
  return DEMO_INVOICES.map((inv) => {
    const paid = DEMO_PAYMENTS.filter((p) => p.invoice_id === inv.id).reduce((a, p) => a.plus(p.amount), new Money(0));
    const credited = DEMO_INVOICES.filter((c) => c.credited_invoice_id === inv.id && c.status === "final").reduce((a, c) => a.minus(c.total), new Money(0));
    const outstanding = inv.status === "final" && inv.invoice_type !== "credit" ? toDecimal(inv.total).minus(credited).minus(paid) : new Money(0);
    const status =
      inv.status !== "final" ? inv.status : inv.invoice_type === "credit" ? "credit" : outstanding.lte(0) ? "paid" : inv.due_date && inv.due_date < today ? "overdue" : paid.gt(0) ? "partially_paid" : "open";
    for (const p of DEMO_PAYMENTS) if (p.invoice_id === inv.id) p.invoice = { invoice_number: inv.invoice_number, customer_id: inv.customer_id, title: inv.title };
    return { ...inv, paid: paid.toFixed(2), credited: credited.toFixed(2), outstanding: outstanding.toFixed(2), payment_status: status as Invoice["payment_status"] };
  });
}

// --- Kostenregister (afgeleid, zoals de databasefuncties dat doen) ----------
export const DEMO_COST_ENTRIES: CostEntry[] = [
  ...DEMO_TIME_ENTRIES.filter((t) => t.status === "approved").map((t, i) => ({
    id: id("ce", i + 1), project_id: t.project_id, cost_type: "labor" as const, description: `Uren ${t.employee?.full_name}`,
    quantity: t.hours, unit: "uur", unit_cost: t.hourly_cost, amount: roundMoney(toDecimal(t.hours).times(t.hourly_cost ?? 0)).toFixed(2),
    entry_date: t.entry_date, source_type: "time_entry" as const,
  })),
  ...DEMO_STOCK_MOVEMENTS.filter((s) => s.movement_type === "issue" && s.project_id).map((s, i) => ({
    id: id("ce", 20 + i), project_id: s.project_id!, cost_type: "material" as const, description: `${s.material?.article_number} ${s.material?.description}`,
    quantity: s.quantity, unit: s.material?.unit ?? null, unit_cost: s.unit_cost, amount: roundMoney(toDecimal(s.quantity).times(s.unit_cost)).toFixed(2),
    entry_date: s.occurred_on, source_type: "stock_movement" as const,
  })),
  { id: id("ce", 40), project_id: P1.id, cost_type: "equipment", description: "Inkoop IO-2026-0002: Huur steigers 4 weken", quantity: "4", unit: "week", unit_cost: "4200", amount: "16800.00", entry_date: "2026-11-04", source_type: "purchase_receipt" },
  { id: id("ce", 41), project_id: P1.id, cost_type: "transport", description: "Transport zand en grind (handmatig)", quantity: null, unit: null, unit_cost: null, amount: "6400.00", entry_date: "2026-11-06", source_type: "manual" },
  { id: id("ce", 42), project_id: P2.id, cost_type: "material", description: "Groepenkasten (factuur leverancier, handmatig)", quantity: "24", unit: "st", unit_cost: "2450", amount: "58800.00", entry_date: "2026-08-12", source_type: "manual" },
  { id: id("ce", 43), project_id: P2.id, cost_type: "labor", description: "Uren elektriciens juni–oktober (geïmporteerd)", quantity: "1720", unit: "uur", unit_cost: "75", amount: "129000.00", entry_date: "2026-10-31", source_type: "manual" },
  { id: id("ce", 44), project_id: P2.id, cost_type: "material", description: "Installatiekabel (factuur leverancier, handmatig)", quantity: "6900", unit: "m", unit_cost: "12.50", amount: "86250.00", entry_date: "2026-07-02", source_type: "manual" },
];

/** Projectfinanciën — zelfde opbouw als de databaseview project_financials. */
export function demoProjectFinancials(projectId: string): ProjectFinancials {
  const p = DEMO_PROJECTS.find((x) => x.id === projectId)!;
  const est = DEMO_ESTIMATE_LINES.filter((e) => e.project_id === projectId);
  const costs = DEMO_COST_ENTRIES.filter((c) => c.project_id === projectId);
  const sumBy = <T,>(rows: T[], pick: (r: T) => string | null | undefined) => rows.reduce((a, r) => a.plus(toDecimal(pick(r) ?? 0)), new Money(0));
  const b = (t: string) => sumBy(est.filter((e) => e.cost_type === t), (e) => e.cost_total).toFixed(2);
  const a = (t: string) => sumBy(costs.filter((c) => c.cost_type === t), (c) => c.amount).toFixed(2);
  const invoices = demoInvoiceBalances("2026-11-12").filter((i) => i.project_id === projectId && i.status === "final");
  const receivedExcl = invoices.reduce((acc, i) => (toDecimal(i.total).isZero() ? acc : acc.plus(roundMoney(toDecimal(i.paid ?? 0).times(i.subtotal).dividedBy(i.total)))), new Money(0));
  return {
    project_id: projectId, currency_code: p.currency_code, contract_value: p.contract_value, budget_amount: p.budget_amount,
    budget_material: b("material"), budget_labor: b("labor"), budget_equipment: b("equipment"), budget_transport: b("transport"),
    budget_subcontractor: b("subcontractor"), budget_other: b("other"),
    budget_cost_total: sumBy(est, (e) => e.cost_total).toFixed(2), budget_sale_total: sumBy(est, (e) => e.sale_total).toFixed(2),
    budget_labor_hours: est.filter((e) => e.cost_type === "labor").reduce((acc, e) => acc.plus(calculateEstimateLine({ costType: "labor", quantity: e.quantity, unitCost: 0, unitPrice: 0, wastePercent: e.waste_percent }).effectiveQuantity), new Money(0)).toFixed(2),
    estimate_line_count: est.length,
    actual_material: a("material"), actual_labor: a("labor"), actual_equipment: a("equipment"), actual_transport: a("transport"),
    actual_subcontractor: a("subcontractor"), actual_other: a("other"), actual_cost_total: sumBy(costs, (c) => c.amount).toFixed(2),
    actual_labor_hours: sumBy(DEMO_TIME_ENTRIES.filter((t) => t.project_id === projectId && t.status === "approved"), (t) => t.hours).toFixed(2),
    invoiced_excl_tax: sumBy(invoices, (i) => i.subtotal).toFixed(2), invoiced_incl_tax: sumBy(invoices, (i) => i.total).toFixed(2),
    received_incl_tax: sumBy(invoices, (i) => i.paid).toFixed(2), received_excl_tax: receivedExcl.toFixed(2),
  };
}

export const DEMO_DOCUMENTS: DocumentFile[] = [
  { id: id("d1", 1), project_id: P1.id, customer_id: null, work_order_id: null, name: "Bouwtekening blok A (demo).pdf", category: "tekening", storage_path: "demo/tekening.pdf", mime_type: "application/pdf", size_bytes: 1834221, created_at: "2026-03-02T10:00:00Z" },
  { id: id("d1", 2), project_id: P1.id, customer_id: null, work_order_id: null, name: "Bouwvergunning (demo).pdf", category: "vergunning", storage_path: "demo/vergunning.pdf", mime_type: "application/pdf", size_bytes: 422981, created_at: "2026-02-20T10:00:00Z" },
  { id: id("d1", 3), project_id: P2.id, customer_id: null, work_order_id: id("c5", 2), name: "Foto groepenkast verdieping 2 (demo).jpg", category: "foto", storage_path: "demo/foto.jpg", mime_type: "image/jpeg", size_bytes: 2381022, created_at: "2026-11-10T15:00:00Z" },
];
