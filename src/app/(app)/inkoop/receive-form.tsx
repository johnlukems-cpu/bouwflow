"use client";

import { useActionState, useState } from "react";
import { FormAlert } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { EntityFormState } from "@/components/ui/entity-form";
import { receivePurchaseLine } from "./actions";

/** Ontvangstformulier per regel; de sleutel blijft gelijk zolang het formulier open is (geen dubbele boeking). */
export function ReceiveForm({ lineId, orderId, remaining, today, unit, disabled }: { lineId: string; orderId: string; remaining: string; today: string; unit: string; disabled?: boolean }) {
  const [key] = useState(() => crypto.randomUUID());
  const [state, action] = useActionState<EntityFormState, FormData>(receivePurchaseLine, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="line_id" value={lineId} />
      <input type="hidden" name="purchase_order_id" value={orderId} />
      <input type="hidden" name="idempotency_key" value={key} />
      <label className="text-xs">
        <span className="mb-1 block text-slate-600">Ontvangen ({unit})</span>
        <input name="quantity" inputMode="decimal" defaultValue={remaining.replace(".", ",")} className="h-10 w-28 rounded-lg border-0 px-2 text-sm tabular-nums ring-1 ring-inset ring-slate-300" />
      </label>
      <label className="text-xs">
        <span className="mb-1 block text-slate-600">Datum</span>
        <input name="received_on" type="date" defaultValue={today} className="h-10 rounded-lg border-0 px-2 text-sm ring-1 ring-inset ring-slate-300" />
      </label>
      <SubmitButton size="sm" variant="info" disabled={disabled} pendingText="Boeken…">Ontvangst boeken</SubmitButton>
      {state.message && <div className="w-full"><FormAlert message={state.message} /></div>}
      {state.errors && <p className="w-full text-sm text-red-600">{Object.values(state.errors)[0]}</p>}
    </form>
  );
}
