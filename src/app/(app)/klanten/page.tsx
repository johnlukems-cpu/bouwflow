import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { SortTh, Table, Td, Th } from "@/components/ui/table";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listCustomers, parseCustomerFilters } from "@/lib/data/customers";
import { formatDate } from "@/lib/format";
import { CUSTOMER_TYPE_LABELS } from "@/lib/types";

export const metadata: Metadata = { title: "Klanten" };

export default async function CustomersPage({ searchParams }: PageProps<"/klanten">) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const f = parseCustomerFilters(sp);
  const customers = await listCustomers(ctx, f);
  const canWrite = can(ctx.membership.role, "customers.write");
  const params = { q: f.q || undefined, type: f.type !== "all" ? f.type : undefined, archief: f.archive !== "active" ? f.archive : undefined };
  const filtered = Boolean(params.q || params.type || params.archief);

  return (
    <>
      <PageHeader
        title="Klanten"
        description="Particuliere en zakelijke opdrachtgevers van uw organisatie."
        actions={
          canWrite && (
            <LinkButton href="/klanten/nieuw" variant="accent">
              <Plus className="size-4" aria-hidden /> Nieuwe klant
            </LinkButton>
          )
        }
      />
      <Card>
        <FilterBar placeholder="Zoek op naam, klantnummer, contactpersoon, e-mail of plaats">
          <FilterSelect
            name="type"
            label="Soort klant"
            value={f.type}
            options={[
              { value: "all", label: "Alle soorten" },
              { value: "business", label: "Zakelijk" },
              { value: "private", label: "Particulier" },
            ]}
          />
          <FilterSelect
            name="archief"
            label="Archief"
            value={f.archive}
            options={[
              { value: "active", label: "Actieve klanten" },
              { value: "archived", label: "Gearchiveerd" },
              { value: "all", label: "Alle klanten" },
            ]}
          />
        </FilterBar>

        {customers.length === 0 ? (
          filtered ? (
            <EmptyState icon={Users} title="Geen klanten gevonden" description="Pas uw zoekopdracht of filters aan." action={<LinkButton href="/klanten" variant="secondary">Filters wissen</LinkButton>} />
          ) : (
            <EmptyState
              icon={Users}
              title="Nog geen klanten"
              description="Voeg uw eerste klant toe. Daarna kunt u projecten aan deze klant koppelen."
              action={canWrite && <LinkButton href="/klanten/nieuw">Klant toevoegen</LinkButton>}
            />
          )
        ) : (
          <>
            {/* Mobiel: kaarten */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {customers.map((c) => (
                <li key={c.id}>
                  <Link href={`/klanten/${c.id}`} className="block px-4 py-3 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-900">{c.name}</p>
                      <Badge tone={c.customer_type === "business" ? "blue" : "slate"}>{CUSTOMER_TYPE_LABELS[c.customer_type]}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {c.customer_number}
                      {c.city && ` · ${c.city}`}
                      {c.is_archived && " · Gearchiveerd"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            {/* Desktop: tabel */}
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <SortTh label="Klantnr." column="customer_number" current={f.sort} dir={f.dir} params={params} basePath="/klanten" />
                    <SortTh label="Naam" column="name" current={f.sort} dir={f.dir} params={params} basePath="/klanten" />
                    <Th>Soort</Th>
                    <Th>Contact</Th>
                    <SortTh label="Plaats" column="city" current={f.sort} dir={f.dir} params={params} basePath="/klanten" />
                    <SortTh label="Aangemaakt" column="created_at" current={f.sort} dir={f.dir} params={params} basePath="/klanten" className="hidden lg:table-cell" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <Td className="whitespace-nowrap font-mono text-xs text-slate-500">{c.customer_number}</Td>
                      <Td>
                        <Link href={`/klanten/${c.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                          {c.name}
                        </Link>
                        {c.is_archived && <Badge className="ml-2">Gearchiveerd</Badge>}
                        {c.contact_person && <p className="text-xs text-slate-500">t.a.v. {c.contact_person}</p>}
                      </Td>
                      <Td>
                        <Badge tone={c.customer_type === "business" ? "blue" : "slate"}>{CUSTOMER_TYPE_LABELS[c.customer_type]}</Badge>
                      </Td>
                      <Td>
                        <div className="text-sm">{c.email ?? <span className="text-slate-400">—</span>}</div>
                        {c.phone && <div className="text-xs text-slate-500">{c.phone}</div>}
                      </Td>
                      <Td>{c.city ?? <span className="text-slate-400">—</span>}</Td>
                      <Td className="hidden whitespace-nowrap text-slate-500 lg:table-cell">{formatDate(c.created_at, ctx.settings.locale)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              {customers.length} {customers.length === 1 ? "klant" : "klanten"}
            </p>
          </>
        )}
      </Card>
    </>
  );
}
