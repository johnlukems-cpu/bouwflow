import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listCustomerOptions } from "@/lib/data/customers";
import { getProject, listMembers } from "@/lib/data/projects";
import { ProjectForm } from "../../project-form";

export const metadata: Metadata = { title: "Project bewerken" };

export default async function EditProjectPage({ params }: PageProps<"/projecten/[id]/bewerken">) {
  const { id } = await params;
  const ctx = await getAppContext();
  const project = await getProject(ctx, id);
  if (!project) notFound();
  if (!can(ctx.membership.role, "projects.write")) redirect(`/projecten/${id}`);
  const [customers, members] = await Promise.all([listCustomerOptions(ctx), listMembers(ctx)]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`${project.name} bewerken`}
        breadcrumbs={[{ label: "Projecten", href: "/projecten" }, { label: project.project_number, href: `/projecten/${id}` }, { label: "Bewerken" }]}
      />
      <ProjectForm project={project} customers={customers} members={members} currency={ctx.settings.currency_code} readOnly={ctx.mode === "demo"} />
    </div>
  );
}
