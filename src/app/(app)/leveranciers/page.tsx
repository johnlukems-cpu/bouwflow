import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listSuppliers } from "@/lib/data/resources";
import { SUPPLIER_TYPE_LABELS } from "@/lib/types";

export const metadata: Metadata = { title: "Leveranciers" };

export default async function SuppliersPage({ searchParams }: PageProps<"/leveranciers">) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const archived = sp.archief === "archived";
  const q = typeof sp.q === "string" ? sp.q : "";
  const suppliers = await listSuppliers(ctx, { q, archived });
  const canWrite = can(ctx.membership.role, "suppliers.write");
  return (
    <ModuleGate ctx={ctx} module="leveranciers">
      <PageHeader
        title="Leveranciers"
        description="Groothandels, verhuurbedrijven en onderaannemers."
        actions={canWrite && <LinkButton href="/leveranciers/nieuw"><Plus className="size-4" aria-hidden /> Nieuwe leverancier</LinkButton>}
      />
      <Card>
        <FilterBar placeholder="Zoek op naam, nummer, contactpersoon of plaats">
          <FilterSelect name="archief" label="Archief" value={archived ? "archived" : "active"} options={[{ value: "active", label: "Actief" }, { value: "archived", label: "Gearchiveerd" }]} />
        </FilterBar>
        {suppliers.length === 0 ? (
          <EmptyState icon={Truck} title={q ? "Geen leveranciers gevonden" : "Nog geen leveranciers"} description="Leveranciers gebruikt u bij inkooporders en in de materiaalbibliotheek." action={canWrite && !q && <LinkButton href="/leveranciers/nieuw">Leverancier toevoegen</LinkButton>} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Nr.</Th>
                <Th>Naam</Th>
                <Th className="hidden sm:table-cell">Soort</Th>
                <Th className="hidden md:table-cell">Contact</Th>
                <Th className="hidden lg:table-cell">Plaats</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap font-mono text-xs text-slate-600">{s.supplier_number}</Td>
                  <Td>
                    <Link href={`/leveranciers/${s.id}`} className="font-medium text-slate-900 hover:text-brand-700">{s.name}</Link>
                    <p className="text-xs text-slate-600 sm:hidden">{SUPPLIER_TYPE_LABELS[s.supplier_type]}</p>
                  </Td>
                  <Td className="hidden sm:table-cell"><Badge tone={s.supplier_type === "subcontractor" ? "purple" : "blue"}>{SUPPLIER_TYPE_LABELS[s.supplier_type]}</Badge></Td>
                  <Td className="hidden md:table-cell">
                    <div>{s.contact_person ?? <span className="text-slate-500">—</span>}</div>
                    {s.phone && <div className="text-xs text-slate-600">{s.phone}</div>}
                  </Td>
                  <Td className="hidden lg:table-cell">{s.city ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </ModuleGate>
  );
}
