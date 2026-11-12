"use server";

import type { FormState } from "@/lib/actions";
import { saveEntity } from "@/lib/save";
import { employeeSchema } from "@/lib/validation/modules";

export async function saveEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  return saveEntity({
    table: "employees",
    schema: employeeSchema,
    permission: "employees.write",
    module: "medewerkers",
    formData,
    redirectTo: (id) => `/medewerkers/${id}`,
    revalidate: ["/medewerkers"],
  });
}
