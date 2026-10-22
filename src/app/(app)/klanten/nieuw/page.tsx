import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { CustomerForm } from "../customer-form";

export const metadata: Metadata = { title: "Nieuwe klant" };

export default async function NewCustomerPage() {
  const ctx = await getAppContext();
  if (!can(ctx.membership.role, "customers.write")) redirect("/klanten");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nieuwe klant" breadcrumbs={[{ label: "Klanten", href: "/klanten" }, { label: "Nieuw" }]} description="Het klantnummer wordt automatisch toegekend." />
      <CustomerForm readOnly={ctx.mode === "demo"} />
    </div>
  );
}
