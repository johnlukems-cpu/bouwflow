import "server-only";
import type { AppContext } from "@/lib/auth/context";
import { isRole } from "@/lib/auth/permissions";
import { DEMO_MEMBERS, DEMO_PROJECTS } from "@/lib/demo/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROJECT_STATUSES, type MemberOption, type Project, type ProjectStatus } from "@/lib/types";
import { compareValues, isUuid, matchesSearch, pickDir, pickSort, sanitizeSearch, type SortDir } from "./shared";

export const PROJECT_SORTS = ["project_number", "name", "status", "start_date", "expected_end_date", "budget_amount", "contract_value"] as const;
export type ProjectSort = (typeof PROJECT_SORTS)[number];

export interface ProjectFilters {
  q: string;
  status: ProjectStatus | "all" | "open";
  customerId: string | null;
  archive: "active" | "archived" | "all";
  sort: ProjectSort;
  dir: SortDir;
}

const OPEN_STATUSES: ProjectStatus[] = ["concept", "planned", "in_progress", "paused"];

export function parseProjectFilters(sp: Record<string, string | string[] | undefined>): ProjectFilters {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const status = get("status");
  const customer = get("klant");
  const archive = get("archief");
  return {
    q: sanitizeSearch(get("q")),
    status: status === "open" || (PROJECT_STATUSES as string[]).includes(status ?? "") ? (status as ProjectStatus | "open") : "all",
    customerId: customer && isUuid(customer) ? customer : null,
    archive: archive === "archived" || archive === "all" ? archive : "active",
    sort: pickSort(get("sort"), PROJECT_SORTS, "project_number"),
    dir: pickDir(get("dir"), "desc"),
  };
}

const COLUMNS =
  "id, project_number, name, customer_id, location_address, location_city, description, start_date, expected_end_date, project_manager_member_id, status, budget_amount, contract_value, currency_code, is_archived, created_at, updated_at, customer:customers(id, name, customer_number)";

type Row = Omit<Project, "customer" | "budget_amount" | "contract_value"> & {
  budget_amount: string | number;
  contract_value: string | number;
  customer: Project["customer"] | Project["customer"][];
};

function normalize(row: Row, members: MemberOption[]): Project {
  const customer = Array.isArray(row.customer) ? row.customer[0] ?? null : row.customer;
  return {
    ...row,
    customer,
    budget_amount: String(row.budget_amount),
    contract_value: String(row.contract_value),
    project_manager_name: members.find((m) => m.id === row.project_manager_member_id)?.name ?? null,
  };
}

export async function listMembers(ctx: AppContext): Promise<MemberOption[]> {
  if (ctx.mode === "demo") return DEMO_MEMBERS;
  const supabase = await createSupabaseServerClient();
  const { data: members, error } = await supabase
    .from("organization_members")
    .select("id, user_id, role")
    .eq("organization_id", ctx.membership.organization.id)
    .eq("is_active", true);
  if (error) throw new Error(`Medewerkers konden niet worden geladen: ${error.message}`);
  const ids = (members ?? []).map((m) => m.user_id as string);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] };
  return (members ?? [])
    .filter((m) => isRole(m.role))
    .map((m) => {
      const prof = (profiles ?? []).find((pr) => pr.id === m.user_id);
      return { id: m.id as string, role: m.role, name: prof?.full_name || prof?.email || "Onbekende gebruiker" } as MemberOption;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "nl"));
}

export async function listProjects(ctx: AppContext, f: ProjectFilters): Promise<Project[]> {
  if (ctx.mode === "demo") {
    return DEMO_PROJECTS.filter(
      (p) =>
        (f.status === "all" || (f.status === "open" ? OPEN_STATUSES.includes(p.status) : p.status === f.status)) &&
        (!f.customerId || p.customer_id === f.customerId) &&
        (f.archive === "all" || p.is_archived === (f.archive === "archived")) &&
        matchesSearch([p.name, p.project_number, p.customer?.name, p.location_address, p.location_city], f.q),
    ).sort((a, b) => {
      const numeric = f.sort === "budget_amount" || f.sort === "contract_value";
      return compareValues(numeric ? Number(a[f.sort]) : a[f.sort], numeric ? Number(b[f.sort]) : b[f.sort], f.dir);
    });
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("projects")
    .select(COLUMNS)
    .eq("organization_id", ctx.membership.organization.id)
    .order(f.sort, { ascending: f.dir === "asc", nullsFirst: false })
    .limit(500);
  if (f.status === "open") query = query.in("status", OPEN_STATUSES);
  else if (f.status !== "all") query = query.eq("status", f.status);
  if (f.customerId) query = query.eq("customer_id", f.customerId);
  if (f.archive !== "all") query = query.eq("is_archived", f.archive === "archived");
  if (f.q) {
    const t = `%${f.q}%`;
    query = query.or(`name.ilike.${t},project_number.ilike.${t},location_address.ilike.${t},location_city.ilike.${t}`);
  }
  const [{ data, error }, members] = await Promise.all([query, listMembers(ctx)]);
  if (error) throw new Error(`Projecten konden niet worden geladen: ${error.message}`);
  return ((data ?? []) as unknown as Row[]).map((r) => normalize(r, members));
}

export async function getProject(ctx: AppContext, id: string): Promise<Project | null> {
  if (ctx.mode === "demo") return DEMO_PROJECTS.find((p) => p.id === id) ?? null;
  if (!isUuid(id)) return null;
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, members] = await Promise.all([
    supabase.from("projects").select(COLUMNS).eq("organization_id", ctx.membership.organization.id).eq("id", id).maybeSingle(),
    listMembers(ctx),
  ]);
  if (error) throw new Error(`Project kon niet worden geladen: ${error.message}`);
  return data ? normalize(data as unknown as Row, members) : null;
}
