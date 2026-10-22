import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LinkButton } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listCustomerOptions } from "@/lib/data/customers";
import { listMembers } from "@/lib/data/projects";
import { ProjectForm } from "../project-form";

export const metadata: Metadata = { title: "Nieuw project" };

export default async function NewProjectPage({ searchParams }: PageProps<"/projecten/nieuw">) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  if (!can(ctx.membership.role, "projects.write")) redirect("/projecten");
  const [customers, members] = await Promise.all([listCustomerOptions(ctx), listMembers(ctx)]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nieuw project" breadcrumbs={[{ label: "Projecten", href: "/projecten" }, { label: "Nieuw" }]} description="Het projectnummer wordt automatisch toegekend." />
      {customers.length === 0 && (
        <div className="mb-6 space-y-3">
          <FormAlert tone="info" message="U heeft nog geen (actieve) klanten. Een project moet aan een klant gekoppeld zijn." />
          <LinkButton href="/klanten/nieuw" variant="secondary">Eerst een klant aanmaken</LinkButton>
        </div>
      )}
      <ProjectForm
        customers={customers}
        members={members}
        defaultCustomerId={typeof sp.klant === "string" ? sp.klant : undefined}
        currency={ctx.settings.currency_code}
        readOnly={ctx.mode === "demo"}
      />
    </div>
  );
}
