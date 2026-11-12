"use server";

import type { FormState } from "@/lib/actions";
import { saveEntity, setArchived } from "@/lib/save";
import { materialSchema } from "@/lib/validation/modules";

export async function saveMaterial(_prev: FormState, formData: FormData): Promise<FormState> {
  return saveEntity({
    table: "materials",
    schema: materialSchema,
    permission: "materials.write",
    module: "materialen",
    formData,
    redirectTo: (id) => `/materialen/${id}`,
    revalidate: ["/materialen", "/voorraad"],
  });
}

export async function archiveMaterial(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await setArchived({ table: "materials", id, archive: formData.get("archive") === "true", permission: "materials.write", module: "materialen", backTo: `/materialen/${id}`, revalidate: ["/materialen"] });
}
