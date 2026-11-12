import { Text, View } from "@react-pdf/renderer";
import { PdfLayout, type Issuer } from "./layout";
import { pd, pm, pq, pdfText } from "./format";
import { s } from "./theme";

export interface PdfParty {
  name: string;
  customer_number?: string | null;
  contact_person?: string | null;
  address_line?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country_code?: string | null;
  email?: string | null;
  phone?: string | null;
  vat_number?: string | null;
}

export interface PdfLine {
  description: string;
  quantity: string | number;
  unit: string;
  unit_price: string | number;
  discount_percent?: string | number | null;
  tax_rate_percent?: string | number | null;
  line_amount: string | number;
}

export interface PdfTaxGroup {
  rate_percent: string | number;
  taxable_amount: string | number;
  tax_amount: string | number;
}

function Party({ label, p }: { label: string; p: PdfParty }) {
  return (
    <View style={s.box}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.bold}>{p.name}</Text>
      {p.contact_person && <Text>t.a.v. {p.contact_person}</Text>}
      {p.address_line && <Text>{p.address_line}</Text>}
      {(p.postal_code || p.city) && <Text>{[p.postal_code, p.city].filter(Boolean).join(" ")}</Text>}
      {p.vat_number && <Text>BTW-nummer: {p.vat_number}</Text>}
      {p.customer_number && <Text style={s.note}>Klantnummer {p.customer_number}</Text>}
    </View>
  );
}

function Meta({ rows }: { rows: [string, string][] }) {
  return (
    <View style={s.box}>
      {rows.map(([k, v]) => (
        <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 1 }}>
          <Text style={{ color: "#6B7480" }}>{k}</Text>
          <Text style={s.bold}>{pdfText(v)}</Text>
        </View>
      ))}
    </View>
  );
}

/** Offerte of factuur (incl. creditnota) in BouwFlow-huisstijl. */
export function SalesDocumentPdf(p: {
  logo: Buffer;
  issuer: Issuer;
  kind: "offerte" | "factuur" | "creditnota";
  heading: string;
  number: string;
  title: string;
  customer: PdfParty;
  meta: [string, string][];
  intro?: string | null;
  lines: PdfLine[];
  subtotal: string | number;
  taxGroups: PdfTaxGroup[];
  total: string | number;
  currency: string;
  pricesIncludeTax: boolean;
  closingTitle?: string;
  closing?: string | null;
  payment?: { paid: string; credited: string; outstanding: string } | null;
  draft: boolean;
}) {
  const cur = p.currency;
  return (
    <PdfLayout title={`${p.heading} ${p.number}`} logo={p.logo} issuer={p.issuer} draft={p.draft} docRef={`${p.heading} ${p.number}`}>
      <Text style={s.title}>{p.heading}</Text>
      <Text style={s.subtitle}>{pdfText(p.title)}</Text>
      <View style={s.metaRow}>
        <Party label={p.kind === "offerte" ? "Offerte voor" : "Factuur aan"} p={p.customer} />
        <Meta rows={p.meta} />
      </View>
      {p.intro && <Text style={{ marginBottom: 10 }}>{pdfText(p.intro)}</Text>}

      <View style={s.table}>
        <View style={s.th} fixed>
          <Text style={[s.cell, { width: "44%" }]}>Omschrijving</Text>
          <Text style={[s.cell, s.right, { width: "13%" }]}>Aantal</Text>
          <Text style={[s.cell, s.right, { width: "15%" }]}>Prijs</Text>
          <Text style={[s.cell, s.right, { width: "10%" }]}>Belasting</Text>
          <Text style={[s.cell, s.right, { width: "18%" }]}>Bedrag</Text>
        </View>
        {p.lines.map((l, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <View style={[s.cell, { width: "44%" }]}>
              <Text>{pdfText(l.description)}</Text>
              {Number(l.discount_percent ?? 0) > 0 && <Text style={s.note}>Korting {pq(l.discount_percent ?? 0)}%</Text>}
            </View>
            <Text style={[s.cell, s.right, { width: "13%" }]}>{pq(l.quantity)} {l.unit}</Text>
            <Text style={[s.cell, s.right, { width: "15%" }]}>{pm(l.unit_price, cur)}</Text>
            <Text style={[s.cell, s.right, { width: "10%" }]}>{l.tax_rate_percent === null || l.tax_rate_percent === undefined ? "-" : `${pq(l.tax_rate_percent)}%`}</Text>
            <Text style={[s.cell, s.right, { width: "18%" }]}>{pm(l.line_amount, cur)}</Text>
          </View>
        ))}
      </View>

      <View style={s.totals} wrap={false}>
        <View style={s.totalRow}>
          <Text>Subtotaal{p.pricesIncludeTax ? " (excl. belasting)" : ""}</Text>
          <Text>{pm(p.subtotal, cur)}</Text>
        </View>
        {p.taxGroups.map((g) => (
          <View key={String(g.rate_percent)} style={s.totalRow}>
            <Text>Belasting {pq(g.rate_percent)}% over {pm(g.taxable_amount, cur)}</Text>
            <Text>{pm(g.tax_amount, cur)}</Text>
          </View>
        ))}
        <View style={s.grand}>
          <Text>Totaal</Text>
          <Text>{pm(p.total, cur)}</Text>
        </View>
        {p.payment && (
          <>
            {Number(p.payment.credited) !== 0 && (
              <View style={s.totalRow}><Text>Gecrediteerd</Text><Text>{pm(p.payment.credited, cur)}</Text></View>
            )}
            {Number(p.payment.paid) !== 0 && (
              <View style={s.totalRow}><Text>Reeds betaald</Text><Text>{pm(p.payment.paid, cur)}</Text></View>
            )}
            <View style={[s.totalRow, s.bold]}><Text>Openstaand</Text><Text>{pm(p.payment.outstanding, cur)}</Text></View>
          </>
        )}
      </View>

      {p.closing && (
        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>{p.closingTitle ?? "Voorwaarden"}</Text>
          <Text>{pdfText(p.closing)}</Text>
        </View>
      )}
      {p.kind === "offerte" && (
        <View style={[s.section, { flexDirection: "row", justifyContent: "space-between" }]} wrap={false}>
          <View style={s.box}>
            <Text style={s.label}>Voor akkoord opdrachtgever</Text>
            <Text style={{ marginTop: 28, borderTopWidth: 0.5, borderTopColor: "#999", paddingTop: 2 }}>Naam, datum en handtekening</Text>
          </View>
        </View>
      )}
    </PdfLayout>
  );
}

export function WorkOrderPdf(p: {
  logo: Buffer;
  issuer: Issuer;
  number: string;
  project: string;
  customer: string;
  employee: string;
  date: string;
  times: string;
  hours: string;
  description: string;
  notes?: string | null;
  materials: { description: string; quantity: string; unit: string }[];
  status: string;
  draft: boolean;
}) {
  return (
    <PdfLayout title={`Werkbon ${p.number}`} logo={p.logo} issuer={p.issuer} draft={p.draft} docRef={`Werkbon ${p.number}`}>
      <Text style={s.title}>Werkbon</Text>
      <Text style={s.subtitle}>{p.number} · status: {p.status}</Text>
      <View style={s.metaRow}>
        <Meta rows={[["Project", p.project], ["Klant", p.customer], ["Medewerker", p.employee]]} />
        <Meta rows={[["Datum", pd(p.date)], ["Tijd", p.times], ["Gewerkte uren", p.hours]]} />
      </View>
      <View style={s.section}>
        <Text style={s.sectionTitle}>Uitgevoerde werkzaamheden</Text>
        <Text>{pdfText(p.description)}</Text>
        {p.notes && <Text style={[s.note, { marginTop: 6 }]}>Opmerkingen: {pdfText(p.notes)}</Text>}
      </View>
      <View style={s.section}>
        <Text style={s.sectionTitle}>Gebruikte materialen</Text>
        {p.materials.length === 0 ? <Text style={s.note}>Geen materialen.</Text> : (
          <View style={s.table}>
            <View style={s.th}>
              <Text style={[s.cell, { width: "75%" }]}>Omschrijving</Text>
              <Text style={[s.cell, s.right, { width: "25%" }]}>Hoeveelheid</Text>
            </View>
            {p.materials.map((m, i) => (
              <View key={i} style={s.tr} wrap={false}>
                <Text style={[s.cell, { width: "75%" }]}>{pdfText(m.description)}</Text>
                <Text style={[s.cell, s.right, { width: "25%" }]}>{pq(m.quantity)} {m.unit}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={[s.section, { flexDirection: "row", justifyContent: "space-between" }]} wrap={false}>
        {["Handtekening medewerker", "Handtekening opdrachtgever"].map((l) => (
          <View key={l} style={s.box}>
            <Text style={s.label}>{l}</Text>
            <Text style={{ marginTop: 28, borderTopWidth: 0.5, borderTopColor: "#999", paddingTop: 2 }}>Naam en datum</Text>
          </View>
        ))}
      </View>
    </PdfLayout>
  );
}

export function PurchaseOrderPdf(p: {
  logo: Buffer;
  issuer: Issuer;
  number: string;
  supplier: PdfParty;
  meta: [string, string][];
  lines: { description: string; quantity: string; unit: string; unit_cost: string; line_total: string }[];
  total: string;
  currency: string;
  notes?: string | null;
  draft: boolean;
}) {
  return (
    <PdfLayout title={`Inkooporder ${p.number}`} logo={p.logo} issuer={p.issuer} draft={p.draft} docRef={`Inkooporder ${p.number}`}>
      <Text style={s.title}>Inkooporder</Text>
      <Text style={s.subtitle}>{p.number}</Text>
      <View style={s.metaRow}>
        <Party label="Leverancier" p={p.supplier} />
        <Meta rows={p.meta} />
      </View>
      <View style={s.table}>
        <View style={s.th} fixed>
          <Text style={[s.cell, { width: "50%" }]}>Omschrijving</Text>
          <Text style={[s.cell, s.right, { width: "16%" }]}>Aantal</Text>
          <Text style={[s.cell, s.right, { width: "16%" }]}>Prijs</Text>
          <Text style={[s.cell, s.right, { width: "18%" }]}>Bedrag</Text>
        </View>
        {p.lines.map((l, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <Text style={[s.cell, { width: "50%" }]}>{pdfText(l.description)}</Text>
            <Text style={[s.cell, s.right, { width: "16%" }]}>{pq(l.quantity)} {l.unit}</Text>
            <Text style={[s.cell, s.right, { width: "16%" }]}>{pm(l.unit_cost, p.currency)}</Text>
            <Text style={[s.cell, s.right, { width: "18%" }]}>{pm(l.line_total, p.currency)}</Text>
          </View>
        ))}
      </View>
      <View style={s.totals}>
        <View style={s.grand}>
          <Text>Totaal (excl. belasting)</Text>
          <Text>{pm(p.total, p.currency)}</Text>
        </View>
      </View>
      {p.notes && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Opmerkingen</Text>
          <Text>{pdfText(p.notes)}</Text>
        </View>
      )}
    </PdfLayout>
  );
}

export function PostCalcPdf(p: {
  logo: Buffer;
  issuer: Issuer;
  project: string;
  customer: string;
  currency: string;
  rows: { label: string; budget: string; actual: string; variance: string; bold?: boolean }[];
  revenueLines: [string, string][];
  status: string;
  generatedAt: string;
}) {
  return (
    <PdfLayout title={`Na-calculatie ${p.project}`} logo={p.logo} issuer={p.issuer} docRef={`Na-calculatie ${p.project}`}>
      <Text style={s.title}>Na-calculatie</Text>
      <Text style={s.subtitle}>{pdfText(p.project)} · {pdfText(p.customer)}</Text>
      <Text style={{ marginBottom: 10 }}>{pdfText(p.status)}</Text>
      <View style={s.table}>
        <View style={s.th}>
          <Text style={[s.cell, { width: "34%" }]}>Onderdeel</Text>
          <Text style={[s.cell, s.right, { width: "22%" }]}>Begroot</Text>
          <Text style={[s.cell, s.right, { width: "22%" }]}>Werkelijk</Text>
          <Text style={[s.cell, s.right, { width: "22%" }]}>Verschil</Text>
        </View>
        {p.rows.map((r) => (
          <View key={r.label} style={[s.tr, r.bold ? s.bold : {}]} wrap={false}>
            <Text style={[s.cell, { width: "34%" }]}>{r.label}</Text>
            <Text style={[s.cell, s.right, { width: "22%" }]}>{pdfText(r.budget)}</Text>
            <Text style={[s.cell, s.right, { width: "22%" }]}>{pdfText(r.actual)}</Text>
            <Text style={[s.cell, s.right, { width: "22%" }]}>{pdfText(r.variance)}</Text>
          </View>
        ))}
      </View>
      <View style={s.section}>
        <Text style={s.sectionTitle}>Omzet (afzonderlijk)</Text>
        {p.revenueLines.map(([k, v]) => (
          <View key={k} style={s.totalRow}><Text>{k}</Text><Text>{pdfText(v)}</Text></View>
        ))}
      </View>
      <Text style={[s.note, { marginTop: 14 }]}>
        Kostenverschil = werkelijk - begroot. Winst = omzet - kosten. Marge = winst / omzet x 100% (alleen bij omzet groter dan nul). Gegenereerd op {p.generatedAt}.
      </Text>
    </PdfLayout>
  );
}
