"use client";

import { useActionState } from "react";
import { Field, FormAlert, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { updatePassword, type AuthFormState } from "../(auth)/actions";

export function NewPasswordForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(updatePassword, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormAlert message={state.message} />
      <Field label="Nieuw wachtwoord" name="password" error={state.errors?.password} hint="Minimaal 10 tekens, met letters en cijfers." required>
        <Input name="password" type="password" autoComplete="new-password" required error={state.errors?.password} />
      </Field>
      <Field label="Herhaal wachtwoord" name="confirm" error={state.errors?.confirm} required>
        <Input name="confirm" type="password" autoComplete="new-password" required error={state.errors?.confirm} />
      </Field>
      <SubmitButton className="w-full">Wachtwoord opslaan</SubmitButton>
    </form>
  );
}
