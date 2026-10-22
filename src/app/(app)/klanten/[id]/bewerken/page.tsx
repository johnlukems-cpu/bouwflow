import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getCustomer } from "@/lib/data/customers";
import { CustomerForm } from "../../customer-form";

export const metadata: Metadata = { title: "Klant bewerken" };

export default async function EditCustomerPage({ params }: PageProps<"/klanten/[id]/bewerken">) {
  const { id } = await params;
  const ctx = await getAppContext();
  const customer = await getCustomer(ctx, id);
  if (!customer) notFound();
  if (!can(ctx.membership.role, "customers.write")) redirect(`/klanten/${id}`);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`${customer.name} bewerken`}
        breadcrumbs={[{ label: "Klanten", href: "/klanten" }, { label: customer.customer_number, href: `/klanten/${id}` }, { label: "Bewerken" }]}
      />
      <CustomerForm customer={customer} readOnly={ctx.mode === "demo"} />
    </div>
  );
}
