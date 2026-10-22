import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { Badge, ProjectStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { SortTh, Table, Td, Th } from "@/components/ui/table";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listProjects, parseProjectFilters } from "@/lib/data/projects";
import { formatMoney, sum } from "@/lib/finance/money";
import { formatDate } from "@/lib/format";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from "@/lib/types";

export const metadata: Metadata = { title: "Projecten" };

export default async function ProjectsPage({ searchParams }: PageProps<"/projecten">) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const f = parseProjectFilters(sp);
  const projects = await listProjects(ctx, f);
  const canWrite = can(ctx.membership.role, "projects.write");
  const { currency_code: cur, locale } = ctx.settings;
  const params = {
    q: f.q || undefined,
    status: f.status !== "all" ? f.status : undefined,
    klant: f.customerId ?? undefined,
    archief: f.archive !== "active" ? f.archive : undefined,
  };
  const filtered = Boolean(params.q || params.status || params.klant || params.archief);
  const totalContract = sum(projects.map((p) => p.contract_value));
  const totalBudget = sum(projects.map((p) => p.budget_amount));
  const sortProps = { current: f.sort, dir: f.dir, params, basePath: "/projecten" };

  return (
    <>
      <PageHeader
        title="Projecten"
        description="Alle bouw- en installatieprojecten van uw organisatie."
        actions={
          canWrite && (
            <LinkButton href="/projecten/nieuw" variant="accent">
              <Plus className="size-4" aria-hidden /> Nieuw project
            </LinkButton>
          )
        }
      />
      <Card>
        <FilterBar placeholder="Zoek op projectnaam, projectnummer of locatie">
          <FilterSelect
            name="status"
            label="Status"
            value={f.status}
            options={[
              { value: "all", label: "Alle statussen" },
              { value: "open", label: "Lopend (niet afgerond)" },
              ...PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] })),
            ]}
          />
          <FilterSelect
            name="archief"
            label="Archief"
            value={f.archive}
            options={[
              { value: "active", label: "Niet gearchiveerd" },
              { value: "archived", label: "Gearchiveerd" },
              { value: "all", label: "Alles" },
            ]}
          />
        </FilterBar>
        {f.customerId && (
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2 text-sm text-slate-600">
            Gefilterd op klant.
            <Link href="/projecten" className="font-medium text-brand-600 hover:underline">Filter verwijderen</Link>
          </div>
        )}

        {projects.length === 0 ? (
          filtered ? (
            <EmptyState icon={FolderKanban} title="Geen projecten gevonden" description="Pas uw zoekopdracht of filters aan." action={<LinkButton href="/projecten" variant="secondary">Filters wissen</LinkButton>} />
          ) : (
            <EmptyState
              icon={FolderKanban}
              title="Nog geen projecten"
              description="Maak een project aan en koppel het aan een klant. Daarna volgen calculatie, planning en facturatie."
              action={canWrite && <LinkButton href="/projecten/nieuw">Project aanmaken</LinkButton>}
            />
          )
        ) : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/projecten/${p.id}`} className="block px-4 py-3 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-900">{p.name}</p>
                      <ProjectStatusBadge status={p.status} />
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {p.project_number} · {p.customer?.name}
                    </p>
                    <p className="mt-1 text-sm tabular-nums text-slate-700">{formatMoney(p.contract_value, p.currency_code || cur, locale)}</p>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <SortTh label="Projectnr." column="project_number" {...sortProps} />
                    <SortTh label="Project" column="name" {...sortProps} />
                    <SortTh label="Status" column="status" {...sortProps} />
                    <SortTh label="Start" column="start_date" {...sortProps} className="hidden xl:table-cell" />
                    <SortTh label="Einde" column="expected_end_date" {...sortProps} className="hidden lg:table-cell" />
                    <Th className="hidden lg:table-cell">Projectleider</Th>
                    <SortTh label="Budget" column="budget_amount" {...sortProps} className="text-right" />
                    <SortTh label="Verkoopwaarde" column="contract_value" {...sortProps} className="text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {projects.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <Td className="whitespace-nowrap font-mono text-xs text-slate-500">{p.project_number}</Td>
                      <Td>
                        <Link href={`/projecten/${p.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                          {p.name}
                        </Link>
                        {p.is_archived && <Badge className="ml-2">Gearchiveerd</Badge>}
                        <p className="text-xs text-slate-500">{p.customer?.name}</p>
                      </Td>
                      <Td><ProjectStatusBadge status={p.status} /></Td>
                      <Td className="hidden whitespace-nowrap text-slate-500 xl:table-cell">{formatDate(p.start_date, locale)}</Td>
                      <Td className="hidden whitespace-nowrap text-slate-500 lg:table-cell">{formatDate(p.expected_end_date, locale)}</Td>
                      <Td className="hidden lg:table-cell">{p.project_manager_name ?? <span className="text-slate-400">—</span>}</Td>
                      <Td className="whitespace-nowrap text-right tabular-nums">{formatMoney(p.budget_amount, p.currency_code || cur, locale)}</Td>
                      <Td className="whitespace-nowrap text-right tabular-nums font-medium text-slate-900">{formatMoney(p.contract_value, p.currency_code || cur, locale)}</Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 text-sm">
                  <tr>
                    <Td className="font-medium text-slate-600" >Totaal ({projects.length})</Td>
                    <Td />
                    <Td />
                    <Td className="hidden xl:table-cell" />
                    <Td className="hidden lg:table-cell" />
                    <Td className="hidden lg:table-cell" />
                    <Td className="whitespace-nowrap text-right font-semibold tabular-nums">{formatMoney(totalBudget, cur, locale)}</Td>
                    <Td className="whitespace-nowrap text-right font-semibold tabular-nums">{formatMoney(totalContract, cur, locale)}</Td>
                  </tr>
                </tfoot>
              </Table>
            </div>
            <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 md:hidden">{projects.length} projecten</p>
          </>
        )}
      </Card>
    </>
  );
}
