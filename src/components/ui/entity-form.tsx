"use client";

import { useActionState } from "react";
import { LinkButton } from "./button";
import { Card, CardBody, CardHeader } from "./card";
import { Field, FormAlert, Input, Select, Textarea } from "./field";
import { SubmitButton } from "./submit-button";
import { cn } from "./cn";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "date" | "time" | "decimal" | "textarea" | "select" | "checkbox";
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  placeholder?: string;
  /** Kolombreedte op desktop (van 6). Standaard 3 (halve breedte). */
  span?: 1 | 2 | 3 | 4 | 6;
  maxLength?: number;
  step?: string;
  min?: string;
  max?: string;
}

export interface FieldSection {
  title?: string;
  description?: string;
  fields: FieldDef[];
}

export interface EntityFormState {
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
  result?: string;
}

const SPAN: Record<number, string> = { 1: "sm:col-span-1", 2: "sm:col-span-2", 3: "sm:col-span-3", 4: "sm:col-span-4", 6: "sm:col-span-6" };

/** Formulierveld-renderer: gebruikt de gedeelde UI-componenten. */
export function FormFields({ fields, values, errors }: { fields: FieldDef[]; values: Record<string, string>; errors: Record<string, string> }) {
  return (
    <div className="grid gap-5 sm:grid-cols-6">
      {fields.map((f) => {
        const err = errors[f.name];
        const value = values[f.name] ?? "";
        const span = SPAN[f.span ?? 3];
        if (f.type === "checkbox") {
          return (
            <div key={f.name} className={cn("flex items-center gap-3 self-end pb-2", span)}>
              <input id={f.name} name={f.name} type="checkbox" defaultChecked={value === "true" || value === "on"} className="size-5 rounded accent-brand-700" />
              <label htmlFor={f.name} className="text-sm text-slate-700">
                {f.label}
              </label>
            </div>
          );
        }
        return (
          <Field key={f.name} label={f.label} name={f.name} error={err} hint={f.hint} required={f.required} className={span}>
            {f.type === "textarea" ? (
              <Textarea name={f.name} defaultValue={value} error={err} maxLength={f.maxLength} placeholder={f.placeholder} rows={4} />
            ) : f.type === "select" ? (
              <Select name={f.name} defaultValue={value} error={err} required={f.required}>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                name={f.name}
                type={f.type === "decimal" ? "text" : (f.type ?? "text")}
                inputMode={f.type === "decimal" ? "decimal" : f.type === "number" ? "numeric" : undefined}
                defaultValue={value}
                error={err}
                required={f.required}
                maxLength={f.maxLength}
                placeholder={f.placeholder}
                step={f.step}
                min={f.min}
                max={f.max}
                className={f.type === "decimal" ? "tabular-nums" : undefined}
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}

/** Generiek formulier voor aanmaken/wijzigen met server-side validatie. */
export function EntityForm({
  action,
  sections,
  initialValues = {},
  hidden = {},
  submitLabel,
  cancelHref,
  readOnly,
  readOnlyMessage = "Demo-modus: u kunt dit formulier bekijken, maar wijzigingen worden niet opgeslagen.",
}: {
  action: (state: EntityFormState, formData: FormData) => Promise<EntityFormState>;
  sections: FieldSection[];
  initialValues?: Record<string, string>;
  hidden?: Record<string, string>;
  submitLabel: string;
  cancelHref?: string;
  readOnly?: boolean;
  readOnlyMessage?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const values = state.values ?? initialValues;
  return (
    <form action={formAction} noValidate className="space-y-6">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <FormAlert message={state.message} />
      {readOnly && <FormAlert tone="info" message={readOnlyMessage} />}
      {sections.map((s, i) => (
        <Card key={s.title ?? i}>
          {s.title && <CardHeader title={s.title} description={s.description} />}
          <CardBody>
            <FormFields fields={s.fields} values={values} errors={state.errors ?? {}} />
          </CardBody>
        </Card>
      ))}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {cancelHref && (
          <LinkButton href={cancelHref} variant="secondary">
            Annuleren
          </LinkButton>
        )}
        <SubmitButton disabled={readOnly}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

/** Compact inline-formulier (bijv. regel toevoegen) dat na succes leeg wordt. */
export function InlineForm({
  action,
  fields,
  hidden = {},
  submitLabel,
  disabled,
  initialValues = {},
}: {
  action: (state: EntityFormState, formData: FormData) => Promise<EntityFormState>;
  fields: FieldDef[];
  hidden?: Record<string, string>;
  submitLabel: string;
  disabled?: boolean;
  initialValues?: Record<string, string>;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} noValidate className="space-y-4" key={state.result ?? "form"}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <FormAlert message={state.message} />
      <FormFields fields={fields} values={state.values ?? initialValues} errors={state.errors ?? {}} />
      <SubmitButton variant="secondary" disabled={disabled}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
