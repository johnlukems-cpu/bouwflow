import type { Metadata } from "next";
import { Check, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { load } from "@/lib/data/query";
import { formatDate } from "@/lib/format";
import { ALWAYS_AVAILABLE_MODULES, MODULE_KEYS, MODULE_LABELS } from "@/lib/modules";

export const metadata: Metadata = { title: "Abonnement" };

const STATUS = { trialing: "Proefperiode", active: "Actief", past_due: "Betaling achterstallig", suspended: "Opgeschort", cancelled: "Beëindigd" } as const;

interface Plan { code: string; name: string; description: string | null; monthly_price: string | null; currency_code: string; max_users: number | null; modules: string[] }

export default async function SubscriptionPage() {
  const ctx = await getAppContext();
  const s = ctx.subscription;
  const plans = await load<Plan[]>(ctx, "Abonnementen", () => [], (sb) =>
    sb.from("subscription_plans").select("code, name, description, monthly_price, currency_code, max_users, modules").eq("is_active", true).order("sort_order") as unknown as PromiseLike<{ data: Plan[] | null; error: { message: string } | null }>,
  );
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Abonnement" breadcrumbs={[{ label: "Instellingen", href: "/instellingen" }, { label: "Abonnement" }]} />
      <FormAlert tone="info" message="Online betalen van het abonnement is nog niet gekoppeld. Wijzigingen in uw abonnement worden door BouwFlow (platformbeheer) verwerkt." />
      <Card>
        <CardHeader title={s.planName} description={s.status === "trialing" && s.trialEndsAt ? `Proefperiode tot ${formatDate(s.trialEndsAt)}` : undefined} />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone={s.writable ? "green" : "red"}>{STATUS[s.status]}</Badge>
            <Badge>{s.maxUsers ? `Max. ${s.maxUsers} gebruikers` : "Onbeperkt aantal gebruikers"}</Badge>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {MODULE_KEYS.map((m) => {
              const on = ALWAYS_AVAILABLE_MODULES.includes(m) || s.modules.includes(m);
              return (
                <li key={m} className="flex items-center gap-2 text-sm">
                  {on ? <Check className="size-4 text-emerald-600" aria-hidden /> : <Lock className="size-4 text-slate-400" aria-hidden />}
                  <span className={on ? "text-slate-800" : "text-slate-400"}>{MODULE_LABELS[m]}</span>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>
      {plans.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.code} className={p.code === s.planCode ? "ring-2 ring-accent-500" : undefined}>
              <CardHeader title={p.name} description={p.description ?? undefined} />
              <CardBody className="space-y-2 text-sm">
                <p className="text-lg font-semibold text-navy-900">{p.monthly_price ? `${p.currency_code} ${Number(p.monthly_price).toLocaleString("nl-NL", { minimumFractionDigits: 2 })} p/m` : "Prijs op aanvraag"}</p>
                <p>{p.max_users ? `Tot ${p.max_users} gebruikers` : "Onbeperkt aantal gebruikers"}</p>
                <p className="text-slate-600">{p.modules.length} modules</p>
                {p.code === s.planCode && <Badge tone="orange">Uw huidige abonnement</Badge>}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
