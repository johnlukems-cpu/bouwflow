import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "navy",
  unavailable,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: ReactNode;
  tone?: "navy" | "orange" | "green" | "red";
  unavailable?: boolean;
}) {
  const toneClass = {
    navy: "bg-brand-50 text-brand-700",
    orange: "bg-accent-50 text-accent-700",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
  }[tone];
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", unavailable ? "bg-slate-100 text-slate-500" : toneClass)}>
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
      <p className={cn("mt-2 text-2xl font-semibold tracking-tight tabular-nums", unavailable ? "text-slate-500" : "text-navy-900")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-600">{hint}</p>}
    </div>
  );
}
