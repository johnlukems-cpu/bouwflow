import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { setSubscription } from "./actions";

export const metadata: Metadata = { title: "Platformbeheer" };

interface OrgRow { organization_id: string; name: string; created_at: string; member_count: number; plan_code: string; status: string; trial_ends_at: string | null; max_users: number | null }

export default async function PlatformPage() {
  const ctx = await getAppContext();
  if (!ctx.isPlatformAdmin || ctx.mode !== "supabase") notFound();
  const supabase = await createSupabaseServerClient();
  const [{ data: orgs }, { data: plans }] = await Promise.all([
    supabase.rpc("platform_list_organizations"),
    supabase.from("subscription_plans").select("code, name").order("sort_order"),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Platformbeheer" description="Organisaties en abonnementen. Platformbeheerders zien geen bedrijfsgegevens van klanten." />
      <FormAlert tone="info" message="Er is nog geen betaalprovider gekoppeld; statussen en proefperiodes beheert u hier handmatig." />
      <Card>
        <CardHeader title={`Organisaties (${(orgs as OrgRow[] | null)?.length ?? 0})`} />
        <ul className="divide-y divide-slate-100">
          {((orgs as OrgRow[] | null) ?? []).map((o) => (
            <li key={o.organization_id} className="px-5 py-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-slate-900">{o.name}</p>
                <p className="text-xs text-slate-600">Sinds {formatDate(o.created_at)} · {o.member_count} gebruiker(s)</p>
              </div>
              <form action={setSubscription} className="flex flex-wrap items-end gap-2 text-sm">
                <input type="hidden" name="organization_id" value={o.organization_id} />
                <label>Abonnement<select name="plan_code" defaultValue={o.plan_code} className="mt-1 block h-9 rounded-lg border-0 px-2 ring-1 ring-inset ring-slate-300">{(plans ?? []).map((p) => <option key={p.code as string} value={p.code as string}>{p.name as string}</option>)}</select></label>
                <label>Status<select name="status" defaultValue={o.status} className="mt-1 block h-9 rounded-lg border-0 px-2 ring-1 ring-inset ring-slate-300">{["trialing", "active", "past_due", "suspended", "cancelled"].map((s) => <option key={s}>{s}</option>)}</select></label>
                <label>Proef tot<input type="date" name="trial_ends_at" defaultValue={o.trial_ends_at?.slice(0, 10) ?? ""} className="mt-1 block h-9 rounded-lg border-0 px-2 ring-1 ring-inset ring-slate-300" /></label>
                <label>Max. gebruikers<input name="max_users" inputMode="numeric" defaultValue={o.max_users ?? ""} className="mt-1 block h-9 w-24 rounded-lg border-0 px-2 ring-1 ring-inset ring-slate-300" /></label>
                <Button type="submit" size="sm" variant="secondary">Opslaan</Button>
              </form>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
