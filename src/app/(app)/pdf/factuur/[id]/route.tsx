import { getAppContext, hasModule } from "@/lib/auth/context";
import { getInvoice } from "@/lib/data/finance";
import { pdfResponse } from "@/lib/pdf/render";
import { buildSalesPdf } from "@/lib/pdf/sales";

export async function GET(_req: Request, { params }: RouteContext<"/pdf/factuur/[id]">) {
  const { id } = await params;
  const ctx = await getAppContext();
  if (!hasModule(ctx, "facturatie")) return new Response("Niet in abonnement", { status: 403 });
  const data = await getInvoice(ctx, id);
  if (!data) return new Response("Niet gevonden", { status: 404 });
  const { element, filename } = await buildSalesPdf(ctx, "invoice", data.invoice, data.lines);
  return pdfResponse(element, filename);
}
