import { getAppContext, hasModule } from "@/lib/auth/context";
import { getCustomer } from "@/lib/data/customers";
import { getWorkOrder } from "@/lib/data/execution";
import { issuerFromSettings, loadLogo, pdfResponse } from "@/lib/pdf/render";
import { WorkOrderPdf } from "@/lib/pdf/templates";
import { APPROVAL_STATUS_LABELS } from "@/lib/types";

export async function GET(_req: Request, { params }: RouteContext<"/pdf/werkbon/[id]">) {
  const { id } = await params;
  const ctx = await getAppContext();
  if (!hasModule(ctx, "werkbonnen")) return new Response("Niet in abonnement", { status: 403 });
  const data = await getWorkOrder(ctx, id);
  if (!data) return new Response("Niet gevonden", { status: 404 });
  const w = data.workOrder;
  const customer = w.project?.customer_id ? await getCustomer(ctx, w.project.customer_id) : null;
  return pdfResponse(
    <WorkOrderPdf
      logo={await loadLogo()}
      issuer={issuerFromSettings(ctx.membership.organization.name, ctx.settings)}
      number={w.work_order_number}
      project={`${w.project?.project_number ?? ""} ${w.project?.name ?? ""}`}
      customer={customer?.name ?? "-"}
      employee={w.employee?.full_name ?? "-"}
      date={w.work_date}
      times={`${w.start_time.slice(0, 5)} - ${w.end_time.slice(0, 5)} (pauze ${w.break_minutes} min.)`}
      hours={`${Number(w.hours).toLocaleString("nl-NL")} uur`}
      description={w.work_description}
      notes={w.notes}
      materials={data.materials}
      status={APPROVAL_STATUS_LABELS[w.status]}
      draft={w.status === "draft"}
    />,
    `Werkbon-${w.work_order_number}.pdf`,
  );
}
