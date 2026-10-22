import { z } from "zod";
import { PROJECT_STATUSES } from "@/lib/types";
import { moneyAmount, optionalDate, optionalText, optionalUuid, requiredText } from "./common";

export const projectSchema = z
  .object({
    name: requiredText(200, "Projectnaam"),
    customer_id: z.uuid("Kies een klant"),
    location_address: optionalText(200, "Projectlocatie"),
    location_city: optionalText(100, "Plaats"),
    description: optionalText(10000, "Omschrijving"),
    start_date: optionalDate("Startdatum"),
    expected_end_date: optionalDate("Verwachte einddatum"),
    project_manager_member_id: optionalUuid("Projectleider"),
    status: z.enum(PROJECT_STATUSES as [string, ...string[]], { error: "Kies een geldige status" }),
    budget_amount: moneyAmount("Begroot budget"),
    contract_value: moneyAmount("Verkoopwaarde"),
  })
  .refine((p) => !p.start_date || !p.expected_end_date || p.expected_end_date >= p.start_date, {
    message: "De verwachte einddatum ligt vóór de startdatum",
    path: ["expected_end_date"],
  });

export type ProjectInput = z.infer<typeof projectSchema>;
