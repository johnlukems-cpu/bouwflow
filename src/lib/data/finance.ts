import "server-only";
import type { AppContext } from "@/lib/auth/context";
import { DEMO_DOC_LINES, DEMO_DOCUMENTS, DEMO_PAYMENTS, DEMO_QUOTES, DEMO_TAX, demoInvoiceBalances, demoProjectFinancials } from "@/lib/demo/business";
import { DEMO_PROJECTS } from "@/lib/demo/data";
import { todayISO } from "@/lib/format";
import type { DocumentFile, DocumentLine, Invoice, Payment, ProjectFinancials, Quote, TaxRate } from "@/lib/types";
import { load, numStr, one } from "./query";
import { isUuid } from "./shared";

type R<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
const DOC_NUM = ["subtotal", "tax_total", "total"] as const;
const LINE_NUM = ["quantity", "unit_price", "discount_percent", "tax_rate_percent", "line_amount"] as const;
const REL = "customer:customers(name, customer_number), project:projects(project_number, name)";

export async function listQuotes(ctx: AppContext, opts: { status?: string; projectId?: string; customerId?: string } = {}): Promise<Quote[]> {
  const rows = await load(
    ctx,
    "Offertes",
    () =>
      DEMO_QUOTES.filter(
        (q) => (!opts.status || q.status === opts.status) && (!opts.projectId || q.project_id === opts.projectId) && (!opts.customerId || q.customer_id === opts.customerId),
      ),
    (sb, org) => {
      let q = sb.from("quotes").select(`*, ${REL}`).eq("organization_id", org).order("quote_date", { ascending: false }).order("quote_number", { ascending: false }).limit(500);
      if (opts.status) q = q.eq("status", opts.status);
      if (opts.projectId && isUuid(opts.projectId)) q = q.eq("project_id", opts.projectId);
      if (opts.customerId && isUuid(opts.customerId)) q = q.eq("customer_id", opts.customerId);
      return q as unknown as R<Quote[]>;
    },
  );
  return rows.map((r) => ({ ...numStr(r, [...DOC_NUM]), customer: one(r.customer), project: one(r.project) }));
}

export async function getQuote(ctx: AppContext, id: string): Promise<{ quote: Quote; lines: DocumentLine[] } | null> {
  if (!isUuid(id)) return null;
  const quote = await load(ctx, "Offerte", () => DEMO_QUOTES.find((q) => q.id === id) ?? null, (sb, org) =>
    sb.from("quotes").select(`*, ${REL}`).eq("organization_id", org).eq("id", id).maybeSingle() as unknown as R<Quote>,
  );
  if (!quote) return null;
  const lines = await load(ctx, "Offerteregels", () => DEMO_DOC_LINES[id] ?? [], (sb, org) =>
    sb.from("quote_lines").select("*").eq("organization_id", org).eq("quote_id", id).order("sort_order").order("created_at") as unknown as R<DocumentLine[]>,
  );
  return { quote: { ...numStr(quote, [...DOC_NUM]), customer: one(quote.customer), project: one(quote.project) }, lines: lines.map((l) => numStr(l, [...LINE_NUM])) };
}

function mergeBalance(inv: Invoice, b?: { paid: unknown; credited: unknown; outstanding: unknown; payment_status: unknown }): Invoice {
  return {
    ...numStr(inv, [...DOC_NUM]),
    customer: one(inv.customer),
    project: one(inv.project),
    paid: b ? String(b.paid) : "0.00",
    credited: b ? String(b.credited) : "0.00",
    outstanding: b ? String(b.outstanding) : "0.00",
    payment_status: (b?.payment_status as Invoice["payment_status"]) ?? (inv.status === "draft" ? "draft" : "open"),
  };
}

export async function listInvoices(ctx: AppContext, opts: { status?: string; projectId?: string; customerId?: string; paymentStatus?: string } = {}): Promise<Invoice[]> {
  const today = todayISO(ctx.settings.timezone);
  const rows = await load(
    ctx,
    "Facturen",
    () =>
      demoInvoiceBalances(today).filter(
        (i) => (!opts.status || i.status === opts.status) && (!opts.projectId || i.project_id === opts.projectId) && (!opts.customerId || i.customer_id === opts.customerId),
      ),
    (sb, org) => {
      let q = sb
        .from("invoices")
        .select(`*, ${REL}, balance:invoice_balances(paid, credited, outstanding, payment_status)`)
        .eq("organization_id", org)
        .order("invoice_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1000);
      if (opts.status) q = q.eq("status", opts.status);
      if (opts.projectId && isUuid(opts.projectId)) q = q.eq("project_id", opts.projectId);
      if (opts.customerId && isUuid(opts.customerId)) q = q.eq("customer_id", opts.customerId);
      return q as unknown as R<(Invoice & { balance?: unknown })[]>;
    },
  );
  const list = (rows as (Invoice & { balance?: unknown })[]).map((r) =>
    ctx.mode === "demo" ? r : mergeBalance(r, one(r.balance as { paid: unknown; credited: unknown; outstanding: unknown; payment_status: unknown } | null) ?? undefined),
  );
  return opts.paymentStatus ? list.filter((i) => i.payment_status === opts.paymentStatus) : list;
}

export async function getInvoice(ctx: AppContext, id: string): Promise<{ invoice: Invoice; lines: DocumentLine[]; payments: Payment[] } | null> {
  if (!isUuid(id)) return null;
  const today = todayISO(ctx.settings.timezone);
  const inv = await load(ctx, "Factuur", () => demoInvoiceBalances(today).find((i) => i.id === id) ?? null, (sb, org) =>
    sb
      .from("invoices")
      .select(`*, ${REL}, balance:invoice_balances(paid, credited, outstanding, payment_status)`)
      .eq("organization_id", org)
      .eq("id", id)
      .maybeSingle() as unknown as R<Invoice & { balance?: unknown }>,
  );
  if (!inv) return null;
  const invoice = ctx.mode === "demo" ? inv : mergeBalance(inv, one((inv as { balance?: unknown }).balance as never) ?? undefined);
  const lines = await load(ctx, "Factuurregels", () => DEMO_DOC_LINES[id] ?? [], (sb, org) =>
    sb.from("invoice_lines").select("*").eq("organization_id", org).eq("invoice_id", id).order("sort_order").order("created_at") as unknown as R<DocumentLine[]>,
  );
  const payments = await listPayments(ctx, { invoiceId: id });
  return { invoice, lines: lines.map((l) => numStr(l, [...LINE_NUM])), payments };
}

export async function listPayments(ctx: AppContext, opts: { invoiceId?: string; limit?: number } = {}): Promise<Payment[]> {
  const rows = await load(
    ctx,
    "Betalingen",
    () => {
      demoInvoiceBalances(todayISO(ctx.settings.timezone));
      return DEMO_PAYMENTS.filter((p) => !opts.invoiceId || p.invoice_id === opts.invoiceId).sort((a, b) => b.paid_on.localeCompare(a.paid_on));
    },
    (sb, org) => {
      let q = sb
        .from("payments")
        .select("*, invoice:invoices(invoice_number, customer_id, title)")
        .eq("organization_id", org)
        .order("paid_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(opts.limit ?? 500);
      if (opts.invoiceId && isUuid(opts.invoiceId)) q = q.eq("invoice_id", opts.invoiceId);
      return q as unknown as R<Payment[]>;
    },
  );
  return rows.map((r) => ({ ...numStr(r, ["amount"]), invoice: one(r.invoice) }));
}

const FIN_NUM: (keyof ProjectFinancials)[] = [
  "contract_value", "budget_amount", "budget_material", "budget_labor", "budget_equipment", "budget_transport", "budget_subcontractor", "budget_other",
  "budget_cost_total", "budget_sale_total", "budget_labor_hours", "actual_material", "actual_labor", "actual_equipment", "actual_transport",
  "actual_subcontractor", "actual_other", "actual_cost_total", "actual_labor_hours", "invoiced_excl_tax", "invoiced_incl_tax", "received_incl_tax", "received_excl_tax",
];

export async function getProjectFinancials(ctx: AppContext, projectId: string): Promise<ProjectFinancials | null> {
  if (!isUuid(projectId)) return null;
  const row = await load(ctx, "Projectfinanciën", () => (DEMO_PROJECTS.some((p) => p.id === projectId) ? demoProjectFinancials(projectId) : null), (sb, org) =>
    sb.from("project_financials").select("*").eq("organization_id", org).eq("project_id", projectId).maybeSingle() as unknown as R<ProjectFinancials>,
  );
  return row ? numStr(row, FIN_NUM) : null;
}

export async function listProjectFinancials(ctx: AppContext): Promise<ProjectFinancials[]> {
  const rows = await load(ctx, "Projectfinanciën", () => DEMO_PROJECTS.map((p) => demoProjectFinancials(p.id)), (sb, org) =>
    sb.from("project_financials").select("*").eq("organization_id", org).limit(5000) as unknown as R<ProjectFinancials[]>,
  );
  return rows.map((r) => numStr(r, FIN_NUM));
}

export async function listActiveTaxRates(ctx: AppContext): Promise<TaxRate[]> {
  const rows = await load(ctx, "Belastingtarieven", () => [DEMO_TAX], (sb, org) =>
    sb.from("tax_rates").select("id, name, rate_percent, description, is_default, is_archived").eq("organization_id", org).eq("is_archived", false).order("rate_percent") as unknown as R<TaxRate[]>,
  );
  return rows.map((r) => numStr(r, ["rate_percent"]));
}

export async function listDocuments(ctx: AppContext, opts: { projectId?: string; workOrderId?: string; customerId?: string } = {}): Promise<DocumentFile[]> {
  return load(
    ctx,
    "Documenten",
    () =>
      DEMO_DOCUMENTS.filter(
        (d) => (!opts.projectId || d.project_id === opts.projectId) && (!opts.workOrderId || d.work_order_id === opts.workOrderId) && (!opts.customerId || d.customer_id === opts.customerId),
      ),
    (sb, org) => {
      let q = sb.from("documents").select("*").eq("organization_id", org).eq("is_archived", false).order("created_at", { ascending: false }).limit(1000);
      if (opts.projectId && isUuid(opts.projectId)) q = q.eq("project_id", opts.projectId);
      if (opts.workOrderId && isUuid(opts.workOrderId)) q = q.eq("work_order_id", opts.workOrderId);
      if (opts.customerId && isUuid(opts.customerId)) q = q.eq("customer_id", opts.customerId);
      return q as unknown as R<DocumentFile[]>;
    },
  );
}
