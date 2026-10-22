"use client";

import { useActionState } from "react";
import { Field, FormAlert, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/actions";
import { addTaxRate } from "./actions";

export function TaxRateForm() {
  const [state, action] = useActionState<FormState, FormData>(addTaxRate, {});
  const e = state.errors ?? {};
  return (
    <form action={action} noValidate className="space-y-4">
      <FormAlert message={state.message} />
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Naam" name="name" error={e.name} required className="sm:col-span-2">
          <Input name="name" placeholder="Bijv. BTW standaard" defaultValue={state.values?.name} error={e.name} />
        </Field>
        <Field label="Percentage" name="rate_percent" error={e.rate_percent} required>
          <Input name="rate_percent" inputMode="decimal" placeholder="Bijv. 10" defaultValue={state.values?.rate_percent} error={e.rate_percent} />
        </Field>
        <div className="flex items-center gap-2 sm:self-end sm:pb-2.5">
          <input id="is_default" name="is_default" type="checkbox" className="size-4 accent-brand-600" />
          <label htmlFor="is_default" className="text-sm text-slate-700">Standaard</label>
        </div>
        <Field label="Toelichting" name="description" error={e.description} className="sm:col-span-4" hint="Bijv. de wettelijke grondslag of de datum waarop dit tarief ingaat.">
          <Input name="description" defaultValue={state.values?.description} error={e.description} />
        </Field>
      </div>
      <SubmitButton variant="secondary">Tarief toevoegen</SubmitButton>
    </form>
  );
}
