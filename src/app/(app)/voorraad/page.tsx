import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineForm } from "@/components/ui/entity-form";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listProjects, parseProjectFilters } from "@/lib/data/projects";
import { listStock, listStockMovements } from "@/lib/data/resources";
import { formatMoney, toDecimal } from "@/lib/finance/money";
import { formatDate, todayISO } from "@/lib/format";
import { saveStockMovement } from "./actions";

export const metadata: Metadata = { title: "Voorraad" };

const TYPE_LABELS = { receipt: "Ontvangst", issue: "Uitgifte project", return: "Retour van project", adjustment: "Correctie" } as const;

export default async function StockPage() {
  const ctx = await getAppContext();
  const [stock, movements, projects] = await Promise.all([listStock(ctx), listStockMovements(ctx, { limit: 100 }), listProjects(ctx, { ...parseProjectFilters({}), status: "open" })]);
  const canWrite = can(ctx.membership.role, "stock.write");
  const { currency_code: cur, locale } = ctx.settings;
  const low = stock.filter((s) => s.min_stock !== null && toDecimal(s.on_hand).lessThan(s.min_stock));
  const totalValue = stock.reduce((a, s) => a.plus(toDecimal(s.on_hand).times(s.cost_price)), toDecimal(0));

  return (
    <ModuleGate ctx={ctx} module="voorraad">
      <PageHeader title="Voorraad" description="Voorraadstand per artikel. Mutaties zijn onwijzigbaar; correcties boekt u als nieuwe mutatie." />
      {low.length > 0 && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">{low.length} artikel(en) onder de minimale voorraad</p>
            <p className="mt-0.5">{low.map((s) => s.description).join(", ")}</p>
          </div>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Voorraadstand" description={`Waarde tegen huidige kostprijs: ${formatMoney(totalValue, cur, locale)}`} />
          {stock.length === 0 ? (
            <EmptyState icon={Warehouse} title="Geen voorraadartikelen" description="Zet 'Voorraad bijhouden' aan bij een artikel in de materiaalbibliotheek." />
          ) : (
            <Table>
              <thead>
                <tr><Th>Artikel</Th><Th className="text-right">Op voorraad</Th><Th className="hidden sm:table-cell text-right">Minimum</Th><Th className="hidden md:table-cell text-right">Waarde</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {stock.map((s) => {
                  const isLow = s.min_stock !== null && toDecimal(s.on_hand).lessThan(s.min_stock);
                  return (
                    <tr key={s.material_id}>
                      <Td>
                        <Link href={`/materialen/${s.material_id}`} className="font-medium text-slate-900 hover:text-brand-700">{s.description}</Link>
                        <p className="font-mono text-xs text-slate-600">{s.article_number}</p>
                      </Td>
                      <Td className="whitespace-nowrap text-right tabular-nums">
                        {Number(s.on_hand).toLocaleString("nl-NL")} {s.unit} {isLow && <Badge tone="red" className="ml-1">Laag</Badge>}
                      </Td>
                      <Td className="hidden sm:table-cell text-right tabular-nums">{s.min_stock !== null ? Number(s.min_stock).toLocaleString("nl-NL") : "—"}</Td>
                      <Td className="hidden md:table-cell whitespace-nowrap text-right tabular-nums">{formatMoney(toDecimal(s.on_hand).times(s.cost_price), cur, locale)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
        {canWrite && (
          <Card>
            <CardHeader title="Voorraadmutatie boeken" description="Uitgifte aan een project boekt automatisch de materiaalkosten op dat project." />
            <CardBody>
              <InlineForm
                action={saveStockMovement}
                submitLabel="Mutatie boeken"
                disabled={ctx.mode === "demo"}
                fields={[
                  { name: "material_id", label: "Artikel", type: "select", required: true, span: 6, options: [{ value: "", label: "Kies een artikel…" }, ...stock.map((s) => ({ value: s.material_id, label: `${s.article_number} — ${s.description}` }))] },
                  { name: "movement_type", label: "Soort", type: "select", span: 3, options: [{ value: "issue", label: "Uitgifte aan project" }, { value: "return", label: "Retour van project" }, { value: "adjustment", label: "Correctie (+/−)" }] },
                  { name: "quantity", label: "Hoeveelheid", type: "decimal", required: true, span: 3, hint: "Correctie mag negatief zijn" },
                  { name: "project_id", label: "Project", type: "select", span: 6, options: [{ value: "", label: "Geen (alleen bij correctie)" }, ...projects.map((p) => ({ value: p.id, label: `${p.project_number} — ${p.name}` }))] },
                  { name: "occurred_on", label: "Datum", type: "date", span: 3 },
                  { name: "note", label: "Toelichting", span: 3 },
                ]}
                initialValues={{ occurred_on: todayISO(ctx.settings.timezone), movement_type: "issue" }}
              />
            </CardBody>
          </Card>
        )}
      </div>
      <Card className="mt-6">
        <CardHeader title="Recente mutaties" />
        {movements.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-600">Nog geen mutaties.</p>
        ) : (
          <Table>
            <thead>
              <tr><Th>Datum</Th><Th>Artikel</Th><Th>Soort</Th><Th className="text-right">Hoeveelheid</Th><Th className="hidden md:table-cell">Project / toelichting</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {movements.map((m) => (
                <tr key={m.id}>
                  <Td className="whitespace-nowrap">{formatDate(m.occurred_on)}</Td>
                  <Td>{m.material?.description}</Td>
                  <Td><Badge tone={m.movement_type === "issue" ? "orange" : m.movement_type === "adjustment" ? "slate" : "green"}>{TYPE_LABELS[m.movement_type]}</Badge></Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{m.movement_type === "issue" ? "−" : ""}{Number(m.quantity).toLocaleString("nl-NL")} {m.material?.unit}</Td>
                  <Td className="hidden md:table-cell text-slate-600">{m.project ? `${m.project.project_number} ${m.project.name}` : m.note ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </ModuleGate>
  );
}
