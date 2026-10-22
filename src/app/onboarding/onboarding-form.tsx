"use client";

import { useActionState } from "react";
import { Field, FormAlert, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { createOrganization, type AuthFormState } from "../(auth)/actions";

export function OnboardingForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(createOrganization, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormAlert message={state.message} />
      <Field label="Bedrijfsnaam" name="name" error={state.errors?.name} required hint="U kunt bedrijfsgegevens, valuta en belastingtarieven later aanpassen bij Instellingen.">
        <Input name="name" required autoComplete="organization" defaultValue={state.values?.name} error={state.errors?.name} />
      </Field>
      <SubmitButton className="w-full" pendingText="Organisatie wordt aangemaakt…">
        Organisatie aanmaken
      </SubmitButton>
    </form>
  );
}
