"use client";

import { Check, Copy } from "lucide-react";
import { useActionState, useState } from "react";
import { FormFields, type EntityFormState } from "@/components/ui/entity-form";
import { FormAlert } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { createInvitation } from "./actions";

export function InviteForm({ disabled }: { disabled?: boolean }) {
  const [state, action] = useActionState<EntityFormState, FormData>(createInvitation, {});
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4">
      {state.result && (
        <div className="space-y-2 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200" role="status">
          <p className="font-medium">Uitnodiging aangemaakt. Deel deze link met uw collega (7 dagen geldig, eenmalig zichtbaar):</p>
          <div className="flex gap-2">
            <input readOnly value={state.result} className="h-10 flex-1 rounded-lg border-0 bg-white px-3 text-xs ring-1 ring-emerald-300" onFocus={(e) => e.currentTarget.select()} aria-label="Uitnodigingslink" />
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(state.result!);
                setCopied(true);
              }}
              className="inline-flex h-10 items-center gap-1 rounded-lg bg-white px-3 font-medium ring-1 ring-emerald-300"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Kopiëren
            </button>
          </div>
          <p className="text-xs">E-mailverzending is nog niet gekoppeld; BouwFlow verstuurt deze uitnodiging niet zelf.</p>
        </div>
      )}
      <form action={action} className="space-y-4" noValidate>
        <FormAlert message={state.message} />
        <FormFields
          values={state.values ?? { role: "employee" }}
          errors={state.errors ?? {}}
          fields={[
            { name: "email", label: "E-mailadres", type: "email", required: true, span: 4 },
            { name: "role", label: "Rol", type: "select", span: 2, options: (["admin", "manager", "finance", "employee", "viewer"] as const).map((r) => ({ value: r, label: ROLE_LABELS[r] })) },
          ]}
        />
        <SubmitButton disabled={disabled}>Uitnodigen</SubmitButton>
      </form>
    </div>
  );
}
