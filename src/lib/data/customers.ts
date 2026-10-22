import "server-only";
import type { AppContext } from "@/lib/auth/context";
import { DEMO_CUSTOMERS } from "@/lib/demo/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Customer, CustomerType } from "@/lib/types";
import { compareValues, isUuid, matchesSearch, pickDir, pickSort, sanitizeSearch, type SortDir } from "./shared";

export const CUSTOMER_SORTS = ["customer_number", "name", "city", "created_at"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export interface CustomerFilters {
  q: string;
  type: CustomerType | "all";
  archive: "active" | "archived" | "all";
  sort: CustomerSort;
  dir: SortDir;
}

export function parseCustomerFilters(sp: Record<string, string | string[] | undefined>): CustomerFilters {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const type = get("type");
  const archive = get("archief");
  return {
    q: sanitizeSearch(get("q")),
    type: type === "private" || type === "business" ? type : "all",
    archive: archive === "archived" || archive === "all" ? archive : "active",
    sort: pickSort(get("sort"), CUSTOMER_SORTS, "name"),
    dir: pickDir(get("dir")),
  };
}

const COLUMNS =
  "id, customer_number, customer_type, name, contact_person, email, phone, address_line, postal_code, city, country_code, vat_number, notes, is_archived, created_at, updated_at";

export async function listCustomers(ctx: AppContext, f: CustomerFilters): Promise<Customer[]> {
  if (ctx.mode === "demo") {
    return DEMO_CUSTOMERS.filter(
      (c) =>
        (f.type === "all" || c.customer_type === f.type) &&
        (f.archive === "all" || c.is_archived === (f.archive === "archived")) &&
        matchesSearch([c.name, c.customer_number, c.contact_person, c.email, c.city, c.phone], f.q),
    ).sort((a, b) => compareValues(a[f.sort], b[f.sort], f.dir));
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("customers")
    .select(COLUMNS)
    .eq("organization_id", ctx.membership.organization.id)
    .order(f.sort, { ascending: f.dir === "asc" })
    .limit(500);
  if (f.type !== "all") query = query.eq("customer_type", f.type);
  if (f.archive !== "all") query = query.eq("is_archived", f.archive === "archived");
  if (f.q) {
    const t = `%${f.q}%`;
    query = query.or(
      `name.ilike.${t},customer_number.ilike.${t},contact_person.ilike.${t},email.ilike.${t},city.ilike.${t},phone.ilike.${t}`,
    );
  }
  const { data, error } = await query;
  if (error) throw new Error(`Klanten konden niet worden geladen: ${error.message}`);
  return (data ?? []) as Customer[];
}

export async function getCustomer(ctx: AppContext, id: string): Promise<Customer | null> {
  if (ctx.mode === "demo") return DEMO_CUSTOMERS.find((c) => c.id === id) ?? null;
  if (!isUuid(id)) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select(COLUMNS)
    .eq("organization_id", ctx.membership.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Klant kon niet worden geladen: ${error.message}`);
  return data as Customer | null;
}

export interface CustomerOption {
  id: string;
  name: string;
  customer_number: string;
}

export async function listCustomerOptions(ctx: AppContext): Promise<CustomerOption[]> {
  if (ctx.mode === "demo") {
    return DEMO_CUSTOMERS.filter((c) => !c.is_archived).map(({ id, name, customer_number }) => ({ id, name, customer_number }));
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, customer_number")
    .eq("organization_id", ctx.membership.organization.id)
    .eq("is_archived", false)
    .order("name")
    .limit(1000);
  if (error) throw new Error(`Klanten konden niet worden geladen: ${error.message}`);
  return (data ?? []) as CustomerOption[];
}
