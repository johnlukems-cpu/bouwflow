import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { s } from "./theme";

export interface Issuer {
  name: string;
  legal_name?: string | null;
  address_line?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country_code?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  chamber_of_commerce_no?: string | null;
  vat_number?: string | null;
  iban?: string | null;
}

export function issuerLines(i: Issuer): string[] {
  return [
    [i.address_line, [i.postal_code, i.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    [i.phone, i.email].filter(Boolean).join(" · "),
    [i.chamber_of_commerce_no && `KvK ${i.chamber_of_commerce_no}`, i.vat_number && `BTW ${i.vat_number}`].filter(Boolean).join(" · "),
    i.iban ? `Bank ${i.iban}` : "",
  ].filter((x) => x && x.trim().length > 0);
}

/** Basislayout met officieel BouwFlow-logo, bedrijfsgegevens, paginanummering en optioneel CONCEPT-watermerk. */
export function PdfLayout({ title, logo, issuer, draft, children, docRef }: { title: string; logo: Buffer; issuer: Issuer; draft?: boolean; children: ReactNode; docRef: string }) {
  return (
    <Document title={title} author={issuer.legal_name || issuer.name} creator="BouwFlow" producer="BouwFlow" language="nl">
      <Page size="A4" style={s.page} wrap>
        <View style={s.accentBar} fixed />
        {draft && (
          <Text style={s.watermark} fixed>
            CONCEPT
          </Text>
        )}
        <View style={s.header} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image heeft geen alt */}
          <Image src={logo} style={s.logo} />
          <View style={s.issuer}>
            <Text style={s.issuerName}>{issuer.legal_name || issuer.name}</Text>
            {issuerLines(issuer).map((l) => (
              <Text key={l}>{l}</Text>
            ))}
          </View>
        </View>
        {children}
        <View style={s.footer} fixed>
          <Text>{docRef}</Text>
          <Text>BouwFlow — Projecten in vertrouwen.</Text>
          <Text render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} van ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
