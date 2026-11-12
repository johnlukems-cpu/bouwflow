import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SalesDocumentPdf } from "./templates";
import { pdfText } from "./format";

describe("PDF-generatie", () => {
  it("maakt een geldige PDF met meerdere pagina's bij veel regels", async () => {
    const logo = readFileSync(path.join(process.cwd(), "public/brand/bouwflow-compact-light.png"));
    const lines = Array.from({ length: 60 }, (_, i) => ({ description: `Regel ${i + 1}`, quantity: "1", unit: "st", unit_price: "100", tax_rate_percent: "10", line_amount: "100.00" }));
    const buf = await renderToBuffer(
      <SalesDocumentPdf logo={logo} issuer={{ name: "Test N.V." }} kind="factuur" heading="Factuur" number="FAC-2026-0001" title="Test" customer={{ name: "Klant" }} meta={[["Factuurnummer", "FAC-2026-0001"]]} lines={lines} subtotal="6000.00" taxGroups={[{ rate_percent: "10", taxable_amount: "6000.00", tax_amount: "600.00" }]} total="6600.00" currency="SRD" pricesIncludeTax={false} draft={false} />,
    );
    const head = buf.subarray(0, 5).toString();
    expect(head).toBe("%PDF-");
    const pages = (buf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;
    expect(pages).toBeGreaterThan(1);
  }, 30000);

  it("vervangt tekens die standaard PDF-lettertypen niet kennen", () => {
    expect(pdfText("SRD 1.000 − 5")).toBe("SRD 1.000 - 5");
  });
});
