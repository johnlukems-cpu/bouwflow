import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EntityForm } from "@/components/ui/entity-form";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { PurchaseOrderBadge } from "@/components/ui/status";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listPurchaseOrders } from "@/lib/data/execution";
import { getSupplier } from "@/lib/data/resources";
import { formatMoney } from "@/lib/finance/money";
import { formatDate } from "@/lib/format";
import { archiveSupplier, saveSupplier } from "../actions";
import { supplierSections } from "../config";

export const metadata: Metadata = { title: "Leverancier" };

export default async function SupplierPage({ params }: PageProps<"/leveranciers/[id]">) {
  const { id } = await params;
  const ctx = await getAppContext();
  const supplier = await getSupplier(ctx, id);
  if (!supplier) notFound();
  const orders = await listPurchaseOrders(ctx, { supplierId: id });
  const canWrite = can(ctx.membership.role, "suppliers.write");
  const values = Object.fromEntries(Object.entries(supplier).map(([k, v]) => [k, v === null ? "" : String(v)]));
  return (
    <ModuleGate ctx={ctx} module="leveranciers">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title={supplier.name}
          breadcrumbs={[{ label: "Leveranciers", href: "/leveranciers" }, { label: supplier.supplier_number }]}
          meta={supplier.is_archived ? <Badge tone="amber">Gearchiveerd</Badge> : undefined}
          actions={
            canWrite && (
              <ConfirmAction
                action={archiveSupplier}
                fields={{ id: supplier.id, archive: supplier.is_archived ? "false" : "true" }}
                trigger={supplier.is_archived ? <><ArchiveRestore className="size-4" aria-hidden /> Herstellen</> : <><Archive className="size-4" aria-hidden /> Archiveren</>}
                title={supplier.is_archived ? "Leverancier herstellen?" : "Leverancier archiveren?"}
                description="Gegevens en inkooporders blijven bewaard."
                confirmLabel={supplier.is_archived ? "Herstellen" : "Archiveren"}
                confirmVariant={supplier.is_archived ? "primary" : "danger"}
              />
            )
          }
        />
        <div className="space-y-6">
          <EntityForm action={saveSupplier} sections={supplierSections} initialValues={values} hidden={{ id: supplier.id }} submitLabel="Wijzigingen opslaan" readOnly={ctx.mode === "demo" || !canWrite} readOnlyMessage={ctx.mode === "demo" ? undefined : "U heeft alleen leesrechten."} />
          <Card>
            <CardHeader title="Inkooporders" />
            {orders.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">Nog geen inkooporders bij deze leverancier.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/inkoop/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                      <span>
                        <span className="font-medium text-slate-900">{o.purchase_order_number}</span>
                        <span className="ml-2 text-sm text-slate-500">{formatDate(o.order_date)}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-sm tabular-nums">{formatMoney(o.total ?? 0, o.currency_code, ctx.settings.locale)}</span>
                        <PurchaseOrderBadge status={o.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </ModuleGate>
  );
}
