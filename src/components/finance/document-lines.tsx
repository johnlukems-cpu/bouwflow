import { Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { InlineForm, type EntityFormState } from "@/components/ui/entity-form";
import { formatMoney, toDecimal } from "@/lib/finance/money";
import type { DocumentLine, TaxGroupRow, TaxRate } from "@/lib/types";

/** Regels + totalen van een offerte of factuur. Bedragen komen uit de database (exact berekend). */
export function DocumentLinesCard({
  lines,
  totals,
  currency,
  locale,
  editable,
  taxRates,
  parentField,
  parentId,
  addAction,
  removeAction,
  pricesIncludeTax,
  allowNegative,
}: {
  lines: DocumentLine[];
  totals: { subtotal: string; tax_total: string; total: string; tax_breakdown: TaxGroupRow[] };
  currency: string;
  locale: string;
  editable: boolean;
  taxRates: TaxRate[];
  parentField: "quote_id" | "invoice_id";
  parentId: string;
  addAction: (s: EntityFormState, f: FormData) => Promise<EntityFormState>;
  removeAction: (f: FormData) => Promise<void>;
  pricesIncludeTax: boolean;
  allowNegative?: boolean;
}) {
  const m = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, currency, locale);
  const defaultTax = taxRates.find((t) => t.is_default)?.id ?? "";
  return (
    <Card>
      <CardHeader title="Regels" description={pricesIncludeTax ? "Prijzen zijn inclusief belasting." : "Prijzen zijn exclusief belasting."} />
      {lines.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">Nog geen regels.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Omschrijving</th>
                <th className="px-4 py-2 text-right">Aantal</th>
                <th className="hidden px-4 py-2 text-right sm:table-cell">Prijs</th>
                <th className="hidden px-4 py-2 text-right md:table-cell">Korting</th>
                <th className="hidden px-4 py-2 text-right md:table-cell">Belasting</th>
                <th className="px-4 py-2 text-right">Bedrag</th>
                {editable && <th className="px-2 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5 whitespace-pre-line">{l.description}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{Number(l.quantity).toLocaleString("nl-NL")} {l.unit}</td>
                  <td className="hidden whitespace-nowrap px-4 py-2.5 text-right tabular-nums sm:table-cell">{m(l.unit_price)}</td>
                  <td className="hidden px-4 py-2.5 text-right tabular-nums md:table-cell">{Number(l.discount_percent) ? `${Number(l.discount_percent).toLocaleString("nl-NL")}%` : "—"}</td>
                  <td className="hidden px-4 py-2.5 text-right tabular-nums md:table-cell">{l.tax_rate_percent !== null ? `${Number(l.tax_rate_percent).toLocaleString("nl-NL")}%` : "geen"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums">{m(l.line_amount)}</td>
                  {editable && (
                    <td className="px-2 py-2 text-right">
                      <form action={removeAction}>
                        <input type="hidden" name={parentField} value={parentId} />
                        <input type="hidden" name="line_id" value={l.id} />
                        <button type="submit" className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Regel ${l.description} verwijderen`}>
                          <Trash2 className="size-4" />
                        </button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <dl className="ml-auto w-full max-w-sm space-y-1.5 border-t border-slate-100 px-5 py-4 text-sm">
        <div className="flex justify-between"><dt className="text-slate-600">Subtotaal{pricesIncludeTax ? " (excl. belasting)" : ""}</dt><dd className="tabular-nums">{m(totals.subtotal)}</dd></div>
        {totals.tax_breakdown.map((g) => (
          <div key={String(g.rate_percent)} className="flex justify-between text-slate-600">
            <dt>Belasting {Number(g.rate_percent).toLocaleString("nl-NL")}% over {m(g.taxable_amount)}</dt>
            <dd className="tabular-nums">{m(g.tax_amount)}</dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-navy-900"><dt>Totaal</dt><dd className="tabular-nums">{m(totals.total)}</dd></div>
        {toDecimal(totals.tax_total).isZero() && taxRates.length === 0 && (
          <p className="pt-1 text-xs text-amber-700">Er zijn nog geen belastingtarieven ingesteld (Instellingen).</p>
        )}
      </dl>
      {editable && (
        <CardBody className="border-t border-slate-100">
          <InlineForm
            action={addAction}
            submitLabel="Regel toevoegen"
            hidden={{ [parentField]: parentId, line_count: String(lines.length) }}
            initialValues={{ unit: "st", discount_percent: "0", tax_rate_id: defaultTax, quantity: "1" }}
            fields={[
              { name: "description", label: "Omschrijving", required: true, span: 6 },
              { name: "quantity", label: allowNegative ? "Aantal (negatief = credit)" : "Aantal", type: "decimal", required: true, span: 1 },
              { name: "unit", label: "Eenheid", span: 1 },
              { name: "unit_price", label: "Prijs per eenheid", type: "decimal", required: true, span: 2 },
              { name: "discount_percent", label: "Korting %", type: "decimal", span: 1 },
              { name: "tax_rate_id", label: "Belasting", type: "select", span: 1, options: [{ value: "", label: "Geen" }, ...taxRates.map((t) => ({ value: t.id, label: `${Number(t.rate_percent).toLocaleString("nl-NL")}% ${t.name}` }))] },
            ]}
          />
        </CardBody>
      )}
    </Card>
  );
}
