"use client";

import { useActionState } from "react";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, FormAlert, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/actions";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, type MemberOption, type Project } from "@/lib/types";
import { saveProject } from "./actions";

interface Props {
  project?: Project;
  customers: { id: string; name: string; customer_number: string }[];
  members: MemberOption[];
  defaultCustomerId?: string;
  currency: string;
  readOnly?: boolean;
}

/** Bedragen tonen in invoervelden met komma als decimaalteken. */
function amountForInput(v: string | undefined) {
  if (!v) return "";
  return v.replace(".", ",");
}

export function ProjectForm({ project, customers, members, defaultCustomerId, currency, readOnly }: Props) {
  const [state, action] = useActionState<FormState, FormData>(saveProject, {});
  const e = state.errors ?? {};
  const v = (k: keyof Project) => state.values?.[k] ?? (project?.[k] as string | null | undefined) ?? "";

  // Een gearchiveerde klant van een bestaand project blijft selecteerbaar.
  const customerOptions = project?.customer && !customers.some((c) => c.id === project.customer_id)
    ? [...customers, { id: project.customer_id, name: `${project.customer.name} (gearchiveerd)`, customer_number: project.customer.customer_number }]
    : customers;

  return (
    <form action={action} noValidate className="space-y-6">
      {project && <input type="hidden" name="id" value={project.id} />}
      <FormAlert message={state.message} />
      {readOnly && <FormAlert tone="info" message="Demo-modus: u kunt dit formulier bekijken, maar wijzigingen worden niet opgeslagen." />}

      <Card>
        <CardHeader title="Algemeen" />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <Field label="Projectnaam" name="name" error={e.name} required className="sm:col-span-2">
            <Input name="name" defaultValue={v("name")} error={e.name} required maxLength={200} />
          </Field>
          <Field label="Klant" name="customer_id" error={e.customer_id} required hint={customers.length === 0 ? "Maak eerst een klant aan." : undefined}>
            <Select name="customer_id" defaultValue={v("customer_id") || defaultCustomerId || ""} error={e.customer_id} required>
              <option value="">Kies een klant…</option>
              {customerOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.customer_number})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" name="status" error={e.status} required>
            <Select name="status" defaultValue={v("status") || "concept"} error={e.status}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Projectleider" name="project_manager_member_id" error={e.project_manager_member_id}>
            <Select name="project_manager_member_id" defaultValue={v("project_manager_member_id")} error={e.project_manager_member_id}>
              <option value="">Nog niet toegewezen</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {ROLE_LABELS[m.role]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Omschrijving" name="description" error={e.description} className="sm:col-span-2">
            <Textarea name="description" defaultValue={v("description")} error={e.description} maxLength={10000} rows={4} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Locatie en planning" />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <Field label="Projectlocatie (adres)" name="location_address" error={e.location_address}>
            <Input name="location_address" defaultValue={v("location_address")} error={e.location_address} maxLength={200} />
          </Field>
          <Field label="Plaats / district" name="location_city" error={e.location_city}>
            <Input name="location_city" defaultValue={v("location_city")} error={e.location_city} maxLength={100} />
          </Field>
          <Field label="Startdatum" name="start_date" error={e.start_date}>
            <Input name="start_date" type="date" defaultValue={v("start_date")} error={e.start_date} />
          </Field>
          <Field label="Verwachte einddatum" name="expected_end_date" error={e.expected_end_date}>
            <Input name="expected_end_date" type="date" defaultValue={v("expected_end_date")} error={e.expected_end_date} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Financieel" description={`Bedragen in ${project?.currency_code ?? currency}. De gedetailleerde voorcalculatie volgt in de module Materiaalberekening.`} />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <Field label="Begroot budget (kosten)" name="budget_amount" error={e.budget_amount} hint="Bijv. 125.000,00">
            <Input name="budget_amount" inputMode="decimal" defaultValue={state.values?.budget_amount ?? amountForInput(project?.budget_amount)} error={e.budget_amount} className="tabular-nums" />
          </Field>
          <Field label="Verkoopwaarde (opdrachtsom)" name="contract_value" error={e.contract_value} hint="Bijv. 160.000,00">
            <Input name="contract_value" inputMode="decimal" defaultValue={state.values?.contract_value ?? amountForInput(project?.contract_value)} error={e.contract_value} className="tabular-nums" />
          </Field>
        </CardBody>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <LinkButton href={project ? `/projecten/${project.id}` : "/projecten"} variant="secondary">
          Annuleren
        </LinkButton>
        <SubmitButton disabled={readOnly}>{project ? "Wijzigingen opslaan" : "Project aanmaken"}</SubmitButton>
      </div>
    </form>
  );
}
