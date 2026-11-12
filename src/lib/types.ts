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

// ---------------------------------------------------------------------------
// Uitbreiding: alle bedrijfsmodules. Numerieke databasewaarden zijn strings
// (om precisie te behouden) en worden met decimal.js verwerkt.
// ---------------------------------------------------------------------------
export type CostTypeKey = "material" | "labor" | "equipment" | "transport" | "subcontractor" | "other";
export type ApprovalStatus = "draft" | "submitted" | "approved" | "rejected";
export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type PurchaseOrderStatus = "draft" | "ordered" | "partially_received" | "received" | "cancelled";
export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "superseded" | "cancelled";
export type InvoiceType = "standard" | "advance" | "installment" | "final" | "credit";
export type InvoiceStatus = "draft" | "final" | "cancelled";
export type PaymentStatus = "draft" | "cancelled" | "credit" | "paid" | "overdue" | "partially_paid" | "open";
export type PaymentMethod = "bank_transfer" | "cash" | "card" | "cheque" | "other";

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  draft: "Concept",
  submitted: "Ingediend",
  approved: "Goedgekeurd",
  rejected: "Afgekeurd",
};
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = { todo: "Te doen", in_progress: "Bezig", done: "Klaar", cancelled: "Vervallen" };
export const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: "Concept",
  ordered: "Besteld",
  partially_received: "Deels ontvangen",
  received: "Ontvangen",
  cancelled: "Geannuleerd",
};
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Concept",
  sent: "Verzonden",
  accepted: "Geaccepteerd",
  rejected: "Afgewezen",
  superseded: "Vervangen",
  cancelled: "Geannuleerd",
};
export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  standard: "Factuur",
  advance: "Voorschotfactuur",
  installment: "Termijnfactuur",
  final: "Eindfactuur",
  credit: "Creditnota",
};
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  draft: "Concept",
  cancelled: "Geannuleerd",
  credit: "Creditnota",
  paid: "Betaald",
  overdue: "Vervallen",
  partially_paid: "Deels betaald",
  open: "Openstaand",
};
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "Bankoverschrijving",
  cash: "Contant",
  card: "Pin/creditcard",
  cheque: "Cheque",
  other: "Overig",
};
export const SUPPLIER_TYPE_LABELS = { supplier: "Leverancier", subcontractor: "Onderaannemer", rental: "Verhuur", other: "Overig" } as const;

export interface Supplier {
  id: string;
  supplier_number: string;
  name: string;
  supplier_type: keyof typeof SUPPLIER_TYPE_LABELS;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address_line: string | null;
  city: string | null;
  country_code: string;
  vat_number: string | null;
  payment_term_days: number | null;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
}

export interface Employee {
  id: string;
  employee_number: string;
  full_name: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  member_id: string | null;
  hourly_cost: string;
  hourly_rate: string;
  is_active: boolean;
  notes: string | null;
}

export interface Material {
  id: string;
  article_number: string;
  description: string;
  category: string;
  unit: string;
  cost_price: string;
  sale_price: string;
  waste_percent: string;
  track_stock: boolean;
  min_stock: string | null;
  supplier_id: string | null;
  is_archived: boolean;
}

export interface StockLevel {
  material_id: string;
  article_number: string;
  description: string;
  unit: string;
  category: string;
  min_stock: string | null;
  cost_price: string;
  on_hand: string;
}

export interface StockMovement {
  id: string;
  material_id: string;
  movement_type: "receipt" | "issue" | "return" | "adjustment";
  quantity: string;
  unit_cost: string;
  project_id: string | null;
  source_type: string | null;
  occurred_on: string;
  note: string | null;
  material?: { article_number: string; description: string; unit: string } | null;
  project?: { project_number: string; name: string } | null;
}

export interface EstimateLine {
  id: string;
  project_id: string;
  cost_type: CostTypeKey;
  material_id: string | null;
  article_number: string | null;
  description: string;
  category: string | null;
  unit: string;
  quantity: string;
  unit_cost: string;
  unit_price: string;
  waste_percent: string;
  cost_total: string;
  sale_total: string;
  sort_order: number;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  employee_id: string | null;
  start_date: string | null;
  end_date: string | null;
  planned_hours: string | null;
  status: TaskStatus;
  project?: { project_number: string; name: string } | null;
  employee?: { full_name: string } | null;
}

export interface TimeEntry {
  id: string;
  project_id: string;
  employee_id: string;
  work_order_id: string | null;
  entry_date: string;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  hours: string;
  description: string | null;
  status: ApprovalStatus;
  hourly_cost: string | null;
  project?: { project_number: string; name: string } | null;
  employee?: { full_name: string } | null;
}

export interface WorkOrder {
  id: string;
  work_order_number: string;
  project_id: string;
  employee_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  hours: string;
  work_description: string;
  notes: string | null;
  status: ApprovalStatus;
  rejection_reason: string | null;
  project?: { project_number: string; name: string; customer_id?: string } | null;
  employee?: { full_name: string } | null;
}

export interface WorkOrderMaterial {
  id: string;
  work_order_id: string;
  material_id: string | null;
  description: string;
  unit: string;
  quantity: string;
  unit_cost: string | null;
}

export interface PurchaseOrder {
  id: string;
  purchase_order_number: string;
  supplier_id: string;
  project_id: string | null;
  status: PurchaseOrderStatus;
  order_date: string;
  expected_date: string | null;
  currency_code: string;
  notes: string | null;
  supplier?: { name: string; supplier_number: string } | null;
  project?: { project_number: string; name: string } | null;
  total?: string;
}

export interface PurchaseOrderLine {
  id: string;
  purchase_order_id: string;
  material_id: string | null;
  description: string;
  unit: string;
  quantity: string;
  unit_cost: string;
  line_total: string;
  destination: "stock" | "project";
  project_id: string | null;
  cost_type: CostTypeKey;
  quantity_received: string;
}

export interface CostEntry {
  id: string;
  project_id: string;
  cost_type: CostTypeKey;
  description: string;
  quantity: string | null;
  unit: string | null;
  unit_cost: string | null;
  amount: string;
  entry_date: string;
  source_type: "manual" | "time_entry" | "stock_movement" | "purchase_receipt" | "work_order_material";
}

export interface DocumentLine {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  discount_percent: string;
  tax_rate_id: string | null;
  tax_rate_percent: string | null;
  line_amount: string;
  sort_order: number;
}

export interface TaxGroupRow {
  rate_percent: string | number;
  taxable_amount: string | number;
  tax_amount: string | number;
}

export interface Quote {
  id: string;
  quote_number: string;
  version: number;
  customer_id: string;
  project_id: string | null;
  status: QuoteStatus;
  title: string;
  introduction: string | null;
  terms: string | null;
  quote_date: string;
  valid_until: string | null;
  prices_include_tax: boolean;
  currency_code: string;
  subtotal: string;
  tax_total: string;
  total: string;
  tax_breakdown: TaxGroupRow[];
  snapshot: Record<string, unknown> | null;
  sent_at: string | null;
  responded_at: string | null;
  responded_by_name: string | null;
  responded_via: string | null;
  customer?: { name: string; customer_number: string } | null;
  project?: { project_number: string; name: string } | null;
}

export interface Invoice {
  id: string;
  invoice_number: string | null;
  invoice_type: InvoiceType;
  customer_id: string;
  project_id: string | null;
  quote_id: string | null;
  credited_invoice_id: string | null;
  status: InvoiceStatus;
  title: string;
  invoice_date: string;
  due_date: string | null;
  payment_terms: string | null;
  notes: string | null;
  prices_include_tax: boolean;
  currency_code: string;
  subtotal: string;
  tax_total: string;
  total: string;
  tax_breakdown: TaxGroupRow[];
  snapshot: Record<string, unknown> | null;
  finalized_at: string | null;
  customer?: { name: string; customer_number: string } | null;
  project?: { project_number: string; name: string } | null;
  paid?: string;
  credited?: string;
  outstanding?: string;
  payment_status?: PaymentStatus;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: string;
  paid_on: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  reversed_payment_id: string | null;
  invoice?: { invoice_number: string | null; customer_id: string; title: string } | null;
}

export interface ProjectFinancials {
  project_id: string;
  currency_code: string;
  contract_value: string;
  budget_amount: string;
  budget_material: string;
  budget_labor: string;
  budget_equipment: string;
  budget_transport: string;
  budget_subcontractor: string;
  budget_other: string;
  budget_cost_total: string;
  budget_sale_total: string;
  budget_labor_hours: string;
  estimate_line_count: number;
  actual_material: string;
  actual_labor: string;
  actual_equipment: string;
  actual_transport: string;
  actual_subcontractor: string;
  actual_other: string;
  actual_cost_total: string;
  actual_labor_hours: string;
  invoiced_excl_tax: string;
  invoiced_incl_tax: string;
  received_incl_tax: string;
  received_excl_tax: string;
}

export interface DocumentFile {
  id: string;
  project_id: string | null;
  customer_id: string | null;
  work_order_id: string | null;
  name: string;
  category: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}
