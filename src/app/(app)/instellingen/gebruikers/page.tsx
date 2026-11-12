import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { getAppContext } from "@/lib/auth/context";
import { can, ROLE_LABELS, ROLES } from "@/lib/auth/permissions";
import { load } from "@/lib/data/query";
import { formatDate } from "@/lib/format";
import { revokeInvitation, updateMember } from "./actions";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Gebruikers en rechten" };

interface MemberRow { id: string; user_id: string; role: string; is_active: boolean; name: string; email: string | null }
interface InviteRow { id: string; email: string; role: string; expires_at: string; accepted_at: string | null; revoked_at: string | null }

export default async function UsersPage() {
  const ctx = await getAppContext();
  const manage = can(ctx.membership.role, "members.manage") && ctx.mode !== "demo";
  const members = await load<MemberRow[]>(
    ctx,
    "Gebruikers",
    () => [{ id: ctx.membership.id, user_id: ctx.user.id, role: "owner", is_active: true, name: ctx.user.name, email: ctx.user.email }],
    async (sb, org) => {
      const { data, error } = await sb.from("organization_members").select("id, user_id, role, is_active").eq("organization_id", org).order("created_at");
      if (error) return { data: null, error };
      const ids = (data ?? []).map((m) => m.user_id as string);
      const { data: profiles } = ids.length ? await sb.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
      return {
        data: (data ?? []).map((m) => {
          const p = (profiles ?? []).find((x) => x.id === m.user_id);
          return { ...(m as Omit<MemberRow, "name" | "email">), name: (p?.full_name as string) || (p?.email as string) || "Gebruiker", email: (p?.email as string) ?? null };
        }),
        error: null,
      };
    },
  );
  const invitations = manage
    ? await load<InviteRow[]>(ctx, "Uitnodigingen", () => [], (sb, org) =>
        sb.from("organization_invitations").select("id, email, role, expires_at, accepted_at, revoked_at").eq("organization_id", org).is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: false }) as unknown as PromiseLike<{ data: InviteRow[] | null; error: { message: string } | null }>,
      )
    : [];
  const active = members.filter((m) => m.is_active).length;
  const max = ctx.subscription.maxUsers;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Gebruikers en rechten" breadcrumbs={[{ label: "Instellingen", href: "/instellingen" }, { label: "Gebruikers" }]} description={`${active} actieve gebruiker(s)${max ? ` van maximaal ${max} in uw abonnement` : ""}.`} />
      {!manage && ctx.mode !== "demo" && <FormAlert tone="info" message="Alleen eigenaren en beheerders kunnen gebruikers beheren." />}
      <Card>
        <CardHeader title="Gebruikers" />
        <Table>
          <thead><tr><Th>Naam</Th><Th className="hidden md:table-cell">E-mail</Th><Th>Rol</Th><Th>Status</Th>{manage && <Th><span className="sr-only">Wijzigen</span></Th>}</tr></thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {members.map((m) => (
              <tr key={m.id}>
                <Td className="font-medium">{m.name}{m.user_id === ctx.user.id && <span className="ml-1 text-xs text-slate-600">(u)</span>}</Td>
                <Td className="hidden md:table-cell">{m.email ?? "—"}</Td>
                <Td><Badge tone="blue">{ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] ?? m.role}</Badge></Td>
                <Td>{m.is_active ? <Badge tone="green">Actief</Badge> : <Badge>Gedeactiveerd</Badge>}</Td>
                {manage && (
                  <Td>
                    <form action={updateMember} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="member_id" value={m.id} />
                      <label className="sr-only" htmlFor={`role-${m.id}`}>Rol</label>
                      <select id={`role-${m.id}`} name="role" defaultValue={m.role} className="h-9 rounded-lg border-0 px-2 text-sm ring-1 ring-inset ring-slate-300">
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                      <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="is_active" defaultChecked={m.is_active} className="size-4 accent-brand-700" /> Actief</label>
                      <Button type="submit" size="sm" variant="secondary">Opslaan</Button>
                    </form>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      {manage && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Collega uitnodigen" description="De collega maakt een account aan (of logt in) met hetzelfde e-mailadres en opent de link." />
            <CardBody><InviteForm /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Openstaande uitnodigingen" />
            {invitations.length === 0 ? <p className="px-5 py-4 text-sm text-slate-600">Geen openstaande uitnodigingen.</p> : (
              <ul className="divide-y divide-slate-100">
                {invitations.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span>{i.email} · {ROLE_LABELS[i.role as keyof typeof ROLE_LABELS]}<span className="block text-xs text-slate-600">Geldig tot {formatDate(i.expires_at)}</span></span>
                    <form action={revokeInvitation}><input type="hidden" name="id" value={i.id} /><Button type="submit" size="sm" variant="ghost">Intrekken</Button></form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
      <Card>
        <CardHeader title="Wat mag elke rol?" />
        <CardBody className="text-sm text-slate-700">
          <ul className="space-y-1.5">
            <li><strong>Eigenaar</strong> — alles, inclusief eigenaren beheren.</li>
            <li><strong>Beheerder</strong> — alles behalve eigenaren beheren.</li>
            <li><strong>Projectleider</strong> — klanten, projecten, calculatie, planning, uren/werkbonnen goedkeuren, inkoop, offertes.</li>
            <li><strong>Financiële administratie</strong> — klanten, inkoop, offertes, facturen, betalingen, belastingtarieven.</li>
            <li><strong>Medewerker</strong> — lezen; eigen uren en werkbonnen registreren (account koppelen bij Medewerkers).</li>
            <li><strong>Alleen lezen</strong> — alles inzien, niets wijzigen.</li>
          </ul>
          <p className="mt-3 text-xs text-slate-600">Rechten worden in de database afgedwongen (Row Level Security), niet alleen in de interface.</p>
        </CardBody>
      </Card>
    </div>
  );
}
