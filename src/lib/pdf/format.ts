import { formatMoney } from "@/lib/finance/money";
import { formatDate } from "@/lib/format";

/** PDF-standaardlettertypen ondersteunen geen smalle spaties en het minteken (U+2212). */
export function pdfText(v: string): string {
  return v.replace(/[  ]/g, " ").replace(/−/g, "-");
}
export const pm = (v: Parameters<typeof formatMoney>[0], cur: string) => pdfText(formatMoney(v, cur, "nl-NL"));
export const pd = (v: string | null | undefined) => formatDate(v);
export const pq = (v: string | number) => pdfText(Number(v).toLocaleString("nl-NL", { maximumFractionDigits: 3 }));
