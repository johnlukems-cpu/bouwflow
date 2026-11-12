"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormAlert, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestPasswordReset, type AuthFormState } from "../actions";

export function ResetRequestForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(requestPasswordReset, {});
  if (state.info) return <FormAlert tone="info" message={state.info} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormAlert message={state.message} />
      <Field label="E-mailadres" name="email" error={state.errors?.email} required>
        <Input name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.errors?.email} />
      </Field>
      <SubmitButton className="w-full">Herstellink versturen</SubmitButton>
      <p className="text-center text-sm"><Link href="/login" className="font-medium text-brand-700 hover:underline">Terug naar inloggen</Link></p>
    </form>
  );
}
