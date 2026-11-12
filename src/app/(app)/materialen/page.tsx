import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Plus } from "lucide-react";
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
import { listMaterials } from "@/lib/data/resources";
import { MATERIAL_CATEGORIES } from "@/lib/finance/estimate";
import { formatMoney } from "@/lib/finance/money";

export const metadata: Metadata = { title: "Materiaalbibliotheek" };

export default async function MaterialsPage({ searchParams }: PageProps<"/materialen">) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const category = typeof sp.categorie === "string" && (MATERIAL_CATEGORIES as readonly string[]).includes(sp.categorie) ? sp.categorie : "";
  const q = typeof sp.q === "string" ? sp.q : "";
  const materials = await listMaterials(ctx, { q, category, archived: sp.archief === "archived" });
  const canWrite = can(ctx.membership.role, "materials.write");
  const { currency_code: cur, locale } = ctx.settings;
  return (
    <ModuleGate ctx={ctx} module="materialen">
      <PageHeader
        title="Materiaalbibliotheek"
        description="Artikelen met eenheid, kost- en verkoopprijs en standaard verlies — per organisatie beheerd."
        actions={canWrite && <LinkButton href="/materialen/nieuw"><Plus className="size-4" aria-hidden /> Nieuw artikel</LinkButton>}
      />
      <Card>
        <FilterBar placeholder="Zoek op artikelnummer of omschrijving">
          <FilterSelect name="categorie" label="Categorie" value={category} options={[{ value: "", label: "Alle categorieën" }, ...MATERIAL_CATEGORIES.map((c) => ({ value: c, label: c }))]} />
          <FilterSelect name="archief" label="Archief" value={sp.archief === "archived" ? "archived" : "active"} options={[{ value: "active", label: "Actief" }, { value: "archived", label: "Gearchiveerd" }]} />
        </FilterBar>
        {materials.length === 0 ? (
          <EmptyState icon={Boxes} title="Geen artikelen" description="Voeg artikelen toe om ze te gebruiken in calculaties, werkbonnen, inkoop en voorraad." action={canWrite && !q && <LinkButton href="/materialen/nieuw">Artikel toevoegen</LinkButton>} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Artikelnr.</Th>
                <Th>Omschrijving</Th>
                <Th className="hidden md:table-cell">Categorie</Th>
                <Th className="hidden sm:table-cell">Eenheid</Th>
                <Th className="text-right">Kostprijs</Th>
                <Th className="hidden sm:table-cell text-right">Verkoop</Th>
                <Th className="hidden lg:table-cell text-right">Verlies</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {materials.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap font-mono text-xs text-slate-600">{m.article_number}</Td>
                  <Td>
                    <Link href={`/materialen/${m.id}`} className="font-medium text-slate-900 hover:text-brand-700">{m.description}</Link>
                    {m.track_stock && <Badge tone="blue" className="ml-2">Voorraad</Badge>}
                  </Td>
                  <Td className="hidden md:table-cell">{m.category}</Td>
                  <Td className="hidden sm:table-cell">{m.unit}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{formatMoney(m.cost_price, cur, locale)}</Td>
                  <Td className="hidden sm:table-cell whitespace-nowrap text-right tabular-nums">{formatMoney(m.sale_price, cur, locale)}</Td>
                  <Td className="hidden lg:table-cell text-right tabular-nums">{Number(m.waste_percent).toLocaleString("nl-NL")}%</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </ModuleGate>
  );
}
