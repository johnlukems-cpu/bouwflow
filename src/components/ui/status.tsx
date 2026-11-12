import {
  APPROVAL_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
  PO_STATUS_LABELS,
  QUOTE_STATUS_LABELS,
  TASK_STATUS_LABELS,
  type ApprovalStatus,
  type InvoiceType,
  type PaymentStatus,
  type PurchaseOrderStatus,
  type QuoteStatus,
  type TaskStatus,
} from "@/lib/types";
import { Badge, type Tone } from "./badge";

function dot(tone: Tone, label: string) {
  return (
    <Badge tone={tone}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </Badge>
  );
}

const APPROVAL: Record<ApprovalStatus, Tone> = { draft: "slate", submitted: "amber", approved: "green", rejected: "red" };
export const ApprovalBadge = ({ status }: { status: ApprovalStatus }) => dot(APPROVAL[status], APPROVAL_STATUS_LABELS[status]);

const TASK: Record<TaskStatus, Tone> = { todo: "slate", in_progress: "blue", done: "green", cancelled: "red" };
export const TaskBadge = ({ status }: { status: TaskStatus }) => dot(TASK[status], TASK_STATUS_LABELS[status]);

const PO: Record<PurchaseOrderStatus, Tone> = { draft: "slate", ordered: "blue", partially_received: "amber", received: "green", cancelled: "red" };
export const PurchaseOrderBadge = ({ status }: { status: PurchaseOrderStatus }) => dot(PO[status], PO_STATUS_LABELS[status]);

const QUOTE: Record<QuoteStatus, Tone> = { draft: "slate", sent: "blue", accepted: "green", rejected: "red", superseded: "purple", cancelled: "red" };
export function QuoteBadge({ status, validUntil, today }: { status: QuoteStatus; validUntil?: string | null; today?: string }) {
  if (status === "sent" && validUntil && today && validUntil < today) return dot("amber", "Verlopen");
  return dot(QUOTE[status], QUOTE_STATUS_LABELS[status]);
}

const PAY: Record<PaymentStatus, Tone> = { draft: "slate", cancelled: "red", credit: "purple", paid: "green", overdue: "red", partially_paid: "amber", open: "blue" };
export const PaymentBadge = ({ status }: { status: PaymentStatus }) => dot(PAY[status], PAYMENT_STATUS_LABELS[status]);

export const InvoiceTypeBadge = ({ type }: { type: InvoiceType }) => (
  <Badge tone={type === "credit" ? "purple" : type === "standard" ? "slate" : "orange"}>{INVOICE_TYPE_LABELS[type]}</Badge>
);
