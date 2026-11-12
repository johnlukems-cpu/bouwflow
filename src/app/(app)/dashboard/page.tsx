import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  FileCheck2,
  FolderKanban,
  HardHat,
  Plus,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { postCalcFromFinancials } from "@/components/finance/post-calc";
import { DemoBadge, ProjectStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { TaskBadge } from "@/components/ui/status";
import { getAppContext, hasModule } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getDashboardData } from "@/lib/data/dashboard";
import { listTasks, listTimeEntries, listWorkOrders } from "@/lib/data/execution";
import { listInvoices, listProjectFinancials, listQuotes } from "@/lib/data/finance";
import { listProjects, parseProjectFilters } from "@/lib/data/projects";
import { listStock } from "@/lib/data/resources";
import { formatMoney, sum, toDecimal } from "@/lib/finance/money";
import { formatDate, formatDateTime, todayISO } from "@/lib/format";
import { PROJECT_STATUSES } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await getAppContext();
  const { currency_code: cur, locale, timezone, revenue_basis: basis, budget_warning_percent: warn } = ctx.settings;
  const today = todayISO(timezone);
  const m = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, cur, locale);
  const none = async <T,>() => [] as T[];

  const [data, quotes, invoices, fins, projects, tasks, stock, woSubmitted, teSubmitted] = await Promise.all([
    getDashboardData(ctx),
    hasModule(ctx, "offertes") ? listQuotes(ctx, { status: "sent" }) : none<Awaited<ReturnType<typeof listQuotes>>[number]>(),
    hasModule(ctx, "facturatie") ? listInvoices(ctx, { status: "final" }) : none<Awaited<ReturnType<typeof listInvoices>>[number]>(),
    listProjectFinancials(ctx),
    listProjects(ctx, { ...parseProjectFilters({}), status: "open" }),
    hasModule(ctx, "planning") ? listTasks(ctx, { from: today, to: today, employeeId: ctx.membership.role === "employee" ? (ctx.employeeId ?? undefined) : undefined }) : none<Awaited<ReturnType<typeof listTasks>>[number]>(),
    hasModule(ctx, "voorraad") ? listStock(ctx) : none<Awaited<ReturnType<typeof listStock>>[number]>(),
    hasModule(ctx, "werkbonnen") && can(ctx.membership.role, "time.approve") ? listWorkOrders(ctx, { status: "submitted" }) : none<Awaited<ReturnType<typeof listWorkOrders>>[number]>(),
    hasModule(ctx, "uren") && can(ctx.membership.role, "time.approve") ? listTimeEntries(ctx, { status: "submitted" }) : none<Awaited<ReturnType<typeof listTimeEntries>>[number]>(),
  ]);

  const openQuotes = quotes.filter((q) => !q.valid_until || q.valid_until >= today);
  const expiredQuotes = quotes.filter((q) => q.valid_until && q.valid_until < today);
  const openInvoices = invoices.filter((i) => i.invoice_type !== "credit" && toDecimal(i.outstanding ?? 0).greaterThan(0));
  const overdue = openInvoices.filter((i) => i.payment_status === "overdue");
  const lowStock = stock.filter((s) => s.min_stock !== null && toDecimal(s.on_hand).lessThan(s.min_stock));
  const openIds = new Set(projects.map((p) => p.id));
  const openFins = fins.filter((f) => openIds.has(f.project_id));
  const actualCosts = sum(openFins.map((f) => f.actual_cost_total));
  const budgetIssues = projects
    .map((p) => {
      const f = fins.find((x) => x.project_id === p.id);
      return f ? { p, r: postCalcFromFinancials(f, basis, warn).result } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.r.budgetStatus !== "ok" && !x.r.totalCost.actual.isZero());

  const alerts: { tone: "red" | "amber"; text: string; href: string }[] = [
    ...budgetIssues.map(({ p, r }) => ({ tone: (r.budgetStatus === "exceeded" ? "red" : "amber") as "red" | "amber", text: `${p.project_number} ${p.name}: budget ${r.budgetStatus === "exceeded" ? "overschreden" : "bijna bereikt"}`, href: `/projecten/${p.id}?tab=na-calculatie` })),
    ...(overdue.length ? [{ tone: "red" as const, text: `${overdue.length} vervallen factu(u)r(en), samen ${m(sum(overdue.map((i) => i.outstanding ?? 0)))}`, href: "/facturatie?betaalstatus=overdue" }] : []),
    ...(expiredQuotes.length ? [{ tone: "amber" as const, text: `${expiredQuotes.length} verzonden offerte(s) verlopen zonder reactie`, href: "/offertes?status=sent" }] : []),
    ...(lowStock.length ? [{ tone: "amber" as const, text: `${lowStock.length} artikel(en) onder minimale voorraad`, href: "/voorraad" }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Overzicht van ${ctx.membership.organization.name}`}
        meta={ctx.mode === "demo" ? <DemoBadge /> : undefined}
        actions={
          can(ctx.membership.role, "projects.write") && (
            <LinkButton href="/projecten/nieuw">
              <Plus className="size-4" aria-hidden /> Nieuw project
            </LinkButton>
          )
        }
      />

      <section aria-label="Kerncijfers" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Actieve projecten" value={data.activeProjects} icon={HardHat} hint={`${data.counts.planned} gepland · ${data.counts.paused} gepauzeerd`} />
        <KpiCard label="Afgeronde projecten" value={data.counts.completed} icon={CheckCircle2} tone="green" />
        <KpiCard label="Openstaande offertes" value={hasModule(ctx, "offertes") ? openQuotes.length : "—"} icon={FileCheck2} hint={hasModule(ctx, "offertes") ? `Waarde ${m(sum(openQuotes.map((q) => q.subtotal)))} excl.` : "Niet in abonnement"} unavailable={!hasModule(ctx, "offertes")} />
        <KpiCard label="Openstaande facturen" value={hasModule(ctx, "facturatie") ? m(sum(openInvoices.map((i) => i.outstanding ?? 0))) : "—"} icon={Receipt} tone={overdue.length ? "red" : "navy"} hint={hasModule(ctx, "facturatie") ? `${openInvoices.length} factu(u)r(en), ${overdue.length} vervallen` : "Niet in abonnement"} unavailable={!hasModule(ctx, "facturatie")} />
        <KpiCard label="Begrote projectkosten" value={m(data.openBudget)} icon={CircleDollarSign} hint="Lopende projecten" />
        <KpiCard label="Werkelijke projectkosten" value={m(actualCosts)} icon={Wallet} hint="Lopende projecten, uit het kostenregister" />
        <KpiCard label="Verwachte projectwinst" value={m(data.expectedProfit)} icon={TrendingUp} tone={data.expectedProfit.isNegative() ? "red" : "orange"} hint={`Verkoopwaarde ${m(data.openContractValue)} − begroting`} />
        <KpiCard label="Budgetoverschrijdingen" value={budgetIssues.filter((b) => b.r.budgetStatus === "exceeded").length} icon={AlertTriangle} tone={budgetIssues.length ? "red" : "green"} hint={`${budgetIssues.filter((b) => b.r.budgetStatus === "warning").length} project(en) naderen het budget`} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Waarschuwingen en meldingen" />
            {alerts.length === 0 ? (
              <CardBody className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="size-5" aria-hidden /> Geen waarschuwingen.</CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {alerts.map((a) => (
                  <li key={a.text}>
                    <Link href={a.href} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                      <AlertTriangle className={a.tone === "red" ? "size-5 shrink-0 text-red-600" : "size-5 shrink-0 text-amber-600"} aria-hidden />
                      <span className="flex-1">{a.text}</span>
                      <span className="text-brand-700">Bekijk →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Openstaande taken" description="Taken voor vandaag en wachtend op goedkeuring" />
            {tasks.length === 0 && woSubmitted.length === 0 && teSubmitted.length === 0 ? (
              <CardBody className="text-sm text-slate-600">Geen openstaande taken.</CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {woSubmitted.length > 0 && (
                  <li><Link href="/werkbonnen?status=submitted" className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50"><ClipboardCheck className="size-5 text-accent-700" aria-hidden /><span className="flex-1">{woSubmitted.length} werkbon(nen) wachten op goedkeuring</span></Link></li>
                )}
                {teSubmitted.length > 0 && (
                  <li><Link href="/uren?status=submitted" className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50"><ClipboardCheck className="size-5 text-accent-700" aria-hidden /><span className="flex-1">{teSubmitted.length} urenregistratie(s) wachten op goedkeuring</span></Link></li>
                )}
                {tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").map((t) => (
                  <li key={t.id}>
                    <Link href={`/projecten/${t.project_id}?tab=planning`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{t.title}</span><span className="block truncate text-xs text-slate-600">{t.project?.project_number} · {t.employee?.full_name ?? "Niet toegewezen"} · t/m {formatDate(t.end_date)}</span></span>
                      <TaskBadge status={t.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Projecten per status" actions={<Link href="/projecten" className="text-sm font-medium text-brand-700 hover:underline">Alle projecten →</Link>} />
            <CardBody>
              {PROJECT_STATUSES.every((s) => data.counts[s] === 0) ? (
                <EmptyState icon={FolderKanban} title="Nog geen projecten" description="Maak uw eerste project aan." action={can(ctx.membership.role, "projects.write") && <LinkButton href="/projecten/nieuw">Project aanmaken</LinkButton>} />
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
            </CardBody>
          </Card>
        </div>

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
                    <p className="mt-0.5 text-xs text-slate-600">{formatDateTime(a.created_at, locale, timezone)}</p>
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

const STATUS_WORDS: Record<string, string> = { concept: "Concept", planned: "Gepland", in_progress: "In uitvoering", paused: "Gepauzeerd", completed: "Afgerond", cancelled: "Geannuleerd" };

function humanizeActivity(summary: string) {
  return summary.replace(/status gewijzigd naar (\w+)$/, (_, s: string) => `status gewijzigd naar ${STATUS_WORDS[s] ?? s}`);
}
