import "server-only";
import type { AppContext } from "@/lib/auth/context";
import { DEMO_TAX_RATES } from "@/lib/demo/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TaxRate } from "@/lib/types";

export async function listTaxRates(ctx: AppContext): Promise<TaxRate[]> {
  if (ctx.mode === "demo") return DEMO_TAX_RATES;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tax_rates")
    .select("id, name, rate_percent, description, is_default, is_archived")
    .eq("organization_id", ctx.membership.organization.id)
    .order("is_archived")
    .order("rate_percent");
  if (error) throw new Error(`Belastingtarieven konden niet worden geladen: ${error.message}`);
  return (data ?? []).map((r) => ({ ...r, rate_percent: String(r.rate_percent) })) as TaxRate[];
}
