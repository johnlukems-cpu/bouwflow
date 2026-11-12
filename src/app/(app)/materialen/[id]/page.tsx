import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EntityForm } from "@/components/ui/entity-form";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getMaterial, getPriceHistory, listStock, listSuppliers } from "@/lib/data/resources";
import { formatMoney } from "@/lib/finance/money";
import { formatDateTime } from "@/lib/format";
import { archiveMaterial, saveMaterial } from "../actions";
import { materialSections } from "../config";

export const metadata: Metadata = { title: "Artikel" };

export default async function MaterialPage({ params }: PageProps<"/materialen/[id]">) {
  const { id } = await params;
  const ctx = await getAppContext();
  const material = await getMaterial(ctx, id);
  if (!material) notFound();
  const [suppliers, history, stock] = await Promise.all([listSuppliers(ctx), getPriceHistory(ctx, id), listStock(ctx)]);
  const level = stock.find((s) => s.material_id === id);
  const canWrite = can(ctx.membership.role, "materials.write");
  const { currency_code: cur, locale, timezone } = ctx.settings;
  const values = Object.fromEntries(Object.entries(material).map(([k, v]) => [k, v === null ? "" : String(v)]));
  return (
    <ModuleGate ctx={ctx} module="materialen">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title={material.description}
          breadcrumbs={[{ label: "Materiaalbibliotheek", href: "/materialen" }, { label: material.article_number }]}
          meta={
            <>
              <Badge>{material.category}</Badge>
              {level && <Badge tone="blue">Voorraad: {Number(level.on_hand).toLocaleString("nl-NL")} {material.unit}</Badge>}
              {material.is_archived && <Badge tone="amber">Gearchiveerd</Badge>}
            </>
          }
          actions={
            canWrite && (
              <ConfirmAction
                action={archiveMaterial}
                fields={{ id: material.id, archive: material.is_archived ? "false" : "true" }}
                trigger={material.is_archived ? <><ArchiveRestore className="size-4" aria-hidden /> Herstellen</> : <><Archive className="size-4" aria-hidden /> Archiveren</>}
                title={material.is_archived ? "Artikel herstellen?" : "Artikel archiveren?"}
                description="Het artikel blijft in bestaande calculaties, documenten en voorraadmutaties bewaard."
                confirmLabel={material.is_archived ? "Herstellen" : "Archiveren"}
                confirmVariant={material.is_archived ? "primary" : "danger"}
              />
            )
          }
        />
        <EntityForm action={saveMaterial} sections={materialSections(suppliers)} initialValues={values} hidden={{ id: material.id }} submitLabel="Wijzigingen opslaan" readOnly={ctx.mode === "demo" || !canWrite} />
        <Card>
          <CardHeader title="Prijshistorie" description="Elke prijswijziging wordt bewaard." />
          <Table>
            <thead>
              <tr><Th>Geldig vanaf</Th><Th className="text-right">Kostprijs</Th><Th className="text-right">Verkoopprijs</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {history.map((h) => (
                <tr key={h.valid_from}>
                  <Td>{formatDateTime(h.valid_from, locale, timezone)}</Td>
                  <Td className="text-right tabular-nums">{formatMoney(h.cost_price, cur, locale)}</Td>
                  <Td className="text-right tabular-nums">{formatMoney(h.sale_price, cur, locale)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </ModuleGate>
  );
}
