"use client";

import { useActionState, useState } from "react";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, FormAlert, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/actions";
import type { Customer } from "@/lib/types";
import { saveCustomer } from "./actions";

export function CustomerForm({ customer, readOnly }: { customer?: Customer; readOnly?: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(saveCustomer, {});
  const v = (k: keyof Customer) => state.values?.[k] ?? (customer?.[k] as string | null | undefined) ?? "";
  const [type, setType] = useState(v("customer_type") || "business");
  const e = state.errors ?? {};

  return (
    <form action={action} noValidate className="space-y-6">
      {customer && <input type="hidden" name="id" value={customer.id} />}
      <FormAlert message={state.message} />
      {readOnly && <FormAlert tone="info" message="Demo-modus: u kunt dit formulier bekijken, maar wijzigingen worden niet opgeslagen." />}

      <Card>
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium text-slate-700">Soort klant</legend>
            <div className="flex flex-wrap gap-3">
              {[
                { value: "business", label: "Zakelijk" },
                { value: "private", label: "Particulier" },
              ].map((o) => (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm ring-1 ring-slate-300 has-[:checked]:bg-brand-50 has-[:checked]:ring-2 has-[:checked]:ring-brand-500"
                >
                  <input type="radio" name="customer_type" value={o.value} checked={type === o.value} onChange={() => setType(o.value)} className="accent-brand-600" />
                  {o.label}
                </label>
              ))}
            </div>
            {e.customer_type && <p className="mt-1 text-sm text-red-600">{e.customer_type}</p>}
          </fieldset>

          <Field label={type === "business" ? "Bedrijfsnaam" : "Naam"} name="name" error={e.name} required className="sm:col-span-2">
            <Input name="name" defaultValue={v("name")} error={e.name} required maxLength={200} autoComplete={type === "business" ? "organization" : "name"} />
          </Field>
          {type === "business" && (
            <Field label="Contactpersoon" name="contact_person" error={e.contact_person}>
              <Input name="contact_person" defaultValue={v("contact_person")} error={e.contact_person} maxLength={200} />
            </Field>
          )}
          {type === "business" && (
            <Field label="BTW-nummer" name="vat_number" error={e.vat_number} hint="Indien van toepassing">
              <Input name="vat_number" defaultValue={v("vat_number")} error={e.vat_number} maxLength={50} />
            </Field>
          )}
          <Field label="E-mailadres" name="email" error={e.email}>
            <Input name="email" type="email" inputMode="email" defaultValue={v("email")} error={e.email} maxLength={200} autoComplete="email" />
          </Field>
          <Field label="Telefoonnummer" name="phone" error={e.phone}>
            <Input name="phone" type="tel" inputMode="tel" defaultValue={v("phone")} error={e.phone} maxLength={50} autoComplete="tel" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="grid gap-5 sm:grid-cols-6">
          <Field label="Adres" name="address_line" error={e.address_line} className="sm:col-span-6">
            <Input name="address_line" defaultValue={v("address_line")} error={e.address_line} maxLength={200} autoComplete="street-address" />
          </Field>
          <Field label="Postcode" name="postal_code" error={e.postal_code} className="sm:col-span-2">
            <Input name="postal_code" defaultValue={v("postal_code")} error={e.postal_code} maxLength={20} autoComplete="postal-code" />
          </Field>
          <Field label="Plaats / district" name="city" error={e.city} className="sm:col-span-3">
            <Input name="city" defaultValue={v("city")} error={e.city} maxLength={100} />
          </Field>
          <Field label="Land" name="country_code" error={e.country_code} hint="2 letters" className="sm:col-span-1">
            <Input name="country_code" defaultValue={v("country_code") || "SR"} error={e.country_code} maxLength={2} className="uppercase" />
          </Field>
          <Field label="Opmerkingen" name="notes" error={e.notes} className="sm:col-span-6">
            <Textarea name="notes" defaultValue={v("notes")} error={e.notes} maxLength={5000} rows={4} />
          </Field>
        </CardBody>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <LinkButton href={customer ? `/klanten/${customer.id}` : "/klanten"} variant="secondary">
          Annuleren
        </LinkButton>
        <SubmitButton disabled={readOnly}>{customer ? "Wijzigingen opslaan" : "Klant aanmaken"}</SubmitButton>
      </div>
    </form>
  );
}
