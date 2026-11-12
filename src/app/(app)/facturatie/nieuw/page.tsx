import type { Metadata } from "next";
import { EntityForm } from "@/components/ui/entity-form";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { listCustomerOptions } from "@/lib/data/customers";
import { getProject, listProjects, parseProjectFilters } from "@/lib/data/projects";
import { todayISO } from "@/lib/format";
import { saveInvoice } from "../actions";
import { invoiceSections } from "../config";

export const metadata: Metadata = { title: "Nieuwe factuur" };

export default async function NewInvoicePage({ searchParams }: PageProps<"/facturatie/nieuw">) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const projectId = typeof sp.project === "string" ? sp.project : "";
  const [customers, projects, project] = await Promise.all([listCustomerOptions(ctx), listProjects(ctx, { ...parseProjectFilters({}), status: "all" }), projectId ? getProject(ctx, projectId) : null]);
  return (
    <ModuleGate ctx={ctx} module="facturatie">
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Nieuwe factuur" breadcrumbs={[{ label: "Facturatie", href: "/facturatie" }, { label: "Nieuw" }]} description="Voor voorschot-, termijn- en eindfacturen op basis van een offerte: open de geaccepteerde offerte en kies 'Factureren'." />
        <EntityForm
          action={saveInvoice}
          sections={invoiceSections(customers, projects, false)}
          initialValues={{ invoice_type: "standard", invoice_date: todayISO(ctx.settings.timezone), project_id: project?.id ?? "", customer_id: project?.customer_id ?? "", title: project ? `Factuur — ${project.name}` : "", prices_include_tax: String(ctx.settings.prices_include_vat) }}
          submitLabel="Conceptfactuur aanmaken"
          cancelHref="/facturatie"
          readOnly={ctx.mode === "demo"}
        />
      </div>
    </ModuleGate>
  );
}
