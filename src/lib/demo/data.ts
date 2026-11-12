/**
 * DEMO-GEGEVENS — fictief en uitsluitend voor demonstratie.
 * Worden alleen gebruikt wanneer Supabase niet is geconfigureerd. De interface
 * toont in demo-modus altijd een duidelijke "Demo"-markering.
 */
import type { Activity, Customer, Membership, MemberOption, OrganizationSettings, Project, TaxRate } from "@/lib/types";

export const DEMO_ORG_ID = "00000000-0000-4000-8000-000000000001";

export const DEMO_USER = { id: "00000000-0000-4000-8000-0000000000aa", email: "demo@bouwflow.example", name: "Demo Gebruiker" };

export const DEMO_MEMBERSHIP: Membership = {
  id: "00000000-0000-4000-8000-0000000000e1",
  role: "owner",
  organization: { id: DEMO_ORG_ID, name: "Demo Bouw & Installatie N.V." },
};

export const DEMO_SETTINGS: OrganizationSettings = {
  organization_id: DEMO_ORG_ID,
  legal_name: "Demo Bouw & Installatie N.V.",
  chamber_of_commerce_no: "DEMO-00000",
  vat_number: null,
  address_line: "Voorbeeldstraat 1",
  postal_code: null,
  city: "Paramaribo",
  country_code: "SR",
  phone: "+597 000-0000",
  email: "info@demo.example",
  website: null,
  iban: null,
  currency_code: "SRD",
  locale: "nl-SR",
  timezone: "America/Paramaribo",
  prices_include_vat: false,
  payment_term_days: 30,
  quote_validity_days: 30,
  budget_warning_percent: "90",
  revenue_basis: "invoiced",
  customer_number_prefix: "K",
  project_number_prefix: "P",
  quote_number_prefix: "OFF",
  invoice_number_prefix: "FAC",
};

export const DEMO_TAX_RATES: TaxRate[] = [];

export const DEMO_MEMBERS: MemberOption[] = [
  { id: "00000000-0000-4000-8000-0000000000e1", name: "Demo Gebruiker", role: "owner" },
  { id: "00000000-0000-4000-8000-0000000000e2", name: "R. Kromodimedjo (demo)", role: "manager" },
  { id: "00000000-0000-4000-8000-0000000000e3", name: "S. Bhagwandin (demo)", role: "manager" },
];

const ts = (d: string) => `${d}T09:00:00.000Z`;

const c = (n: number, partial: Partial<Customer> & Pick<Customer, "name" | "customer_type">): Customer => ({
  id: `00000000-0000-4000-8000-0000000c${String(n).padStart(4, "0")}`,
  customer_number: `K-${String(n).padStart(5, "0")}`,
  contact_person: null,
  email: null,
  phone: null,
  address_line: null,
  postal_code: null,
  city: "Paramaribo",
  country_code: "SR",
  vat_number: null,
  notes: null,
  is_archived: false,
  created_at: ts("2026-01-10"),
  updated_at: ts("2026-01-10"),
  ...partial,
});

export const DEMO_CUSTOMERS: Customer[] = [
  c(1, { name: "Voorbeeld Woningbouw N.V.", customer_type: "business", contact_person: "M. Pengel", email: "info@woningbouw.example", phone: "+597 400-0001", address_line: "Industrieweg 10", vat_number: "DEMO-BTW-001", created_at: ts("2026-01-12") }),
  c(2, { name: "Familie Ramdin", customer_type: "private", phone: "+597 800-0002", address_line: "Kwattaweg 120", created_at: ts("2026-02-03") }),
  c(3, { name: "Hotel Rivierzicht (demo)", customer_type: "business", contact_person: "A. Wong", email: "facilitair@hotel.example", address_line: "Waterkant 5", vat_number: "DEMO-BTW-003", created_at: ts("2026-02-20") }),
  c(4, { name: "Stichting Schoolgebouwen (demo)", customer_type: "business", contact_person: "D. Sedney", email: "projecten@stichting.example", city: "Wanica", created_at: ts("2026-03-14") }),
  c(5, { name: "J. Tjin-A-Djie", customer_type: "private", email: "j.tjin@mail.example", city: "Lelydorp", created_at: ts("2026-04-02") }),
  c(6, { name: "Supermarkt Centrum (demo)", customer_type: "business", contact_person: "L. Chin", phone: "+597 400-0006", created_at: ts("2026-05-19") }),
  c(7, { name: "Familie Amatredjo", customer_type: "private", city: "Commewijne", is_archived: true, notes: "Gearchiveerd: project afgerond in 2025.", created_at: ts("2025-08-01") }),
];

const p = (n: number, partial: Partial<Project> & Pick<Project, "name" | "customer_id" | "status" | "budget_amount" | "contract_value">): Project => {
  const customer = DEMO_CUSTOMERS.find((x) => x.id === partial.customer_id)!;
  return {
    id: `00000000-0000-4000-8000-0000000d${String(n).padStart(4, "0")}`,
    project_number: `P-2026-${String(n).padStart(4, "0")}`,
    customer: { id: customer.id, name: customer.name, customer_number: customer.customer_number },
    location_address: null,
    location_city: "Paramaribo",
    description: null,
    start_date: null,
    expected_end_date: null,
    project_manager_member_id: DEMO_MEMBERS[1].id,
    project_manager_name: DEMO_MEMBERS[1].name,
    currency_code: "SRD",
    is_archived: false,
    created_at: ts("2026-03-01"),
    updated_at: ts("2026-03-01"),
    ...partial,
  };
};

export const DEMO_PROJECTS: Project[] = [
  p(1, { name: "Nieuwbouw 12 woningen fase 1", customer_id: DEMO_CUSTOMERS[0].id, status: "in_progress", budget_amount: "2850000.00", contract_value: "3420000.00", location_address: "Projectterrein Noord", start_date: "2026-03-01", expected_end_date: "2026-12-15", description: "Ruwbouw en afbouw van 12 eengezinswoningen inclusief elektra en sanitair." }),
  p(2, { name: "Elektrische installatie hotelvleugel", customer_id: DEMO_CUSTOMERS[2].id, status: "in_progress", budget_amount: "480000.00", contract_value: "615000.00", location_address: "Waterkant 5", start_date: "2026-06-10", expected_end_date: "2026-11-30", project_manager_member_id: DEMO_MEMBERS[2].id, project_manager_name: DEMO_MEMBERS[2].name }),
  p(3, { name: "Badkamerrenovatie", customer_id: DEMO_CUSTOMERS[1].id, status: "completed", budget_amount: "68000.00", contract_value: "89500.00", location_address: "Kwattaweg 120", start_date: "2026-02-15", expected_end_date: "2026-03-20" }),
  p(4, { name: "Dakvervanging lokalen", customer_id: DEMO_CUSTOMERS[3].id, status: "planned", budget_amount: "320000.00", contract_value: "395000.00", location_city: "Wanica", start_date: "2026-11-15", expected_end_date: "2027-01-31" }),
  p(5, { name: "Koelinstallatie en verlichting", customer_id: DEMO_CUSTOMERS[5].id, status: "concept", budget_amount: "0.00", contract_value: "0.00", project_manager_member_id: DEMO_MEMBERS[2].id, project_manager_name: DEMO_MEMBERS[2].name }),
  p(6, { name: "Uitbouw keuken", customer_id: DEMO_CUSTOMERS[4].id, status: "paused", budget_amount: "145000.00", contract_value: "182000.00", location_city: "Lelydorp", start_date: "2026-05-01", expected_end_date: "2026-08-30", description: "Gepauzeerd in afwachting van vergunning." }),
  p(7, { name: "Waterleiding vervangen", customer_id: DEMO_CUSTOMERS[1].id, status: "completed", budget_amount: "24000.00", contract_value: "31000.00", start_date: "2026-01-20", expected_end_date: "2026-02-05" }),
  p(8, { name: "Aanbouw schuur", customer_id: DEMO_CUSTOMERS[4].id, status: "cancelled", budget_amount: "40000.00", contract_value: "52000.00" }),
];

export const DEMO_ACTIVITY: Activity[] = [
  { id: "a1", entity_type: "project", entity_id: DEMO_PROJECTS[1].id, action: "status_changed", summary: "Project P-2026-0002 Elektrische installatie hotelvleugel: status gewijzigd naar in_progress", created_at: "2026-10-20T14:12:00.000Z" },
  { id: "a2", entity_type: "customer", entity_id: DEMO_CUSTOMERS[5].id, action: "created", summary: "Klant K-00006 Supermarkt Centrum (demo) aangemaakt", created_at: "2026-10-18T10:03:00.000Z" },
  { id: "a3", entity_type: "project", entity_id: DEMO_PROJECTS[4].id, action: "created", summary: "Project P-2026-0005 Koelinstallatie en verlichting aangemaakt", created_at: "2026-10-18T10:20:00.000Z" },
  { id: "a4", entity_type: "project", entity_id: DEMO_PROJECTS[3].id, action: "updated", summary: "Project P-2026-0004 Dakvervanging lokalen gewijzigd", created_at: "2026-10-15T08:45:00.000Z" },
  { id: "a5", entity_type: "customer", entity_id: DEMO_CUSTOMERS[6].id, action: "archived", summary: "Klant K-00007 Familie Amatredjo gearchiveerd", created_at: "2026-10-02T16:30:00.000Z" },
];

export const DEMO_SUBSCRIPTION = {
  planCode: "professional",
  planName: "Professional (demo)",
  status: "active" as const,
  trialEndsAt: null,
  modules: ["leveranciers", "medewerkers", "planning", "materialen", "voorraad", "calculatie", "inkoop", "werkbonnen", "uren", "offertes", "facturatie", "betalingen", "nacalculatie", "rapportages", "documenten", "klantportaal"],
  maxUsers: 15,
  writable: true,
};
