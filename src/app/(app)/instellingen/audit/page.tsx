import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { load } from "@/lib/data/query";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit trail" };

const TABLES: Record<string, string> = {
  customers: "Klant", projects: "Project", invoices: "Factuur", invoice_lines: "Factuurregel", quotes: "Offerte", quote_lines: "Offerteregel",
  payments: "Betaling", project_cost_entries: "Kostenregel", stock_movements: "Voorraadmutatie", purchase_orders: "Inkooporder",
  purchase_order_lines: "Inkoopregel", purchase_receipts: "Ontvangst", work_orders: "Werkbon", time_entries: "Uren", employees: "Medewerker",
  materials: "Materiaal", suppliers: "Leverancier", organization_settings: "Instellingen", tax_rates: "Belastingtarief", organization_members: "Gebruiker",
  project_estimate_lines: "Calculatieregel", project_tasks: "Taak", documents: "Document",
};
const ACTIONS: Record<string, string> = { INSERT: "Aangemaakt", UPDATE: "Gewijzigd", DELETE: "Verwijderd" };

interface Row { id: number; table_name: string; record_id: string | null; action: string; changed_by: string | null; changed_at: string; new_data: Record<string, unknown> | null }

export default async function AuditPage() {
  const ctx = await getAppContext();
  if (!can(ctx.membership.role, "audit.read")) notFound();
  const rows = await load<Row[]>(ctx, "Audit trail", () => [], (sb, org) =>
    sb.from("audit_log").select("id, table_name, record_id, action, changed_by, changed_at, new_data").eq("organization_id", org).order("changed_at", { ascending: false }).limit(200) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
  );
  const label = (r: Row) => {
    const d = r.new_data ?? {};
    return (d.invoice_number ?? d.quote_number ?? d.project_number ?? d.customer_number ?? d.work_order_number ?? d.purchase_order_number ?? d.name ?? d.description ?? "") as string;
  };
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Audit trail" breadcrumbs={[{ label: "Instellingen", href: "/instellingen" }, { label: "Audit trail" }]} description="Technisch logboek van alle wijzigingen aan bedrijfsgegevens (laatste 200). Het logboek kan niet worden gewijzigd." />
      <Card>
        <CardHeader title="Wijzigingen" />
        {rows.length === 0 ? <p className="px-5 py-4 text-sm text-slate-500">{ctx.mode === "demo" ? "Niet beschikbaar in demo-modus." : "Nog geen wijzigingen."}</p> : (
          <Table>
            <thead><tr><Th>Tijdstip</Th><Th>Onderdeel</Th><Th>Actie</Th><Th className="hidden md:table-cell">Record</Th></tr></thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap">{formatDateTime(r.changed_at, ctx.settings.locale, ctx.settings.timezone)}</Td>
                  <Td>{TABLES[r.table_name] ?? r.table_name}</Td>
                  <Td>{ACTIONS[r.action] ?? r.action}</Td>
                  <Td className="hidden md:table-cell max-w-xs truncate text-slate-600">{label(r) || r.record_id}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
