"use client";

import { useActionState, useState } from "react";
import type { EntityFormState } from "@/components/ui/entity-form";
import { FormAlert } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { invoiceFromQuote } from "./actions";

export function InvoiceFromQuoteForm({ quoteId, disabled }: { quoteId: string; disabled?: boolean }) {
  const [state, action] = useActionState<EntityFormState, FormData>(invoiceFromQuote, {});
  const [type, setType] = useState("advance");
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="quote_id" value={quoteId} />
      <FormAlert message={state.message} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1.5 block font-medium text-slate-700">Soort factuur</span>
          <select name="invoice_type" value={type} onChange={(e) => setType(e.target.value)} className="h-11 w-full rounded-lg border-0 px-3 ring-1 ring-inset ring-slate-300 sm:h-10">
            <option value="advance">Voorschotfactuur (percentage)</option>
            <option value="installment">Termijnfactuur (percentage)</option>
            <option value="final">Eindfactuur (totaal minus eerdere termijnen)</option>
            <option value="standard">Volledige factuur</option>
          </select>
        </label>
        {(type === "advance" || type === "installment") && (
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-slate-700">Percentage</span>
            <input name="percent" inputMode="decimal" defaultValue="30" className="h-11 w-full rounded-lg border-0 px-3 tabular-nums ring-1 ring-inset ring-slate-300 sm:h-10" />
          </label>
        )}
      </div>
      <SubmitButton disabled={disabled} pendingText="Factuur wordt gemaakt…">Conceptfactuur maken</SubmitButton>
    </form>
  );
}
