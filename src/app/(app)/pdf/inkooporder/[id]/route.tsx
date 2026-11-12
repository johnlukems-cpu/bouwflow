import { getAppContext, hasModule } from "@/lib/auth/context";
import { getPurchaseOrder } from "@/lib/data/execution";
import { getSupplier } from "@/lib/data/resources";
import { sum } from "@/lib/finance/money";
import { formatDate } from "@/lib/format";
import { issuerFromSettings, loadLogo, pdfResponse } from "@/lib/pdf/render";
import { PurchaseOrderPdf } from "@/lib/pdf/templates";

export async function GET(_req: Request, { params }: RouteContext<"/pdf/inkooporder/[id]">) {
  const { id } = await params;
  const ctx = await getAppContext();
  if (!hasModule(ctx, "inkoop")) return new Response("Niet in abonnement", { status: 403 });
  const data = await getPurchaseOrder(ctx, id);
  if (!data) return new Response("Niet gevonden", { status: 404 });
  const { order: o, lines } = data;
  const supplier = await getSupplier(ctx, o.supplier_id);
  return pdfResponse(
    <PurchaseOrderPdf
      logo={await loadLogo()}
      issuer={issuerFromSettings(ctx.membership.organization.name, ctx.settings)}
      number={o.purchase_order_number}
      supplier={{ name: supplier?.name ?? o.supplier?.name ?? "-", contact_person: supplier?.contact_person, address_line: supplier?.address_line, city: supplier?.city, vat_number: supplier?.vat_number }}
      meta={[
        ["Ordernummer", o.purchase_order_number],
        ["Orderdatum", formatDate(o.order_date)],
        ["Gewenste levering", formatDate(o.expected_date)],
        ["Project / afleveradres", o.project ? `${o.project.project_number} ${o.project.name}` : "Magazijn"],
      ]}
      lines={lines}
      total={sum(lines.map((l) => l.line_total)).toFixed(2)}
      currency={o.currency_code}
      notes={o.notes}
      draft={o.status === "draft"}
    />,
    `Inkooporder-${o.purchase_order_number}.pdf`,
  );
}
