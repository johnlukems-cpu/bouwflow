import Link from "next/link";
import { Check, ClipboardList, Clock, ShoppingCart } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ApprovalBadge, PurchaseOrderBadge } from "@/components/ui/status";
import { Table, Td, Th } from "@/components/ui/table";
import { approveTimeEntry, setTimeEntryStatus } from "@/app/(app)/uren/actions";
import { formatMoney } from "@/lib/finance/money";
import { formatDate } from "@/lib/format";
import type { PurchaseOrder, TimeEntry, WorkOrder } from "@/lib/types";

export function WorkOrderTable({ workOrders, showProject = true }: { workOrders: WorkOrder[]; showProject?: boolean }) {
  if (workOrders.length === 0) return <EmptyState icon={ClipboardList} title="Geen werkbonnen" />;
  return (
    <Table>
      <thead>
        <tr>
          <Th>Nummer</Th>
          <Th>Datum</Th>
          <Th className="hidden md:table-cell">Medewerker</Th>
          {showProject && <Th className="hidden lg:table-cell">Project</Th>}
          <Th className="text-right">Uren</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {workOrders.map((w) => (
          <tr key={w.id} className="hover:bg-slate-50">
            <Td className="whitespace-nowrap">
              <Link href={`/werkbonnen/${w.id}`} className="font-medium text-slate-900 hover:text-brand-700">{w.work_order_number}</Link>
              <p className="max-w-[16rem] truncate text-xs text-slate-600 md:hidden">{w.employee?.full_name}</p>
            </Td>
            <Td className="whitespace-nowrap">{formatDate(w.work_date)}</Td>
            <Td className="hidden md:table-cell">{w.employee?.full_name}</Td>
            {showProject && <Td className="hidden lg:table-cell">{w.project?.project_number} {w.project?.name}</Td>}
            <Td className="text-right tabular-nums">{Number(w.hours).toLocaleString("nl-NL")}</Td>
            <Td><ApprovalBadge status={w.status} /></Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function PurchaseOrderTable({ orders, locale, showProject = true }: { orders: PurchaseOrder[]; locale: string; showProject?: boolean }) {
  if (orders.length === 0) return <EmptyState icon={ShoppingCart} title="Geen inkooporders" />;
  return (
    <Table>
      <thead>
        <tr>
          <Th>Nummer</Th>
          <Th>Leverancier</Th>
          {showProject && <Th className="hidden lg:table-cell">Project</Th>}
          <Th className="hidden sm:table-cell">Orderdatum</Th>
          <Th className="text-right">Totaal</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {orders.map((o) => (
          <tr key={o.id} className="hover:bg-slate-50">
            <Td className="whitespace-nowrap"><Link href={`/inkoop/${o.id}`} className="font-medium text-slate-900 hover:text-brand-700">{o.purchase_order_number}</Link></Td>
            <Td>{o.supplier?.name}</Td>
            {showProject && <Td className="hidden lg:table-cell">{o.project ? `${o.project.project_number} ${o.project.name}` : "Magazijn"}</Td>}
            <Td className="hidden sm:table-cell whitespace-nowrap">{formatDate(o.order_date)}</Td>
            <Td className="whitespace-nowrap text-right tabular-nums">{formatMoney(o.total ?? 0, o.currency_code, locale)}</Td>
            <Td><PurchaseOrderBadge status={o.status} /></Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function TimeEntryTable({ entries, canApprove, back, showProject = true, demo }: { entries: TimeEntry[]; canApprove: boolean; back: string; showProject?: boolean; demo: boolean }) {
  if (entries.length === 0) return <EmptyState icon={Clock} title="Geen uren geregistreerd" />;
  return (
    <Table>
      <thead>
        <tr>
          <Th>Datum</Th>
          <Th>Medewerker</Th>
          {showProject && <Th className="hidden lg:table-cell">Project</Th>}
          <Th className="hidden md:table-cell">Omschrijving</Th>
          <Th className="text-right">Uren</Th>
          <Th>Status</Th>
          {canApprove && <Th><span className="sr-only">Acties</span></Th>}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {entries.map((t) => (
          <tr key={t.id}>
            <Td className="whitespace-nowrap">
              {formatDate(t.entry_date)}
              {t.start_time && <p className="text-xs text-slate-600">{t.start_time.slice(0, 5)}–{t.end_time?.slice(0, 5)}</p>}
            </Td>
            <Td>{t.employee?.full_name}</Td>
            {showProject && <Td className="hidden lg:table-cell">{t.project?.project_number} {t.project?.name}</Td>}
            <Td className="hidden md:table-cell text-slate-600">{t.description ?? "—"}</Td>
            <Td className="text-right tabular-nums">{Number(t.hours).toLocaleString("nl-NL")}</Td>
            <Td><ApprovalBadge status={t.status} /></Td>
            {canApprove && (
              <Td className="whitespace-nowrap text-right">
                {(t.status === "submitted" || t.status === "draft") && !t.work_order_id && (
                  <div className="flex justify-end gap-1">
                    <form action={approveTimeEntry}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="back" value={back} />
                      <button type="submit" disabled={demo} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                        <Check className="size-4" aria-hidden /> Goedkeuren
                      </button>
                    </form>
                    <form action={setTimeEntryStatus}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <input type="hidden" name="back" value={back} />
                      <button type="submit" disabled={demo} className="h-9 rounded-lg px-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">Afkeuren</button>
                    </form>
                  </div>
                )}
              </Td>
            )}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
