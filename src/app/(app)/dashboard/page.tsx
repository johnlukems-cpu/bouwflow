import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  FolderKanban,
  HardHat,
  Plus,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DemoBadge, ProjectStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FutureFeature } from "@/components/ui/future-feature";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getDashboardData } from "@/lib/data/dashboard";
import { formatMoney } from "@/lib/finance/money";
import { formatDateTime } from "@/lib/format";
import { PROJECT_STATUSES } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await getAppContext();
  const data = await getDashboardData(ctx);
  const { currency_code: cur, locale } = ctx.settings;
  const money = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, cur, locale);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Overzicht van ${ctx.membership.organization.name}`}
        meta={ctx.mode === "demo" ? <DemoBadge /> : undefined}
        actions={
          can(ctx.membership.role, "projects.write") && (
            <LinkButton href="/projecten/nieuw" variant="accent">
              <Plus className="size-4" aria-hidden /> Nieuw project
            </LinkButton>
          )
        }
      />

      <section aria-label="Kerncijfers" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Actieve projecten" value={data.activeProjects} icon={HardHat} hint={`${data.counts.planned} gepland · ${data.counts.paused} gepauzeerd`} />
        <KpiCard label="Afgeronde projecten" value={data.counts.completed} icon={CheckCircle2} tone="green" />
        <KpiCard label="Begrote projectkosten" value={money(data.openBudget)} icon={CircleDollarSign} hint="Lopende projecten (excl. afgerond/geannuleerd)" />
        <KpiCard
          label="Verwachte projectwinst"
          value={money(data.expectedProfit)}
          icon={TrendingUp}
          tone={data.expectedProfit.isNegative() ? "red" : "orange"}
          hint={`Verkoopwaarde ${money(data.openContractValue)} − begroting`}
        />
        <KpiCard label="Openstaande offertes" value="—" icon={FileCheck2} unavailable hint="Beschikbaar zodra de module Offertes gereed is" />
        <KpiCard label="Openstaande facturen" value="—" icon={Receipt} unavailable hint="Beschikbaar zodra de module Facturatie gereed is" />
        <KpiCard label="Werkelijke projectkosten" value="—" icon={Wallet} unavailable hint="Beschikbaar zodra kostenregistratie gereed is" />
        <KpiCard label="Budgetoverschrijdingen" value="—" icon={AlertTriangle} unavailable hint="Vereist werkelijke kosten (na-calculatie)" />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Projecten per status"
            actions={
              <Link href="/projecten" className="text-sm font-medium text-brand-700 hover:underline">
                Alle projecten →
              </Link>
            }
          />
          <CardBody>
            {PROJECT_STATUSES.every((s) => data.counts[s] === 0) ? (
              <EmptyState
                icon={FolderKanban}
                title="Nog geen projecten"
                description="Maak uw eerste project aan om hier de voortgang te volgen."
                action={can(ctx.membership.role, "projects.write") && <LinkButton href="/projecten/nieuw">Project aanmaken</LinkButton>}
              />
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {PROJECT_STATUSES.map((s) => (
                  <li key={s}>
                    <Link href={`/projecten?status=${s}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 hover:border-brand-200 hover:bg-brand-50/40">
                      <ProjectStatusBadge status={s} />
                      <span className="text-lg font-semibold tabular-nums text-navy-900">{data.counts[s]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5">
              <FutureFeature title="Projecten met budgetoverschrijding" compact>
                Zodra werkelijke kosten worden geregistreerd, toont BouwFlow hier projecten die het budget naderen of overschrijden.
              </FutureFeature>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recente activiteiten" />
          <CardBody className="p-0">
            {data.recentActivity.length === 0 ? (
              <EmptyState icon={ActivityIcon} title="Nog geen activiteiten" description="Wijzigingen aan klanten en projecten verschijnen hier." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.recentActivity.map((a) => (
                  <li key={a.id} className="px-5 py-3">
                    <p className="text-sm text-slate-800">{humanizeActivity(a.summary)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(a.created_at, locale, ctx.settings.timezone)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

const STATUS_WORDS: Record<string, string> = {
  concept: "Concept",
  planned: "Gepland",
  in_progress: "In uitvoering",
  paused: "Gepauzeerd",
  completed: "Afgerond",
  cancelled: "Geannuleerd",
};

function humanizeActivity(summary: string) {
  return summary.replace(/status gewijzigd naar (\w+)$/, (_, s: string) => `status gewijzigd naar ${STATUS_WORDS[s] ?? s}`);
}
