"use client";

import { useActionState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, FormAlert, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/actions";
import { REVENUE_BASIS_LABELS } from "@/lib/finance/postcalc";
import type { OrganizationSettings } from "@/lib/types";
import { saveSettings } from "./actions";

export function SettingsForm({ orgName, settings, readOnly }: { orgName: string; settings: OrganizationSettings; readOnly: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(saveSettings, {});
  const e = state.errors ?? {};
  const v = (k: keyof OrganizationSettings | "org_name") =>
    state.values?.[k] ?? (k === "org_name" ? orgName : String(settings[k as keyof OrganizationSettings] ?? ""));

  return (
    <form action={action} noValidate className="space-y-6">
      <FormAlert message={state.message} />
      <fieldset disabled={readOnly} className="space-y-6">
        <Card>
          <CardHeader title="Bedrijfsgegevens" description="Worden gebruikt op offertes en facturen." />
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <Field label="Organisatienaam" name="org_name" error={e.org_name} required>
              <Input name="org_name" defaultValue={v("org_name")} error={e.org_name} required />
            </Field>
            <Field label="Statutaire naam" name="legal_name" error={e.legal_name}>
              <Input name="legal_name" defaultValue={v("legal_name")} error={e.legal_name} />
            </Field>
            <Field label="KvK-nummer" name="chamber_of_commerce_no" error={e.chamber_of_commerce_no}>
              <Input name="chamber_of_commerce_no" defaultValue={v("chamber_of_commerce_no")} error={e.chamber_of_commerce_no} />
            </Field>
            <Field label="BTW-nummer" name="vat_number" error={e.vat_number}>
              <Input name="vat_number" defaultValue={v("vat_number")} error={e.vat_number} />
            </Field>
            <Field label="Adres" name="address_line" error={e.address_line} className="sm:col-span-2">
              <Input name="address_line" defaultValue={v("address_line")} error={e.address_line} />
            </Field>
            <Field label="Postcode" name="postal_code" error={e.postal_code}>
              <Input name="postal_code" defaultValue={v("postal_code")} error={e.postal_code} />
            </Field>
            <Field label="Plaats" name="city" error={e.city}>
              <Input name="city" defaultValue={v("city")} error={e.city} />
            </Field>
            <Field label="Land (2 letters)" name="country_code" error={e.country_code}>
              <Input name="country_code" defaultValue={v("country_code")} error={e.country_code} maxLength={2} className="uppercase" />
            </Field>
            <Field label="Telefoon" name="phone" error={e.phone}>
              <Input name="phone" type="tel" defaultValue={v("phone")} error={e.phone} />
            </Field>
            <Field label="E-mailadres" name="email" error={e.email}>
              <Input name="email" type="email" defaultValue={v("email")} error={e.email} />
            </Field>
            <Field label="Website" name="website" error={e.website}>
              <Input name="website" defaultValue={v("website")} error={e.website} />
            </Field>
            <Field label="Bankrekening" name="iban" error={e.iban} className="sm:col-span-2">
              <Input name="iban" defaultValue={v("iban")} error={e.iban} />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Valuta, taal en belasting" />
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <Field label="Standaardvaluta" name="currency_code" error={e.currency_code} hint="ISO-code, bijv. SRD, USD of EUR. Bestaande projecten behouden hun valuta.">
              <Input name="currency_code" defaultValue={v("currency_code")} error={e.currency_code} maxLength={3} className="uppercase" />
            </Field>
            <Field label="Taal en notatie" name="locale" error={e.locale}>
              <Select name="locale" defaultValue={v("locale")} error={e.locale}>
                <option value="nl-SR">Nederlands (Suriname)</option>
                <option value="nl-NL">Nederlands (Nederland)</option>
                <option value="nl-BE">Nederlands (België)</option>
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
              </Select>
            </Field>
            <Field label="Tijdzone" name="timezone" error={e.timezone} hint="Bijv. America/Paramaribo">
              <Input name="timezone" defaultValue={v("timezone")} error={e.timezone} />
            </Field>
            <div className="flex items-center gap-3 self-end pb-2">
              <input
                id="prices_include_vat"
                name="prices_include_vat"
                type="checkbox"
                defaultChecked={state.values ? state.values.prices_include_vat === "on" : settings.prices_include_vat}
                className="size-4 rounded accent-brand-600"
              />
              <label htmlFor="prices_include_vat" className="text-sm text-slate-700">Verkoopprijzen zijn inclusief belasting</label>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Offertes, facturen en na-calculatie" />
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <Field label="Betalingstermijn (dagen)" name="payment_term_days" error={e.payment_term_days}>
              <Input name="payment_term_days" type="number" min={0} max={365} defaultValue={v("payment_term_days")} error={e.payment_term_days} />
            </Field>
            <Field label="Geldigheid offerte (dagen)" name="quote_validity_days" error={e.quote_validity_days}>
              <Input name="quote_validity_days" type="number" min={0} max={365} defaultValue={v("quote_validity_days")} error={e.quote_validity_days} />
            </Field>
            <Field label="Budgetwaarschuwing vanaf (% van budget)" name="budget_warning_percent" error={e.budget_warning_percent}>
              <Input name="budget_warning_percent" type="number" min={1} max={1000} defaultValue={String(Math.round(Number(v("budget_warning_percent"))))} error={e.budget_warning_percent} />
            </Field>
            <Field
              label="Omzetbasis voor projectresultaat"
              name="revenue_basis"
              error={e.revenue_basis}
              hint="Bepaalt welke omzet in de na-calculatie als 'gerealiseerd' geldt. Gefactureerde omzet, ontvangen betalingen en verkoopwaarde blijven altijd afzonderlijk zichtbaar."
            >
              <Select name="revenue_basis" defaultValue={v("revenue_basis")} error={e.revenue_basis}>
                {Object.entries(REVENUE_BASIS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </Select>
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Nummering" description="Voorvoegsels voor automatisch toegekende nummers. Bestaande nummers veranderen niet." />
          <CardBody className="grid gap-5 sm:grid-cols-4">
            <Field label="Klanten" name="customer_number_prefix" error={e.customer_number_prefix} hint="K-00001">
              <Input name="customer_number_prefix" defaultValue={v("customer_number_prefix")} error={e.customer_number_prefix} maxLength={10} className="uppercase" />
            </Field>
            <Field label="Projecten" name="project_number_prefix" error={e.project_number_prefix} hint="P-2026-0001">
              <Input name="project_number_prefix" defaultValue={v("project_number_prefix")} error={e.project_number_prefix} maxLength={10} className="uppercase" />
            </Field>
            <Field label="Offertes" name="quote_number_prefix" error={e.quote_number_prefix}>
              <Input name="quote_number_prefix" defaultValue={v("quote_number_prefix")} error={e.quote_number_prefix} maxLength={10} className="uppercase" />
            </Field>
            <Field label="Facturen" name="invoice_number_prefix" error={e.invoice_number_prefix}>
              <Input name="invoice_number_prefix" defaultValue={v("invoice_number_prefix")} error={e.invoice_number_prefix} maxLength={10} className="uppercase" />
            </Field>
          </CardBody>
        </Card>
      </fieldset>

      {!readOnly && (
        <div className="flex justify-end">
          <SubmitButton>Instellingen opslaan</SubmitButton>
        </div>
      )}
    </form>
  );
}
