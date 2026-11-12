import type { FieldSection } from "@/components/ui/entity-form";
import type { CustomerOption } from "@/lib/data/customers";
import type { Project } from "@/lib/types";

export function invoiceSections(customers: CustomerOption[], projects: Project[], editing: boolean): FieldSection[] {
  return [
    {
      title: "Factuur",
      fields: [
        { name: "title", label: "Omschrijving", required: true, span: 6 },
        { name: "customer_id", label: "Klant", type: "select", required: true, span: 3, options: [{ value: "", label: "Kies een klant…" }, ...customers.map((c) => ({ value: c.id, label: `${c.name} (${c.customer_number})` }))] },
        { name: "project_id", label: "Project", type: "select", span: 3, options: [{ value: "", label: "Geen project" }, ...projects.map((p) => ({ value: p.id, label: `${p.project_number} — ${p.name}` }))] },
        ...(editing ? [] : [{ name: "invoice_type", label: "Soort", type: "select" as const, span: 2 as const, options: [{ value: "standard", label: "Factuur" }, { value: "advance", label: "Voorschotfactuur" }, { value: "installment", label: "Termijnfactuur" }, { value: "final", label: "Eindfactuur" }] }]),
        { name: "invoice_date", label: "Factuurdatum", type: "date", required: true, span: 2 },
        { name: "due_date", label: "Vervaldatum", type: "date", span: 2, hint: "Leeg = volgens betalingstermijn" },
        { name: "prices_include_tax", label: "Prijzen incl. belasting", type: "checkbox", span: 2 },
        { name: "payment_terms", label: "Betalingsvoorwaarden", type: "textarea", span: 6, hint: "Leeg = standaardtekst uit instellingen" },
        { name: "notes", label: "Opmerkingen", type: "textarea", span: 6 },
      ],
    },
  ];
}
