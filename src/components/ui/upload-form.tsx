"use client";

import { useActionState } from "react";
import { uploadDocument } from "@/app/(app)/documenten/actions";
import type { EntityFormState } from "./entity-form";
import { Field, FormAlert, Select } from "./field";
import { SubmitButton } from "./submit-button";

export function UploadForm({ hidden, disabled, photoOnly }: { hidden: Record<string, string>; disabled?: boolean; photoOnly?: boolean }) {
  const [state, action] = useActionState<EntityFormState, FormData>(uploadDocument, {});
  return (
    <form action={action} className="space-y-4">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <FormAlert message={state.message} />
      {disabled && <FormAlert tone="info" message="Uploaden is beschikbaar zodra Supabase (opslag) is gekoppeld." />}
      <div className="grid gap-4 sm:grid-cols-6">
        <Field label={photoOnly ? "Foto" : "Bestand"} name="file" error={state.errors?.file} hint="Max. 25 MB · PDF, afbeeldingen, Word, Excel, CSV" className="sm:col-span-4">
          <input
            id="file"
            name="file"
            type="file"
            required
            accept={photoOnly ? "image/*" : ".pdf,image/*,.doc,.docx,.xls,.xlsx,.csv,.txt"}
            capture={photoOnly ? "environment" : undefined}
            disabled={disabled}
            className="block w-full rounded-lg text-sm text-slate-700 ring-1 ring-inset ring-slate-300 file:mr-3 file:h-11 file:border-0 file:bg-brand-50 file:px-4 file:font-medium file:text-brand-700"
          />
        </Field>
        {!photoOnly && (
          <Field label="Soort" name="category" className="sm:col-span-2">
            <Select name="category" defaultValue="overig" disabled={disabled}>
              <option value="tekening">Tekening</option>
              <option value="vergunning">Vergunning</option>
              <option value="foto">Foto</option>
              <option value="contract">Contract</option>
              <option value="overig">Overig</option>
            </Select>
          </Field>
        )}
      </div>
      <SubmitButton variant="secondary" disabled={disabled} pendingText="Bezig met uploaden…">
        Uploaden
      </SubmitButton>
    </form>
  );
}
