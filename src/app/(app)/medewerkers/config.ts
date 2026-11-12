import type { FieldSection } from "@/components/ui/entity-form";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { MemberOption } from "@/lib/types";

export function employeeSections(members: MemberOption[]): FieldSection[] {
  return [
    {
      title: "Medewerker",
      fields: [
        { name: "full_name", label: "Naam", required: true, span: 4 },
        { name: "job_title", label: "Functie", span: 2 },
        { name: "email", label: "E-mailadres", type: "email" },
        { name: "phone", label: "Telefoonnummer", type: "tel" },
        {
          name: "member_id",
          label: "Gekoppeld gebruikersaccount",
          type: "select",
          span: 4,
          hint: "Koppel een account zodat deze medewerker eigen uren en werkbonnen kan registreren.",
          options: [{ value: "", label: "Geen account" }, ...members.map((m) => ({ value: m.id, label: `${m.name} — ${ROLE_LABELS[m.role]}` }))],
        },
        { name: "is_active", label: "Actief", type: "checkbox", span: 2 },
      ],
    },
    {
      title: "Tarieven",
      description: "De interne kostprijs wordt gebruikt voor werkelijke arbeidskosten in de na-calculatie (momentopname bij goedkeuring).",
      fields: [
        { name: "hourly_cost", label: "Interne kostprijs per uur", type: "decimal", hint: "Loon + werkgeverslasten + overhead" },
        { name: "hourly_rate", label: "Verkooptarief per uur", type: "decimal" },
        { name: "notes", label: "Opmerkingen", type: "textarea", span: 6 },
      ],
    },
  ];
}
