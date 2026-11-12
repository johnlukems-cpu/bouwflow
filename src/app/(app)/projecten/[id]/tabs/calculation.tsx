import { Calculator, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineForm } from "@/components/ui/entity-form";
import { SubmitButton } from "@/components/ui/submit-button";
import type { AppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listEstimateLines } from "@/lib/data/execution";
import { listMaterials } from "@/lib/data/resources";
import { COST_TYPES, COST_TYPE_LABELS, MATERIAL_CATEGORIES, summarizeEstimate } from "@/lib/finance/estimate";
import { formatMoney, formatPercent } from "@/lib/finance/money";
import type { Project } from "@/lib/types";
import { addEstimateLine, applyEstimateToProject, createQuoteFromEstimate, deleteEstimateLine } from "../../actions";

export async function CalculationTab({ ctx, project }: { ctx: AppContext; project: Project }) {
  const [lines, materials] = await Promise.all([listEstimateLines(ctx, project.id), listMaterials(ctx)]);
  const canWrite = can(ctx.membership.role, "estimate.write") && ctx.mode !== "demo";
  const cur = project.currency_code;
  const { locale } = ctx.settings;
  const m = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, cur, locale);
  // Totalen exact herberekend met dezelfde rekenkern als de database
  const sum = summarizeEstimate(lines.map((l) => ({ costType: l.cost_type, quantity: l.quantity, unitCost: l.unit_cost, unitPrice: l.unit_price, wastePercent: l.waste_percent })));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Voorcalculatie"
          description="Materialen (met snijverlies), arbeid, machines, transport, onderaannemers en overige kosten. Totalen worden exact berekend."
        />
        {lines.length === 0 ? (
          <EmptyState icon={Calculator} title="Nog geen calculatieregels" description="Voeg hieronder regels toe, eventueel vanuit de materiaalbibliotheek." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Soort</th>
                  <th className="px-3 py-2 text-left">Omschrijving</th>
                  <th className="px-3 py-2 text-right">Hoeveelheid</th>
                  <th className="hidden px-3 py-2 text-right md:table-cell">Verlies</th>
                  <th className="hidden px-3 py-2 text-right sm:table-cell">Kostprijs</th>
                  <th className="px-3 py-2 text-right">Kosten</th>
                  <th className="px-3 py-2 text-right">Verkoop</th>
                  {canWrite && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">{COST_TYPE_LABELS[l.cost_type]}</td>
                    <td className="px-3 py-2">
                      {l.description}
                      {l.article_number && <span className="ml-1 font-mono text-xs text-slate-400">{l.article_number}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{Number(l.quantity).toLocaleString("nl-NL")} {l.unit}</td>
                    <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">{Number(l.waste_percent) ? `${Number(l.waste_percent).toLocaleString("nl-NL")}%` : "—"}</td>
                    <td className="hidden whitespace-nowrap px-3 py-2 text-right tabular-nums sm:table-cell">{m(l.unit_cost)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{m(l.cost_total)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{m(l.sale_total)}</td>
                    {canWrite && (
                      <td className="px-3 py-2 text-right">
                        <form action={deleteEstimateLine}>
                          <input type="hidden" name="project_id" value={project.id} />
                          <input type="hidden" name="line_id" value={l.id} />
                          <button type="submit" className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Regel ${l.description} verwijderen`}>
                            <Trash2 className="size-4" />
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 text-sm">
                {COST_TYPES.filter((t) => !sum.costByType[t].isZero() || !sum.saleByType[t].isZero()).map((t) => (
                  <tr key={t} className="text-slate-600">
                    <td className="px-3 py-1.5" colSpan={2}>Subtotaal {COST_TYPE_LABELS[t].toLowerCase()}</td>
                    <td className="hidden md:table-cell" />
                    <td className="hidden sm:table-cell" />
                    <td />
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{m(sum.costByType[t])}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{m(sum.saleByType[t])}</td>
                    {canWrite && <td />}
                  </tr>
                ))}
                <tr className="font-semibold text-navy-900">
                  <td className="px-3 py-2" colSpan={2}>Totaal</td>
                  <td className="hidden md:table-cell" />
                  <td className="hidden sm:table-cell" />
                  <td />
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{m(sum.totalCost)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{m(sum.totalSale)}</td>
                  {canWrite && <td />}
                </tr>
                <tr className="text-slate-600">
                  <td className="px-3 py-1.5" colSpan={2}>Marge</td>
                  <td className="hidden md:table-cell" />
                  <td className="hidden sm:table-cell" />
                  <td />
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums" colSpan={2}>
                    {m(sum.margin)} {sum.marginPercent && `(${formatPercent(sum.marginPercent, locale)})`}
                  </td>
                  {canWrite && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {lines.length > 0 && can(ctx.membership.role, "quotes.write") && (
        <Card>
          <CardHeader title="Vervolgstappen" description="Workflow: calculatie → offerte → goedkeuring → opdracht." />
          <CardBody className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <form action={createQuoteFromEstimate} className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
              <input type="hidden" name="project_id" value={project.id} />
              <label className="flex-1 text-sm">
                <span className="mb-1.5 block font-medium text-slate-700">Offerte opbouwen</span>
                <select name="mode" className="h-11 w-full rounded-lg border-0 bg-white px-3 text-sm ring-1 ring-inset ring-slate-300 sm:h-10">
                  <option value="type">Eén regel per kostensoort (aanbevolen)</option>
                  <option value="line">Alle calculatieregels afzonderlijk</option>
                </select>
              </label>
              <SubmitButton disabled={ctx.mode === "demo"} pendingText="Offerte wordt gemaakt…">Offerte maken</SubmitButton>
            </form>
            {can(ctx.membership.role, "projects.write") && (
              <form action={applyEstimateToProject}>
                <input type="hidden" name="project_id" value={project.id} />
                <Button type="submit" variant="secondary" disabled={ctx.mode === "demo"}>Budget en verkoopwaarde overnemen</Button>
              </form>
            )}
          </CardBody>
        </Card>
      )}

      {canWrite && (
        <Card>
          <CardHeader title="Regel toevoegen" description="Kies een artikel uit de bibliotheek om omschrijving, eenheid, prijzen en verlies automatisch over te nemen." />
          <CardBody>
            <InlineForm
              action={addEstimateLine}
              submitLabel="Regel toevoegen"
              hidden={{ project_id: project.id }}
              initialValues={{ cost_type: "material", waste_percent: "0" }}
              fields={[
                { name: "cost_type", label: "Kostensoort", type: "select", span: 2, options: COST_TYPES.map((t) => ({ value: t, label: COST_TYPE_LABELS[t] })) },
                { name: "material_id", label: "Uit bibliotheek (optioneel)", type: "select", span: 4, options: [{ value: "", label: "Geen — handmatig invullen" }, ...materials.map((mat) => ({ value: mat.id, label: `${mat.article_number} — ${mat.description}` }))] },
                { name: "description", label: "Omschrijving", span: 4, hint: "Leeg laten = uit bibliotheek" },
                { name: "category", label: "Categorie", type: "select", span: 2, options: [{ value: "", label: "—" }, ...MATERIAL_CATEGORIES.map((c) => ({ value: c, label: c }))] },
                { name: "quantity", label: "Hoeveelheid", type: "decimal", required: true, span: 2 },
                { name: "unit", label: "Eenheid", span: 1, placeholder: "st" },
                { name: "waste_percent", label: "Verlies %", type: "decimal", span: 1 },
                { name: "unit_cost", label: "Kostprijs/eenheid", type: "decimal", span: 1 },
                { name: "unit_price", label: "Verkoop/eenheid", type: "decimal", span: 1 },
              ]}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
