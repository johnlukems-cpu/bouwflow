import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { QuoteTable } from "@/components/lists/documents-lists";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listQuotes } from "@/lib/data/finance";
import { todayISO } from "@/lib/format";
import { QUOTE_STATUS_LABELS } from "@/lib/types";

export const metadata: Metadata = { title: "Offertes" };

export default async function QuotesPage({ searchParams }: PageProps<"/offertes">) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const status = typeof sp.status === "string" && sp.status in QUOTE_STATUS_LABELS ? sp.status : "";
  const quotes = await listQuotes(ctx, { status });
  return (
    <ModuleGate ctx={ctx} module="offertes">
      <PageHeader
        title="Offertes"
        description="Offerte → verzenden (vergrendeld met momentopname) → accepteren → facturen."
        actions={can(ctx.membership.role, "quotes.write") && <LinkButton href="/offertes/nieuw"><Plus className="size-4" aria-hidden /> Nieuwe offerte</LinkButton>}
      />
      <Card>
        <FilterBar placeholder="Filter op status">
          <FilterSelect name="status" label="Status" value={status} options={[{ value: "", label: "Alle statussen" }, ...Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => ({ value, label }))]} />
        </FilterBar>
        <QuoteTable quotes={quotes} locale={ctx.settings.locale} today={todayISO(ctx.settings.timezone)} />
      </Card>
    </ModuleGate>
  );
}
