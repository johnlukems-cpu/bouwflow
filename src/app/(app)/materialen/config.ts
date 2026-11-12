import type { FieldSection } from "@/components/ui/entity-form";
import { MATERIAL_CATEGORIES } from "@/lib/finance/estimate";
import type { Supplier } from "@/lib/types";

export function materialSections(suppliers: Supplier[]): FieldSection[] {
  return [
    {
      title: "Artikel",
      fields: [
        { name: "article_number", label: "Artikelnummer", required: true, span: 2, maxLength: 50 },
        { name: "description", label: "Omschrijving", required: true, span: 4, maxLength: 300 },
        { name: "category", label: "Categorie", type: "select", span: 2, options: MATERIAL_CATEGORIES.map((c) => ({ value: c, label: c })) },
        { name: "unit", label: "Eenheid", required: true, span: 2, placeholder: "st, m, m², zak", maxLength: 20 },
        {
          name: "supplier_id",
          label: "Vaste leverancier",
          type: "select",
          span: 2,
          options: [{ value: "", label: "Geen" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))],
        },
      ],
    },
    {
      title: "Prijzen en voorraad",
      description: "Prijswijzigingen worden automatisch in de prijshistorie bewaard. Bestaande calculaties en documenten veranderen niet mee.",
      fields: [
        { name: "cost_price", label: "Kostprijs per eenheid", type: "decimal", span: 2 },
        { name: "sale_price", label: "Verkoopprijs per eenheid", type: "decimal", span: 2 },
        { name: "waste_percent", label: "Standaard snij-/materiaalverlies (%)", type: "decimal", span: 2 },
        { name: "track_stock", label: "Voorraad bijhouden", type: "checkbox", span: 3 },
        { name: "min_stock", label: "Minimale voorraad (signalering)", type: "decimal", span: 3 },
      ],
    },
  ];
}
