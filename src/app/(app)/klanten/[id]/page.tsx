import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore, FolderKanban, Mail, Pencil, Phone, Plus } from "lucide-react";
import { Badge, ProjectStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getCustomer } from "@/lib/data/customers";
import { listProjects, parseProjectFilters } from "@/lib/data/projects";
import { formatMoney } from "@/lib/finance/money";
import { formatDate } from "@/lib/format";
import { CUSTOMER_TYPE_LABELS } from "@/lib/types";
import { setCustomerArchived } from "../actions";

export const metadata: Metadata = { title: "Klant" };

export default async function CustomerDetailPage({ params }: PageProps<"/klanten/[id]">) {
  const { id } = await params;
  const ctx = await getAppContext();
  const customer = await getCustomer(ctx, id);
  if (!customer) notFound();
  const projects = await listProjects(ctx, { ...parseProjectFilters({}), customerId: customer.id, archive: "all" });
  const canWrite = can(ctx.membership.role, "customers.write");
  const { currency_code: cur, locale } = ctx.settings;
  const address = [customer.address_line, [customer.postal_code, customer.city].filter(Boolean).join(" "), customer.country_code].filter(Boolean).join(", ");

  return (
    <>
      <PageHeader
        title={customer.name}
        breadcrumbs={[{ label: "Klanten", href: "/klanten" }, { label: customer.customer_number }]}
        meta={
          <>
            <span className="font-mono text-sm text-slate-500">{customer.customer_number}</span>
            <Badge tone={customer.customer_type === "business" ? "blue" : "slate"}>{CUSTOMER_TYPE_LABELS[customer.customer_type]}</Badge>
            {customer.is_archived && <Badge tone="amber">Gearchiveerd</Badge>}
          </>
        }
        actions={
          canWrite && (
            <>
              <LinkButton href={`/klanten/${customer.id}/bewerken`} variant="secondary">
                <Pencil className="size-4" aria-hidden /> Wijzigen
              </LinkButton>
              {customer.is_archived ? (
                <ConfirmAction
                  action={setCustomerArchived}
                  fields={{ id: customer.id, archive: "false" }}
                  trigger={<><ArchiveRestore className="size-4" aria-hidden /> Herstellen</>}
                  title="Klant herstellen?"
                  description="De klant wordt weer zichtbaar in de actieve lijst en kan aan nieuwe projecten worden gekoppeld."
                  confirmLabel="Herstellen"
                  confirmVariant="primary"
                />
              ) : (
                <ConfirmAction
                  action={setCustomerArchived}
                  fields={{ id: customer.id, archive: "true" }}
                  trigger={<><Archive className="size-4" aria-hidden /> Archiveren</>}
                  title="Klant archiveren?"
                  description="De klant wordt niet verwijderd. Bestaande projecten en gegevens blijven bewaard; u kunt de klant later herstellen."
                  confirmLabel="Archiveren"
                />
              )}
            </>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Klantgegevens" />
          <CardBody>
            <DescriptionList
              items={[
                { label: customer.customer_type === "business" ? "Bedrijfsnaam" : "Naam", value: customer.name },
                { label: "Contactpersoon", value: customer.contact_person },
                {
                  label: "E-mailadres",
                  value: customer.email && (
                    <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                      <Mail className="size-3.5" aria-hidden />
                      {customer.email}
                    </a>
                  ),
                },
                {
                  label: "Telefoonnummer",
                  value: customer.phone && (
                    <a href={`tel:${customer.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                      <Phone className="size-3.5" aria-hidden />
                      {customer.phone}
                    </a>
                  ),
                },
                { label: "Adres", value: address || null },
                { label: "BTW-nummer", value: customer.customer_type === "business" ? customer.vat_number : "n.v.t. (particulier)" },
              ]}
            />
            {customer.notes && (
              <div className="mt-6 rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Opmerkingen</p>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{customer.notes}</p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Samenvatting" />
          <CardBody className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Projecten</span><span className="font-medium">{projects.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Klant sinds</span><span className="font-medium">{formatDate(customer.created_at, locale)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Laatst gewijzigd</span><span className="font-medium">{formatDate(customer.updated_at, locale)}</span></div>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Projecten van deze klant"
          actions={
            can(ctx.membership.role, "projects.write") && !customer.is_archived && (
              <LinkButton href={`/projecten/nieuw?klant=${customer.id}`} size="sm" variant="secondary">
                <Plus className="size-4" aria-hidden /> Project
              </LinkButton>
            )
          }
        />
        {projects.length === 0 ? (
          <EmptyState icon={FolderKanban} title="Geen projecten" description="Er zijn nog geen projecten voor deze klant." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/projecten/${p.id}`} className="flex flex-col gap-1 px-5 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.project_number} · {formatDate(p.start_date, locale)} – {formatDate(p.expected_end_date, locale)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums text-slate-700">{formatMoney(p.contract_value, p.currency_code || cur, locale)}</span>
                    <ProjectStatusBadge status={p.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
