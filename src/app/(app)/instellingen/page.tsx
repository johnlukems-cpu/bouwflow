import type { Metadata } from "next";
import { Percent } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormAlert } from "@/components/ui/field";
import { FutureFeature } from "@/components/ui/future-feature";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { can, ROLE_LABELS } from "@/lib/auth/permissions";
import { listMembers } from "@/lib/data/projects";
import { listTaxRates } from "@/lib/data/settings";
import { updateTaxRate } from "./actions";
import { SettingsForm } from "./settings-form";
import { TaxRateForm } from "./tax-rate-form";

export const metadata: Metadata = { title: "Instellingen" };

export default async function SettingsPage() {
  const ctx = await getAppContext();
  const [taxRates, members] = await Promise.all([listTaxRates(ctx), listMembers(ctx)]);
  const canSettings = can(ctx.membership.role, "settings.write") && ctx.mode !== "demo";
  const canTax = can(ctx.membership.role, "tax_rates.write") && ctx.mode !== "demo";

  return (
    <>
      <PageHeader title="Instellingen" description="Bedrijfsgegevens, valuta, belastingtarieven en nummering van uw organisatie." />
      {ctx.mode === "demo" && (
        <div className="mb-6">
          <FormAlert tone="info" message="Demo-modus: instellingen zijn alleen-lezen." />
        </div>
      )}
      {!can(ctx.membership.role, "settings.write") && ctx.mode !== "demo" && (
        <div className="mb-6">
          <FormAlert tone="info" message="Alleen eigenaren en beheerders kunnen de organisatie-instellingen wijzigen." />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SettingsForm orgName={ctx.membership.organization.name} settings={ctx.settings} readOnly={!canSettings} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Belastingtarieven" description="BouwFlow neemt geen tarieven aan. Stel de voor uw land en situatie geldende tarieven zelf in." />
            {taxRates.length === 0 ? (
              <EmptyState icon={Percent} title="Nog geen tarieven" description="Voeg de geldende BTW-/omzetbelastingtarieven toe voordat u offertes of facturen maakt." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {taxRates.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                        {t.name} <span className="tabular-nums text-slate-500">{Number(t.rate_percent).toLocaleString("nl-NL")}%</span>
                        {t.is_default && <Badge tone="blue">Standaard</Badge>}
                        {t.is_archived && <Badge>Gearchiveerd</Badge>}
                      </p>
                      {t.description && <p className="truncate text-xs text-slate-500">{t.description}</p>}
                    </div>
                    {canTax && (
                      <form action={updateTaxRate} className="flex shrink-0 gap-1">
                        <input type="hidden" name="id" value={t.id} />
                        {!t.is_default && !t.is_archived && (
                          <button name="op" value="default" className="rounded px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">Standaard</button>
                        )}
                        <button name="op" value={t.is_archived ? "restore" : "archive"} className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                          {t.is_archived ? "Herstellen" : "Archiveren"}
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canTax && (
              <CardBody className="border-t border-slate-100">
                <TaxRateForm />
              </CardBody>
            )}
          </Card>

          <Card>
            <CardHeader title="Gebruikers en rollen" />
            <ul className="divide-y divide-slate-100">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-slate-900">{m.name}</span>
                  <Badge>{ROLE_LABELS[m.role]}</Badge>
                </li>
              ))}
            </ul>
            <CardBody className="border-t border-slate-100">
              <FutureFeature title="Collega's uitnodigen en rollen wijzigen" compact>
                Uitnodigen per e-mail en rollen beheren volgt in de module Medewerkers.
              </FutureFeature>
            </CardBody>
          </Card>

          <FutureFeature title="Abonnement en facturering">Beheer van het BouwFlow-abonnement per organisatie.</FutureFeature>
        </div>
      </div>
    </>
  );
}
