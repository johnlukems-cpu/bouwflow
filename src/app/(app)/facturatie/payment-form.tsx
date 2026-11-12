"use client";

import { useActionState, useState } from "react";
import type { EntityFormState } from "@/components/ui/entity-form";
import { FormFields } from "@/components/ui/entity-form";
import { FormAlert } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { PAYMENT_METHOD_LABELS } from "@/lib/types";
import { registerPayment } from "./actions";

/** De sleutel wordt eenmalig per formulier gemaakt: dubbel verzenden levert één betaling op. */
export function PaymentForm({ invoiceId, outstanding, today, disabled }: { invoiceId: string; outstanding: string; today: string; disabled?: boolean }) {
  const [key] = useState(() => crypto.randomUUID());
  const [state, action] = useActionState<EntityFormState, FormData>(registerPayment, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <input type="hidden" name="idempotency_key" value={key} />
      <FormAlert message={state.message} />
      <FormFields
        values={state.values ?? { amount: outstanding.replace(".", ","), paid_on: today, method: "bank_transfer" }}
        errors={state.errors ?? {}}
        fields={[
          { name: "amount", label: "Bedrag", type: "decimal", required: true, span: 2 },
          { name: "paid_on", label: "Betaaldatum", type: "date", required: true, span: 2 },
          { name: "method", label: "Betaalwijze", type: "select", span: 2, options: Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ value, label })) },
          { name: "reference", label: "Referentie (bijv. bankreferentie)", span: 6 },
        ]}
      />
      <SubmitButton disabled={disabled} pendingText="Bezig…">Betaling registreren</SubmitButton>
    </form>
  );
}
