import type { FieldSection } from "@/components/ui/entity-form";
import type { Project, Supplier } from "@/lib/types";

export function purchaseOrderSections(suppliers: Supplier[], projects: Project[]): FieldSection[] {
  return [
    {
      title: "Inkooporder",
      fields: [
        { name: "supplier_id", label: "Leverancier", type: "select", required: true, span: 3, options: [{ value: "", label: "Kies een leverancier…" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))] },
        { name: "project_id", label: "Project", type: "select", span: 3, hint: "Leeg = voor het magazijn", options: [{ value: "", label: "Geen (magazijn)" }, ...projects.map((p) => ({ value: p.id, label: `${p.project_number} — ${p.name}` }))] },
        { name: "order_date", label: "Orderdatum", type: "date", required: true, span: 2 },
        { name: "expected_date", label: "Verwachte levering", type: "date", span: 2 },
        { name: "notes", label: "Opmerkingen", type: "textarea", span: 6 },
      ],
    },
  ];
}
