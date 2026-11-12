"use server";

import type { FormState } from "@/lib/actions";
import { saveEntity } from "@/lib/save";
import { stockMovementSchema } from "@/lib/validation/modules";

export async function saveStockMovement(_prev: FormState, formData: FormData): Promise<FormState> {
  formData.delete("id"); // mutaties zijn onwijzigbaar: altijd een nieuwe boeking
  return saveEntity({
    table: "stock_movements",
    schema: stockMovementSchema,
    permission: "stock.write",
    module: "voorraad",
    formData,
    redirectTo: () => "/voorraad",
    flash: "voorraad-geboekt",
    revalidate: ["/voorraad", "/materialen"],
  });
}
