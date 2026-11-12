import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { Badge, ProjectStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/components/ui/cn";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getProject } from "@/lib/data/projects";
import { getProjectFinancials } from "@/lib/data/finance";
import { CalculationTab } from "./tabs/calculation";
import { PlanningTab } from "./tabs/planning";
import { DocumentsTab, HoursTab, InvoicesTab, MaterialsTab, PostCalcTab, PurchasingTab, QuotesTab, WorkOrdersTab } from "./tabs/other";
import { formatMoney, formatPercent, toDecimal } from "@/lib/finance/money";
import { marginPercent } from "@/lib/finance/postcalc";
import { formatDate } from "@/lib/format";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, type Project, type ProjectFinancials } from "@/lib/types";
import { setProjectArchived, setProjectStatus } from "../actions";

export const metadata: Metadata = { title: "Project" };

const TABS = [
  { key: "overzicht", label: "Overzicht" },
  { key: "planning", label: "Planning" },
  { key: "calculatie", label: "Calculatie" },
  { key: "materialen", label: "Materialen" },
  { key: "uren", label: "Uren" },
  { key: "werkbonnen", label: "Werkbonnen" },
  { key: "inkoop", label: "Inkoop" },
  { key: "offertes", label: "Offertes" },
  { key: "facturen", label: "Facturen" },
  { key: "na-calculatie", label: "Na-calculatie" },
  { key: "documenten", label: "Documenten" },
] as const;
type TabKey = (typeof TABS)[number]["key"];


export default async function ProjectDetailPage({ params, searchParams }: PageProps<"/projecten/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const ctx = await getAppContext();
  const project = await getProject(ctx, id);
  if (!project) notFound();
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : "overzicht";
  const canWrite = can(ctx.membership.role, "projects.write");
  const financials = tab === "overzicht" ? await getProjectFinancials(ctx, project.id) : null;

  return (
    <>
      <PageHeader
        title={project.name}
        breadcrumbs={[{ label: "Projecten", href: "/projecten" }, { label: project.project_number }]}
        meta={
          <>
            <span className="font-mono text-sm text-slate-500">{project.project_number}</span>
            <ProjectStatusBadge status={project.status} />
            {project.is_archived && <Badge tone="amber">Gearchiveerd</Badge>}
          </>
        }
        actions={
          canWrite && (
            <>
              <LinkButton href={`/projecten/${project.id}/bewerken`} variant="secondary">
                <Pencil className="size-4" aria-hidden /> Wijzigen
              </LinkButton>
              <ConfirmAction
                action={setProjectArchived}
                fields={{ id: project.id, archive: project.is_archived ? "false" : "true" }}
                trigger={project.is_archived ? <><ArchiveRestore className="size-4" aria-hidden /> Herstellen</> : <><Archive className="size-4" aria-hidden /> Archiveren</>}
                title={project.is_archived ? "Project herstellen?" : "Project archiveren?"}
                description={project.is_archived ? "Het project wordt weer zichtbaar in de projectenlijst." : "Het project wordt niet verwijderd; alle gegevens blijven bewaard en het project kan later worden hersteld."}
                confirmLabel={project.is_archived ? "Herstellen" : "Archiveren"}
                confirmVariant={project.is_archived ? "primary" : "danger"}
              />
            </>
          )
        }
      />

      <nav aria-label="Projectonderdelen" className="-mx-4 mb-6 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link
                href={t.key === "overzicht" ? `/projecten/${project.id}` : `/projecten/${project.id}?tab=${t.key}`}
                aria-current={tab === t.key ? "page" : undefined}
                className={cn(
                  "-mb-px inline-block border-b-2 px-3 py-2.5 text-sm font-medium",
                  tab === t.key ? "border-accent-500 text-navy-900" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700",
                )}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "overzicht" && <Overview project={project} canWrite={canWrite} currency={ctx.settings.currency_code} locale={ctx.settings.locale} financials={financials} />}
      {tab === "planning" && <ModuleGate ctx={ctx} module="planning"><PlanningTab ctx={ctx} project={project} /></ModuleGate>}
      {tab === "calculatie" && <ModuleGate ctx={ctx} module="calculatie"><CalculationTab ctx={ctx} project={project} /></ModuleGate>}
      {tab === "materialen" && <ModuleGate ctx={ctx} module="materialen"><MaterialsTab ctx={ctx} project={project} /></ModuleGate>}
      {tab === "uren" && <ModuleGate ctx={ctx} module="uren"><HoursTab ctx={ctx} project={project} /></ModuleGate>}
      {tab === "werkbonnen" && <ModuleGate ctx={ctx} module="werkbonnen"><WorkOrdersTab ctx={ctx} project={project} /></ModuleGate>}
      {tab === "inkoop" && <ModuleGate ctx={ctx} module="inkoop"><PurchasingTab ctx={ctx} project={project} /></ModuleGate>}
      {tab === "offertes" && <ModuleGate ctx={ctx} module="offertes"><QuotesTab ctx={ctx} project={project} /></ModuleGate>}
      {tab === "facturen" && <ModuleGate ctx={ctx} module="facturatie"><InvoicesTab ctx={ctx} project={project} /></ModuleGate>}
      {tab === "na-calculatie" && <ModuleGate ctx={ctx} module="nacalculatie"><PostCalcTab ctx={ctx} project={project} /></ModuleGate>}
      {tab === "documenten" && <ModuleGate ctx={ctx} module="documenten"><DocumentsTab ctx={ctx} project={project} /></ModuleGate>}
    </>
  );
}

function Overview({ project, canWrite, currency, locale, financials }: { project: Project; canWrite: boolean; currency: string; locale: string; financials: ProjectFinancials | null }) {
  const cur = project.currency_code || currency;
  const budget = toDecimal(project.budget_amount);
  const revenue = toDecimal(project.contract_value);
  const profit = revenue.minus(budget);
  const margin = marginPercent(profit, revenue);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader title="Projectgegevens" />
          <CardBody>
            <DescriptionList
              items={[
                {
                  label: "Klant",
                  value: project.customer ? (
                    <Link href={`/klanten/${project.customer.id}`} className="text-brand-700 hover:underline">
                      {project.customer.name}
                    </Link>
                  ) : null,
                },
                { label: "Projectleider", value: project.project_manager_name },
                { label: "Projectlocatie", value: [project.location_address, project.location_city].filter(Boolean).join(", ") || null },
                { label: "Valuta", value: cur },
                { label: "Startdatum", value: formatDate(project.start_date, locale) },
                { label: "Verwachte einddatum", value: formatDate(project.expected_end_date, locale) },
              ]}
            />
            {project.description && (
              <div className="mt-6 rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Omschrijving</p>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{project.description}</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Financieel overzicht" description="Begroot budget en verkoopwaarde van het project." />
          <CardBody className="space-y-3 text-sm">
            <Row label="Begroot budget" value={formatMoney(budget, cur, locale)} />
            <Row label="Verkoopwaarde" value={formatMoney(revenue, cur, locale)} />
            <div className="border-t border-slate-100 pt-3">
              <Row
                label="Verwachte winst"
                value={<span className={profit.isNegative() ? "text-red-600" : "text-emerald-700"}>{formatMoney(profit, cur, locale)}</span>}
                strong
              />
              <Row label="Verwachte marge" value={margin ? formatPercent(margin, locale) : "n.v.t."} />
            </div>
            {financials && (
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <Row label="Werkelijke kosten" value={formatMoney(financials.actual_cost_total, cur, locale)} />
                <Row label="Gefactureerd (excl.)" value={formatMoney(financials.invoiced_excl_tax, cur, locale)} />
                <Row label="Ontvangen" value={formatMoney(financials.received_incl_tax, cur, locale)} />
                <Link href={`/projecten/${project.id}?tab=na-calculatie`} className="inline-block text-sm font-medium text-brand-700 hover:underline">Volledige na-calculatie →</Link>
              </div>
            )}
          </CardBody>
        </Card>

        {canWrite && (
          <Card>
            <CardHeader title="Status wijzigen" />
            <CardBody>
              <form action={setProjectStatus} className="flex gap-2">
                <input type="hidden" name="id" value={project.id} />
                <label htmlFor="status" className="sr-only">Nieuwe status</label>
                <select id="status" name="status" defaultValue={project.status} className="h-10 flex-1 rounded-lg border-0 bg-white px-3 text-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-500">
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {PROJECT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <SubmitButton variant="secondary" pendingText="…">Opslaan</SubmitButton>
              </form>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={cn("tabular-nums", strong ? "text-base font-semibold" : "font-medium text-slate-900")}>{value}</span>
    </div>
  );
}
