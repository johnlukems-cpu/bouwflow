import "server-only";
import type { AppContext } from "@/lib/auth/context";
import {
  DEMO_COST_ENTRIES,
  DEMO_ESTIMATE_LINES,
  DEMO_PO_LINES,
  DEMO_PURCHASE_ORDERS,
  DEMO_TASKS,
  DEMO_TIME_ENTRIES,
  DEMO_WORK_ORDER_MATERIALS,
  DEMO_WORK_ORDERS,
} from "@/lib/demo/business";
import type { CostEntry, EstimateLine, ProjectTask, PurchaseOrder, PurchaseOrderLine, TimeEntry, WorkOrder, WorkOrderMaterial } from "@/lib/types";
import { load, numStr, one } from "./query";
import { isUuid } from "./shared";

type R<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
const PROJ = "project:projects(project_number, name, customer_id)";

export async function listEstimateLines(ctx: AppContext, projectId: string): Promise<EstimateLine[]> {
  if (!isUuid(projectId)) return [];
  const rows = await load(ctx, "Calculatieregels", () => DEMO_ESTIMATE_LINES.filter((e) => e.project_id === projectId), (sb, org) =>
    sb.from("project_estimate_lines").select("*").eq("organization_id", org).eq("project_id", projectId).order("sort_order").order("created_at") as unknown as R<EstimateLine[]>,
  );
  return rows.map((r) => numStr(r, ["quantity", "unit_cost", "unit_price", "waste_percent", "cost_total", "sale_total"]));
}

/** Totalen per project voor het voorcalculatie-overzicht. */
export async function listEstimateTotals(ctx: AppContext): Promise<{ project_id: string; cost_total: string; sale_total: string; lines: number }[]> {
  const rows = await load<{ project_id: string; cost_total: string; sale_total: string }[]>(
    ctx,
    "Calculaties",
    () => DEMO_ESTIMATE_LINES,
    (sb, org) => sb.from("project_estimate_lines").select("project_id, cost_total, sale_total").eq("organization_id", org).limit(20000) as unknown as R<{ project_id: string; cost_total: string; sale_total: string }[]>,
  );
  const map = new Map<string, { cost: number[]; sale: number[]; n: number }>();
  for (const r of rows) {
    const m = map.get(r.project_id) ?? { cost: [], sale: [], n: 0 };
    m.cost.push(Math.round(Number(r.cost_total) * 100));
    m.sale.push(Math.round(Number(r.sale_total) * 100));
    m.n += 1;
    map.set(r.project_id, m);
  }
  // Optellen in centen (gehele getallen) — exact.
  return [...map.entries()].map(([project_id, m]) => ({
    project_id,
    cost_total: (m.cost.reduce((a, b) => a + b, 0) / 100).toFixed(2),
    sale_total: (m.sale.reduce((a, b) => a + b, 0) / 100).toFixed(2),
    lines: m.n,
  }));
}

export async function listTasks(ctx: AppContext, opts: { projectId?: string; from?: string; to?: string; employeeId?: string } = {}): Promise<ProjectTask[]> {
  const rows = await load(
    ctx,
    "Taken",
    () =>
      DEMO_TASKS.filter(
        (t) =>
          (!opts.projectId || t.project_id === opts.projectId) &&
          (!opts.employeeId || t.employee_id === opts.employeeId) &&
          (!opts.from || !t.end_date || t.end_date >= opts.from) &&
          (!opts.to || !t.start_date || t.start_date <= opts.to),
      ),
    (sb, org) => {
      let q = sb.from("project_tasks").select(`*, ${PROJ}, employee:employees(full_name)`).eq("organization_id", org).order("start_date", { nullsFirst: false }).order("sort_order").limit(1000);
      if (opts.projectId && isUuid(opts.projectId)) q = q.eq("project_id", opts.projectId);
      if (opts.employeeId && isUuid(opts.employeeId)) q = q.eq("employee_id", opts.employeeId);
      if (opts.from) q = q.or(`end_date.gte.${opts.from},end_date.is.null`);
      if (opts.to) q = q.or(`start_date.lte.${opts.to},start_date.is.null`);
      return q as unknown as R<ProjectTask[]>;
    },
  );
  return rows.map((r) => ({ ...numStr(r, ["planned_hours"]), project: one(r.project), employee: one(r.employee) }));
}

export async function listTimeEntries(ctx: AppContext, opts: { projectId?: string; employeeId?: string; status?: string; from?: string; to?: string } = {}): Promise<TimeEntry[]> {
  const rows = await load(
    ctx,
    "Uren",
    () =>
      DEMO_TIME_ENTRIES.filter(
        (t) =>
          (!opts.projectId || t.project_id === opts.projectId) &&
          (!opts.employeeId || t.employee_id === opts.employeeId) &&
          (!opts.status || t.status === opts.status) &&
          (!opts.from || t.entry_date >= opts.from) &&
          (!opts.to || t.entry_date <= opts.to),
      ),
    (sb, org) => {
      let q = sb.from("time_entries").select(`*, ${PROJ}, employee:employees(full_name)`).eq("organization_id", org).order("entry_date", { ascending: false }).order("start_time").limit(1000);
      if (opts.projectId && isUuid(opts.projectId)) q = q.eq("project_id", opts.projectId);
      if (opts.employeeId && isUuid(opts.employeeId)) q = q.eq("employee_id", opts.employeeId);
      if (opts.status && ["draft", "submitted", "approved", "rejected"].includes(opts.status)) q = q.eq("status", opts.status);
      if (opts.from) q = q.gte("entry_date", opts.from);
      if (opts.to) q = q.lte("entry_date", opts.to);
      return q as unknown as R<TimeEntry[]>;
    },
  );
  return rows.map((r) => ({ ...numStr(r, ["hours", "hourly_cost"]), project: one(r.project), employee: one(r.employee) }));
}

export async function listWorkOrders(ctx: AppContext, opts: { projectId?: string; employeeId?: string; status?: string } = {}): Promise<WorkOrder[]> {
  const rows = await load(
    ctx,
    "Werkbonnen",
    () =>
      DEMO_WORK_ORDERS.filter(
        (w) => (!opts.projectId || w.project_id === opts.projectId) && (!opts.employeeId || w.employee_id === opts.employeeId) && (!opts.status || w.status === opts.status),
      ),
    (sb, org) => {
      let q = sb.from("work_orders").select(`*, ${PROJ}, employee:employees(full_name)`).eq("organization_id", org).order("work_date", { ascending: false }).order("work_order_number", { ascending: false }).limit(500);
      if (opts.projectId && isUuid(opts.projectId)) q = q.eq("project_id", opts.projectId);
      if (opts.employeeId && isUuid(opts.employeeId)) q = q.eq("employee_id", opts.employeeId);
      if (opts.status && ["draft", "submitted", "approved", "rejected"].includes(opts.status)) q = q.eq("status", opts.status);
      return q as unknown as R<WorkOrder[]>;
    },
  );
  return rows.map((r) => ({ ...numStr(r, ["hours"]), project: one(r.project), employee: one(r.employee) }));
}

export async function getWorkOrder(ctx: AppContext, id: string): Promise<{ workOrder: WorkOrder; materials: WorkOrderMaterial[] } | null> {
  if (!isUuid(id)) return null;
  const wo = await load(ctx, "Werkbon", () => DEMO_WORK_ORDERS.find((w) => w.id === id) ?? null, (sb, org) =>
    sb.from("work_orders").select(`*, ${PROJ}, employee:employees(full_name)`).eq("organization_id", org).eq("id", id).maybeSingle() as unknown as R<WorkOrder>,
  );
  if (!wo) return null;
  const materials = await load(ctx, "Werkbonmaterialen", () => DEMO_WORK_ORDER_MATERIALS.filter((m) => m.work_order_id === id), (sb, org) =>
    sb.from("work_order_materials").select("*").eq("organization_id", org).eq("work_order_id", id).order("created_at") as unknown as R<WorkOrderMaterial[]>,
  );
  return {
    workOrder: { ...numStr(wo, ["hours"]), project: one(wo.project), employee: one(wo.employee) },
    materials: materials.map((m) => numStr(m, ["quantity", "unit_cost"])),
  };
}

export async function listPurchaseOrders(ctx: AppContext, opts: { projectId?: string; status?: string; supplierId?: string } = {}): Promise<PurchaseOrder[]> {
  const rows = await load(
    ctx,
    "Inkooporders",
    () =>
      DEMO_PURCHASE_ORDERS.filter(
        (p) => (!opts.projectId || p.project_id === opts.projectId) && (!opts.status || p.status === opts.status) && (!opts.supplierId || p.supplier_id === opts.supplierId),
      ),
    (sb, org) => {
      let q = sb
        .from("purchase_orders")
        .select("*, supplier:suppliers(name, supplier_number), project:projects(project_number, name), lines:purchase_order_lines(line_total)")
        .eq("organization_id", org)
        .order("order_date", { ascending: false })
        .limit(500);
      if (opts.projectId && isUuid(opts.projectId)) q = q.eq("project_id", opts.projectId);
      if (opts.supplierId && isUuid(opts.supplierId)) q = q.eq("supplier_id", opts.supplierId);
      if (opts.status) q = q.eq("status", opts.status);
      return q as unknown as R<(PurchaseOrder & { lines?: { line_total: string | number }[] })[]>;
    },
  );
  return (rows as (PurchaseOrder & { lines?: { line_total: string | number }[] })[]).map((r) => {
    const total = r.total ?? ((r.lines ?? []).reduce((a, l) => a + Math.round(Number(l.line_total) * 100), 0) / 100).toFixed(2);
    const { lines: _lines, ...rest } = r;
    void _lines;
    return { ...rest, total, supplier: one(r.supplier), project: one(r.project) };
  });
}

export async function getPurchaseOrder(ctx: AppContext, id: string): Promise<{ order: PurchaseOrder; lines: PurchaseOrderLine[] } | null> {
  if (!isUuid(id)) return null;
  const order = await load(ctx, "Inkooporder", () => DEMO_PURCHASE_ORDERS.find((p) => p.id === id) ?? null, (sb, org) =>
    sb.from("purchase_orders").select("*, supplier:suppliers(name, supplier_number), project:projects(project_number, name)").eq("organization_id", org).eq("id", id).maybeSingle() as unknown as R<PurchaseOrder>,
  );
  if (!order) return null;
  const lines = await load(ctx, "Inkoopregels", () => DEMO_PO_LINES.filter((l) => l.purchase_order_id === id), (sb, org) =>
    sb.from("purchase_order_lines").select("*").eq("organization_id", org).eq("purchase_order_id", id).order("sort_order").order("created_at") as unknown as R<PurchaseOrderLine[]>,
  );
  return {
    order: { ...order, supplier: one(order.supplier), project: one(order.project) },
    lines: lines.map((l) => numStr(l, ["quantity", "unit_cost", "line_total", "quantity_received"])),
  };
}

export async function listCostEntries(ctx: AppContext, projectId: string): Promise<CostEntry[]> {
  if (!isUuid(projectId)) return [];
  const rows = await load(ctx, "Kosten", () => DEMO_COST_ENTRIES.filter((c) => c.project_id === projectId).sort((a, b) => b.entry_date.localeCompare(a.entry_date)), (sb, org) =>
    sb.from("project_cost_entries").select("*").eq("organization_id", org).eq("project_id", projectId).order("entry_date", { ascending: false }).order("created_at", { ascending: false }).limit(2000) as unknown as R<CostEntry[]>,
  );
  return rows.map((r) => numStr(r, ["quantity", "unit_cost", "amount"]));
}
