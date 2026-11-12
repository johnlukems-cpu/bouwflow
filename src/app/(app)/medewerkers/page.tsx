import type { Metadata } from "next";
import Link from "next/link";
import { HardHat, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listEmployees } from "@/lib/data/resources";
import { formatMoney } from "@/lib/finance/money";

export const metadata: Metadata = { title: "Medewerkers" };

export default async function EmployeesPage() {
  const ctx = await getAppContext();
  const employees = await listEmployees(ctx, { includeInactive: true });
  const canWrite = can(ctx.membership.role, "employees.write");
  const { currency_code: cur, locale } = ctx.settings;
  return (
    <ModuleGate ctx={ctx} module="medewerkers">
      <PageHeader
        title="Medewerkers"
        description="Personeel, functies en uurtarieven. Gebruikersaccounts en rollen beheert u bij Instellingen → Gebruikers."
        actions={canWrite && <LinkButton href="/medewerkers/nieuw"><Plus className="size-4" aria-hidden /> Nieuwe medewerker</LinkButton>}
      />
      <Card>
        {employees.length === 0 ? (
          <EmptyState icon={HardHat} title="Nog geen medewerkers" description="Medewerkers gebruikt u in de planning, urenregistratie en werkbonnen." action={canWrite && <LinkButton href="/medewerkers/nieuw">Medewerker toevoegen</LinkButton>} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Nr.</Th>
                <Th>Naam</Th>
                <Th className="hidden md:table-cell">Functie</Th>
                <Th className="hidden sm:table-cell text-right">Kostprijs/uur</Th>
                <Th className="hidden lg:table-cell text-right">Tarief/uur</Th>
                <Th className="hidden md:table-cell">Account</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-xs text-slate-600">{e.employee_number}</Td>
                  <Td>
                    <Link href={`/medewerkers/${e.id}`} className="font-medium text-slate-900 hover:text-brand-700">{e.full_name}</Link>
                    {!e.is_active && <Badge className="ml-2">Inactief</Badge>}
                  </Td>
                  <Td className="hidden md:table-cell">{e.job_title ?? "—"}</Td>
                  <Td className="hidden sm:table-cell text-right tabular-nums">{formatMoney(e.hourly_cost, cur, locale)}</Td>
                  <Td className="hidden lg:table-cell text-right tabular-nums">{formatMoney(e.hourly_rate, cur, locale)}</Td>
                  <Td className="hidden md:table-cell">{e.member_id ? <Badge tone="green">Gekoppeld</Badge> : <span className="text-slate-500">—</span>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </ModuleGate>
  );
}
