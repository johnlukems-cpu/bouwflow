import type { FieldSection } from "@/components/ui/entity-form";
import type { CustomerOption } from "@/lib/data/customers";
import type { Project } from "@/lib/types";

export function quoteSections(customers: CustomerOption[], projects: Project[]): FieldSection[] {
  return [
    {
      title: "Offerte",
      fields: [
        { name: "title", label: "Titel", required: true, span: 6 },
        { name: "customer_id", label: "Klant", type: "select", required: true, span: 3, options: [{ value: "", label: "Kies een klant…" }, ...customers.map((c) => ({ value: c.id, label: `${c.name} (${c.customer_number})` }))] },
        { name: "project_id", label: "Project", type: "select", span: 3, options: [{ value: "", label: "Geen project" }, ...projects.map((p) => ({ value: p.id, label: `${p.project_number} — ${p.name}` }))] },
        { name: "quote_date", label: "Offertedatum", type: "date", required: true, span: 2 },
        { name: "valid_until", label: "Geldig tot", type: "date", span: 2, hint: "Leeg = volgens instellingen" },
        { name: "prices_include_tax", label: "Prijzen incl. belasting", type: "checkbox", span: 2 },
        { name: "introduction", label: "Inleiding", type: "textarea", span: 6 },
        { name: "terms", label: "Voorwaarden", type: "textarea", span: 6, hint: "Bijv. betalingsvoorwaarden, uitsluitingen, geldigheid." },
      ],
    },
  ];
}
