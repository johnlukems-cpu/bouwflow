import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { OrganizationSettings } from "@/lib/types";
import type { Issuer } from "./layout";

let logoCache: Buffer | null = null;

/** Officieel BouwFlow-logo (compacte variant voor lichte achtergrond). */
export async function loadLogo(): Promise<Buffer> {
  if (!logoCache) logoCache = await readFile(path.join(process.cwd(), "public", "brand", "bouwflow-compact-light.png"));
  return logoCache;
}

export function issuerFromSettings(name: string, s: Partial<OrganizationSettings> | Record<string, unknown>): Issuer {
  const g = (k: string) => ((s as Record<string, unknown>)[k] as string | null | undefined) ?? null;
  return {
    name,
    legal_name: g("legal_name"),
    address_line: g("address_line"),
    postal_code: g("postal_code"),
    city: g("city"),
    country_code: g("country_code"),
    phone: g("phone"),
    email: g("email"),
    website: g("website"),
    chamber_of_commerce_no: g("chamber_of_commerce_no"),
    vat_number: g("vat_number"),
    iban: g("iban"),
  };
}

/** Rendert een react-pdf-document naar een PDF-respons (geen caching: documenten bevatten bedrijfsgegevens). */
export async function pdfResponse(doc: ReactElement, filename: string) {
  // react-pdf verwacht een <Document>-element
  const buffer = await renderToBuffer(doc as Parameters<typeof renderToBuffer>[0]);
  const safe = filename.replace(/[^\w.-]+/g, "_");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safe}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
