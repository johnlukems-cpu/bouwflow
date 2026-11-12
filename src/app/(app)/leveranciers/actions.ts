"use server";

import type { FormState } from "@/lib/actions";
import { saveEntity, setArchived } from "@/lib/save";
import { supplierSchema } from "@/lib/validation/modules";

export async function saveSupplier(_prev: FormState, formData: FormData): Promise<FormState> {
  return saveEntity({
    table: "suppliers",
    schema: supplierSchema,
    permission: "suppliers.write",
    module: "leveranciers",
    formData,
    redirectTo: (id) => `/leveranciers/${id}`,
    revalidate: ["/leveranciers"],
  });
}

export async function archiveSupplier(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await setArchived({ table: "suppliers", id, archive: formData.get("archive") === "true", permission: "suppliers.write", module: "leveranciers", backTo: `/leveranciers/${id}`, revalidate: ["/leveranciers"] });
}
