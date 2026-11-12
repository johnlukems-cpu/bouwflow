import "server-only";
import type { AppContext } from "@/lib/auth/context";
import { DEMO_EMPLOYEES, DEMO_MATERIALS, DEMO_STOCK, DEMO_STOCK_MOVEMENTS, DEMO_SUPPLIERS } from "@/lib/demo/business";
import type { Employee, Material, StockLevel, StockMovement, Supplier } from "@/lib/types";
import { load, numStr, one } from "./query";
import { isUuid, matchesSearch, sanitizeSearch } from "./shared";

export async function listSuppliers(ctx: AppContext, opts: { q?: string; archived?: boolean } = {}): Promise<Supplier[]> {
  const q = sanitizeSearch(opts.q);
  return load(
    ctx,
    "Leveranciers",
    () => DEMO_SUPPLIERS.filter((s) => s.is_archived === !!opts.archived && matchesSearch([s.name, s.supplier_number, s.contact_person, s.city], q)),
    (sb, org) => {
      let query = sb.from("suppliers").select("*").eq("organization_id", org).eq("is_archived", !!opts.archived).order("name").limit(1000);
      if (q) query = query.or(`name.ilike.%${q}%,supplier_number.ilike.%${q}%,contact_person.ilike.%${q}%,city.ilike.%${q}%`);
      return query as unknown as PromiseLike<{ data: Supplier[] | null; error: { message: string } | null }>;
    },
  );
}

export async function getSupplier(ctx: AppContext, id: string): Promise<Supplier | null> {
  if (!isUuid(id) && ctx.mode !== "demo") return null;
  return load(ctx, "Leverancier", () => DEMO_SUPPLIERS.find((s) => s.id === id) ?? null, (sb, org) =>
    sb.from("suppliers").select("*").eq("organization_id", org).eq("id", id).maybeSingle() as unknown as PromiseLike<{ data: Supplier | null; error: { message: string } | null }>,
  );
}

const EMP_NUM = ["hourly_cost", "hourly_rate"] as const;
export async function listEmployees(ctx: AppContext, opts: { includeInactive?: boolean } = {}): Promise<Employee[]> {
  const rows = await load(
    ctx,
    "Medewerkers",
    () => DEMO_EMPLOYEES.filter((e) => opts.includeInactive || e.is_active),
    (sb, org) => {
      let q = sb.from("employees").select("*").eq("organization_id", org).order("full_name");
      if (!opts.includeInactive) q = q.eq("is_active", true);
      return q as unknown as PromiseLike<{ data: Employee[] | null; error: { message: string } | null }>;
    },
  );
  return rows.map((r) => numStr(r, [...EMP_NUM]));
}

export async function getEmployee(ctx: AppContext, id: string): Promise<Employee | null> {
  if (!isUuid(id)) return null;
  const row = await load(ctx, "Medewerker", () => DEMO_EMPLOYEES.find((e) => e.id === id) ?? null, (sb, org) =>
    sb.from("employees").select("*").eq("organization_id", org).eq("id", id).maybeSingle() as unknown as PromiseLike<{ data: Employee | null; error: { message: string } | null }>,
  );
  return row ? numStr(row, [...EMP_NUM]) : null;
}

const MAT_NUM = ["cost_price", "sale_price", "waste_percent", "min_stock"] as const;
export async function listMaterials(ctx: AppContext, opts: { q?: string; category?: string; archived?: boolean } = {}): Promise<Material[]> {
  const q = sanitizeSearch(opts.q);
  const rows = await load(
    ctx,
    "Materialen",
    () =>
      DEMO_MATERIALS.filter(
        (m) => m.is_archived === !!opts.archived && (!opts.category || m.category === opts.category) && matchesSearch([m.article_number, m.description, m.category], q),
      ),
    (sb, org) => {
      let query = sb.from("materials").select("*").eq("organization_id", org).eq("is_archived", !!opts.archived).order("category").order("description").limit(2000);
      if (opts.category) query = query.eq("category", opts.category);
      if (q) query = query.or(`article_number.ilike.%${q}%,description.ilike.%${q}%`);
      return query as unknown as PromiseLike<{ data: Material[] | null; error: { message: string } | null }>;
    },
  );
  return rows.map((r) => numStr(r, [...MAT_NUM]));
}

export async function getMaterial(ctx: AppContext, id: string): Promise<Material | null> {
  if (!isUuid(id)) return null;
  const row = await load(ctx, "Materiaal", () => DEMO_MATERIALS.find((m) => m.id === id) ?? null, (sb, org) =>
    sb.from("materials").select("*").eq("organization_id", org).eq("id", id).maybeSingle() as unknown as PromiseLike<{ data: Material | null; error: { message: string } | null }>,
  );
  return row ? numStr(row, [...MAT_NUM]) : null;
}

export async function getPriceHistory(ctx: AppContext, materialId: string) {
  if (!isUuid(materialId)) return [];
  type Row = { cost_price: string; sale_price: string; valid_from: string };
  const rows = await load<Row[]>(
    ctx,
    "Prijshistorie",
    () => {
      const m = DEMO_MATERIALS.find((x) => x.id === materialId);
      return m ? [{ cost_price: m.cost_price, sale_price: m.sale_price, valid_from: "2026-01-05T10:00:00Z" }] : [];
    },
    (sb, org) =>
      sb.from("material_price_history").select("cost_price, sale_price, valid_from").eq("organization_id", org).eq("material_id", materialId).order("valid_from", { ascending: false }).limit(50) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
  );
  return rows.map((r) => numStr(r, ["cost_price", "sale_price"]));
}

export async function listStock(ctx: AppContext): Promise<StockLevel[]> {
  const rows = await load(ctx, "Voorraad", () => DEMO_STOCK, (sb, org) =>
    sb.from("material_stock").select("*").eq("organization_id", org).eq("track_stock", true).order("description") as unknown as PromiseLike<{ data: StockLevel[] | null; error: { message: string } | null }>,
  );
  return rows.map((r) => numStr(r, ["on_hand", "min_stock", "cost_price"]));
}

export async function listStockMovements(ctx: AppContext, opts: { materialId?: string; projectId?: string; limit?: number } = {}): Promise<StockMovement[]> {
  const rows = await load(
    ctx,
    "Voorraadmutaties",
    () =>
      DEMO_STOCK_MOVEMENTS.filter((m) => (!opts.materialId || m.material_id === opts.materialId) && (!opts.projectId || m.project_id === opts.projectId)).sort((a, b) =>
        b.occurred_on.localeCompare(a.occurred_on),
      ),
    (sb, org) => {
      let q = sb
        .from("stock_movements")
        .select("*, material:materials(article_number, description, unit), project:projects(project_number, name)")
        .eq("organization_id", org)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(opts.limit ?? 200);
      if (opts.materialId && isUuid(opts.materialId)) q = q.eq("material_id", opts.materialId);
      if (opts.projectId && isUuid(opts.projectId)) q = q.eq("project_id", opts.projectId);
      return q as unknown as PromiseLike<{ data: StockMovement[] | null; error: { message: string } | null }>;
    },
  );
  return rows.map((r) => ({ ...numStr(r, ["quantity", "unit_cost"]), material: one(r.material), project: one(r.project) }));
}
