import { Clock } from "lucide-react";
import type { ReactNode } from "react";

/** Duidelijke markering voor functionaliteit die nog niet is gebouwd. */
export function FutureFeature({ title, children, compact }: { title: string; children?: ReactNode; compact?: boolean }) {
  return (
    <div className={compact ? "rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-4" : "rounded-xl border border-dashed border-slate-300 bg-white p-6"}>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Clock className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
            {title}
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">Toekomstige functionaliteit</span>
          </p>
          {children && <div className="mt-1 text-sm text-slate-600">{children}</div>}
        </div>
      </div>
    </div>
  );
}
