"use client";

import { Check, Copy } from "lucide-react";
import { useActionState, useState } from "react";
import type { EntityFormState } from "@/components/ui/entity-form";
import { FormAlert } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { createPortalLink } from "./actions";

export function CreatePortalLink({ customerId, disabled }: { customerId: string; disabled?: boolean }) {
  const [state, action] = useActionState<EntityFormState, FormData>(createPortalLink, {});
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <FormAlert message={state.message} />
      {state.result && (
        <div className="space-y-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200" role="status">
          <p className="font-medium">Persoonlijke link (90 dagen geldig, eenmalig zichtbaar):</p>
          <div className="flex gap-2">
            <input readOnly value={state.result} aria-label="Portaallink" onFocus={(e) => e.currentTarget.select()} className="h-10 flex-1 rounded-lg border-0 bg-white px-3 text-xs ring-1 ring-emerald-300" />
            <button type="button" onClick={async () => { await navigator.clipboard.writeText(state.result!); setCopied(true); }} className="inline-flex h-10 items-center gap-1 rounded-lg bg-white px-3 font-medium ring-1 ring-emerald-300">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Kopiëren
            </button>
          </div>
        </div>
      )}
      <form action={action}>
        <input type="hidden" name="customer_id" value={customerId} />
        <SubmitButton variant="secondary" disabled={disabled} pendingText="Bezig…">Nieuwe portaallink maken</SubmitButton>
      </form>
    </div>
  );
}
