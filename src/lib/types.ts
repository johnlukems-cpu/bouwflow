import type { Role } from "@/lib/auth/permissions";
import type { RevenueBasis } from "@/lib/finance/postcalc";

export type CustomerType = "private" | "business";
export type ProjectStatus = "concept" | "planned" | "in_progress" | "paused" | "completed" | "cancelled";

export const PROJECT_STATUSES: ProjectStatus[] = ["concept", "planned", "in_progress", "paused", "completed", "cancelled"];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  concept: "Concept",
  planned: "Gepland",
  in_progress: "In uitvoering",
  paused: "Gepauzeerd",
  completed: "Afgerond",
  cancelled: "Geannuleerd",
};

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  private: "Particulier",
  business: "Zakelijk",
};

export interface OrganizationSettings {
  organization_id: string;
  legal_name: string | null;
  chamber_of_commerce_no: string | null;
  vat_number: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  country_code: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  iban: string | null;
  currency_code: string;
  locale: string;
  timezone: string;
  prices_include_vat: boolean;
  payment_term_days: number;
  quote_validity_days: number;
  budget_warning_percent: string;
  revenue_basis: RevenueBasis;
  customer_number_prefix: string;
  project_number_prefix: string;
  quote_number_prefix: string;
  invoice_number_prefix: string;
}

export interface Organization {
  id: string;
  name: string;
}

export interface Membership {
  id: string;
  organization: Organization;
  role: Role;
}

export interface Customer {
  id: string;
  customer_number: string;
  customer_type: CustomerType;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  country_code: string;
  vat_number: string | null;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  project_number: string;
  name: string;
  customer_id: string;
  customer?: { id: string; name: string; customer_number: string } | null;
  location_address: string | null;
  location_city: string | null;
  description: string | null;
  start_date: string | null;
  expected_end_date: string | null;
  project_manager_member_id: string | null;
  project_manager_name?: string | null;
  status: ProjectStatus;
  /** numeric als string, om precisie te behouden */
  budget_amount: string;
  contract_value: string;
  currency_code: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaxRate {
  id: string;
  name: string;
  rate_percent: string;
  description: string | null;
  is_default: boolean;
  is_archived: boolean;
}

export interface Activity {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  summary: string;
  created_at: string;
}

export interface MemberOption {
  id: string;
  name: string;
  role: Role;
}
