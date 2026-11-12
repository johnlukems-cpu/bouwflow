import type { FieldSection } from "@/components/ui/entity-form";
import { SUPPLIER_TYPE_LABELS } from "@/lib/types";

export const supplierSections: FieldSection[] = [
  {
    title: "Leverancier",
    fields: [
      { name: "name", label: "Naam", required: true, span: 4, maxLength: 200 },
      { name: "supplier_type", label: "Soort", type: "select", span: 2, options: Object.entries(SUPPLIER_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
      { name: "contact_person", label: "Contactpersoon", maxLength: 200 },
      { name: "vat_number", label: "BTW-nummer", maxLength: 50, hint: "Indien van toepassing" },
      { name: "email", label: "E-mailadres", type: "email" },
      { name: "phone", label: "Telefoonnummer", type: "tel" },
    ],
  },
  {
    title: "Adres en voorwaarden",
    fields: [
      { name: "address_line", label: "Adres", span: 4 },
      { name: "city", label: "Plaats / district", span: 2 },
      { name: "country_code", label: "Land (2 letters)", span: 2, maxLength: 2 },
      { name: "payment_term_days", label: "Betalingstermijn (dagen)", type: "number", span: 2, min: "0", max: "365" },
      { name: "notes", label: "Opmerkingen", type: "textarea", span: 6, maxLength: 5000 },
    ],
  },
];
