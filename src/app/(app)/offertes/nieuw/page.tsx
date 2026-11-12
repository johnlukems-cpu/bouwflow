import type { Metadata } from "next";
import { EntityForm } from "@/components/ui/entity-form";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { listCustomerOptions } from "@/lib/data/customers";
import { getProject, listProjects, parseProjectFilters } from "@/lib/data/projects";
import { todayISO } from "@/lib/format";
import { saveQuote } from "../actions";
import { quoteSections } from "../config";

export const metadata: Metadata = { title: "Nieuwe offerte" };

export default async function NewQuotePage({ searchParams }: PageProps<"/offertes/nieuw">) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const projectId = typeof sp.project === "string" ? sp.project : "";
  const [customers, projects, project] = await Promise.all([listCustomerOptions(ctx), listProjects(ctx, { ...parseProjectFilters({}), status: "open" }), projectId ? getProject(ctx, projectId) : null]);
  return (
    <ModuleGate ctx={ctx} module="offertes">
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Nieuwe offerte" breadcrumbs={[{ label: "Offertes", href: "/offertes" }, { label: "Nieuw" }]} description="Tip: vanuit de voorcalculatie van een project maakt u een offerte met één klik." />
        <EntityForm
          action={saveQuote}
          sections={quoteSections(customers, projects)}
          initialValues={{ quote_date: todayISO(ctx.settings.timezone), project_id: project?.id ?? "", customer_id: project?.customer_id ?? "", title: project?.name ?? "", prices_include_tax: String(ctx.settings.prices_include_vat) }}
          submitLabel="Offerte aanmaken"
          cancelHref="/offertes"
          readOnly={ctx.mode === "demo"}
        />
      </div>
    </ModuleGate>
  );
}
