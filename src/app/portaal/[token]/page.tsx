import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { getAppMode } from "@/lib/env";
import { formatMoney } from "@/lib/finance/money";
import { formatDate } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PAYMENT_STATUS_LABELS, PROJECT_STATUS_LABELS, QUOTE_STATUS_LABELS, type PaymentStatus, type ProjectStatus, type QuoteStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Klantportaal", robots: { index: false, follow: false }, referrer: "no-referrer" };

interface Overview {
  organization: { name: string; legal_name: string | null; email: string | null; phone: string | null; address_line: string | null; city: string | null; currency_code: string };
  customer: { name: string; customer_number: string };
  projects: { project_number: string; name: string; status: ProjectStatus; start_date: string | null; expected_end_date: string | null }[];
  quotes: { id: string; quote_number: string; version: number; title: string; status: QuoteStatus; quote_date: string; valid_until: string | null; subtotal: number; tax_total: number; total: number; currency_code: string; lines: { description: string; quantity: number; unit: string; line_amount: number }[] | null }[];
  invoices: { id: string; invoice_number: string; title: string; invoice_date: string; due_date: string | null; total: number; currency_code: string; outstanding: number; payment_status: PaymentStatus }[];
}

const TOKEN = /^[0-9a-f]{64}$/;

async function respond(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  if (!TOKEN.test(token)) redirect("/");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("portal_respond_quote", {
    raw_token: token,
    q_id: String(formData.get("quote_id") ?? ""),
    accept: formData.get("accept") === "true",
    by_name: String(formData.get("by_name") ?? "").slice(0, 200),
  });
  redirect(`/portaal/${token}?${error ? "fout=1" : "bedankt=1"}`);
}

/** Klantportaal: toegang via een geheime, intrekbare link. Toont alleen definitieve documenten van deze klant. */
export default async function PortalPage({ params, searchParams }: PageProps<"/portaal/[token]">) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  if (getAppMode() !== "supabase" || !TOKEN.test(token)) return <Invalid />;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("portal_overview", { raw_token: token });
  if (error || !data) return <Invalid />;
  const o = data as Overview;
  const today = new Date().toISOString().slice(0, 10);
  const m = (v: number, c: string) => formatMoney(v, c, "nl-SR");

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="bg-white ring-1 ring-slate-200">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-lg font-semibold text-navy-900">{o.organization.legal_name || o.organization.name}</p>
            <p className="text-xs text-slate-600">{[o.organization.address_line, o.organization.city, o.organization.phone, o.organization.email].filter(Boolean).join(" · ")}</p>
          </div>
          <Image src="/brand/bouwflow-compact-light.png" alt="BouwFlow" width={796} height={160} className="h-7 w-auto opacity-80" />
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Welkom, {o.customer.name}</h1>
          <p className="text-sm text-slate-600">Klantnummer {o.customer.customer_number}. Hier vindt u uw projecten, offertes en facturen.</p>
        </div>
        {sp.bedankt && <FormAlert tone="info" message="Bedankt, uw reactie is ontvangen." />}
        {sp.fout && <FormAlert message="Uw reactie kon niet worden verwerkt (de offerte is mogelijk verlopen of al beantwoord)." />}

        <Card>
          <CardHeader title="Projecten" />
          {o.projects.length === 0 ? <p className="px-5 py-4 text-sm text-slate-600">Geen projecten.</p> : (
            <ul className="divide-y divide-slate-100">
              {o.projects.map((p) => (
                <li key={p.project_number} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span>{p.name}<span className="block text-xs text-slate-600">{p.project_number} · {formatDate(p.start_date)} – {formatDate(p.expected_end_date)}</span></span>
                  <Badge tone="blue">{PROJECT_STATUS_LABELS[p.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Offertes" />
          {o.quotes.length === 0 ? <p className="px-5 py-4 text-sm text-slate-600">Geen offertes.</p> : (
            <ul className="divide-y divide-slate-100">
              {o.quotes.map((q) => {
                const open = q.status === "sent" && (!q.valid_until || q.valid_until >= today);
                return (
                  <li key={q.id} className="space-y-3 px-5 py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">{q.title} <span className="text-xs text-slate-600">{q.quote_number}{q.version > 1 && ` v${q.version}`}</span></p>
                      <Badge tone={q.status === "accepted" ? "green" : q.status === "rejected" ? "red" : "blue"}>{QUOTE_STATUS_LABELS[q.status]}</Badge>
                    </div>
                    {q.lines && (
                      <ul className="space-y-1 text-sm text-slate-700">
                        {q.lines.map((l, i) => <li key={i} className="flex justify-between gap-3"><span>{l.description}</span><span className="tabular-nums">{m(l.line_amount, q.currency_code)}</span></li>)}
                      </ul>
                    )}
                    <p className="text-right text-sm">Totaal incl. belasting: <strong className="tabular-nums">{m(q.total, q.currency_code)}</strong> · geldig tot {formatDate(q.valid_until)}</p>
                    {open && (
                      <form action={respond} className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 sm:flex-row sm:items-end">
                        <input type="hidden" name="token" value={token} />
                        <input type="hidden" name="quote_id" value={q.id} />
                        <label className="flex-1 text-sm"><span className="mb-1 block font-medium">Uw naam</span><input name="by_name" required minLength={2} maxLength={200} className="h-11 w-full rounded-lg border-0 px-3 ring-1 ring-inset ring-slate-300" /></label>
                        <SubmitButton name="accept" value="true">Offerte accepteren</SubmitButton>
                        <SubmitButton name="accept" value="false" variant="secondary">Afwijzen</SubmitButton>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Facturen" />
          {o.invoices.length === 0 ? <p className="px-5 py-4 text-sm text-slate-600">Geen facturen.</p> : (
            <ul className="divide-y divide-slate-100">
              {o.invoices.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span>{i.title}<span className="block text-xs text-slate-600">{i.invoice_number} · vervalt {formatDate(i.due_date)}</span></span>
                  <span className="flex items-center gap-3"><span className="tabular-nums">{m(i.total, i.currency_code)}</span><Badge tone={i.payment_status === "paid" ? "green" : i.payment_status === "overdue" ? "red" : "amber"}>{PAYMENT_STATUS_LABELS[i.payment_status]}</Badge></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <CardBody className="text-center text-xs text-slate-600">Deze pagina is persoonlijk. Deel de link niet met anderen. Mogelijk gemaakt door BouwFlow — Projecten in vertrouwen.</CardBody>
      </main>
    </div>
  );
}

function Invalid() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <Image src="/brand/bouwflow-logo-light.png" alt="BouwFlow" width={1161} height={998} className="mx-auto mb-4 h-auto w-28" />
        <h1 className="text-lg font-semibold text-navy-900">Link ongeldig of verlopen</h1>
        <p className="mt-2 text-sm text-slate-600">Vraag uw contactpersoon om een nieuwe link naar het klantportaal.</p>
      </div>
    </div>
  );
}
