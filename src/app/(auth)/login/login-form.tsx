"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormAlert, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { signIn, type AuthFormState } from "../actions";

export function LoginForm({ next, disabled }: { next?: string; disabled?: boolean }) {
  const [state, action] = useActionState<AuthFormState, FormData>(signIn, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormAlert message={state.message} />
      {next && <input type="hidden" name="volgende" value={next} />}
      <Field label="E-mailadres" name="email" error={state.errors?.email} required>
        <Input name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.errors?.email} disabled={disabled} />
      </Field>
      <Field label="Wachtwoord" name="password" error={state.errors?.password} required>
        <Input name="password" type="password" autoComplete="current-password" required error={state.errors?.password} disabled={disabled} />
      </Field>
      <SubmitButton className="w-full" pendingText="Bezig met inloggen…" disabled={disabled}>
        Inloggen
      </SubmitButton>
      <p className="text-center text-sm text-slate-600">
        Nog geen account?{" "}
        <Link href="/registreren" className="font-medium text-brand-700 hover:underline">
          Registreer uw bedrijf
        </Link>
      </p>
    </form>
  );
}
