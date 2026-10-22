"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormAlert, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { signUp, type AuthFormState } from "../actions";

export function SignUpForm({ disabled }: { disabled?: boolean }) {
  const [state, action] = useActionState<AuthFormState, FormData>(signUp, {});
  if (state.info) return <FormAlert tone="info" message={state.info} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormAlert message={state.message} />
      <Field label="Uw naam" name="full_name" error={state.errors?.full_name} required>
        <Input name="full_name" autoComplete="name" required defaultValue={state.values?.full_name} error={state.errors?.full_name} disabled={disabled} />
      </Field>
      <Field label="E-mailadres" name="email" error={state.errors?.email} required>
        <Input name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.errors?.email} disabled={disabled} />
      </Field>
      <Field label="Wachtwoord" name="password" error={state.errors?.password} hint="Minimaal 10 tekens, met letters en cijfers." required>
        <Input name="password" type="password" autoComplete="new-password" required minLength={10} error={state.errors?.password} disabled={disabled} />
      </Field>
      <SubmitButton className="w-full" pendingText="Account wordt aangemaakt…" disabled={disabled}>
        Account aanmaken
      </SubmitButton>
      <p className="text-center text-sm text-slate-600">
        Heeft u al een account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Inloggen
        </Link>
      </p>
    </form>
  );
}
