import "server-only";
import Decimal from "decimal.js";
import type { AppContext } from "@/lib/auth/context";
import { DEMO_ACTIVITY, DEMO_PROJECTS } from "@/lib/demo/data";
import { Money, toDecimal } from "@/lib/finance/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Activity, ProjectStatus } from "@/lib/types";

export interface DashboardData {
  counts: Record<ProjectStatus, number>;
  activeProjects: number;
  /** Som begroot budget van lopende projecten (concept/gepland/in uitvoering/gepauzeerd) */
  openBudget: Decimal;
  /** Som verkoopwaarde van lopende projecten */
  openContractValue: Decimal;
  /** Verwachte winst = verkoopwaarde − begroot budget (lopende projecten) */
  expectedProfit: Decimal;
  recentActivity: Activity[];
  totalCustomers: number;
}

const OPEN: ProjectStatus[] = ["concept", "planned", "in_progress", "paused"];

function aggregate(projects: { status: ProjectStatus; budget_amount: string | number; contract_value: string | number }[]) {
  const counts = { concept: 0, planned: 0, in_progress: 0, paused: 0, completed: 0, cancelled: 0 } as Record<ProjectStatus, number>;
  let openBudget = new Money(0);
  let openContractValue = new Money(0);
  for (const p of projects) {
    counts[p.status] += 1;
    if (OPEN.includes(p.status)) {
      openBudget = openBudget.plus(toDecimal(p.budget_amount));
      openContractValue = openContractValue.plus(toDecimal(p.contract_value));
    }
  }
  return { counts, openBudget, openContractValue, expectedProfit: openContractValue.minus(openBudget) };
}

export async function getDashboardData(ctx: AppContext): Promise<DashboardData> {
  if (ctx.mode === "demo") {
    const agg = aggregate(DEMO_PROJECTS.filter((p) => !p.is_archived));
    return {
      ...agg,
      activeProjects: agg.counts.in_progress,
      recentActivity: [...DEMO_ACTIVITY].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      totalCustomers: 6,
    };
  }

  const supabase = await createSupabaseServerClient();
  const orgId = ctx.membership.organization.id;
  const [projects, activity, customers] = await Promise.all([
    supabase.from("projects").select("status, budget_amount, contract_value").eq("organization_id", orgId).eq("is_archived", false).limit(10000),
    supabase.from("activity_log").select("id, entity_type, entity_id, action, summary, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(10),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_archived", false),
  ]);
  if (projects.error) throw new Error(`Dashboardgegevens konden niet worden geladen: ${projects.error.message}`);
  const agg = aggregate((projects.data ?? []) as { status: ProjectStatus; budget_amount: string; contract_value: string }[]);
  return {
    ...agg,
    activeProjects: agg.counts.in_progress,
    recentActivity: (activity.data ?? []) as Activity[],
    totalCustomers: customers.count ?? 0,
  };
}
