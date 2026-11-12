import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className, sort }: { children?: ReactNode; className?: string; sort?: "ascending" | "descending" }) {
  return (
    <th scope="col" aria-sort={sort} className={cn("bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle text-slate-700", className)}>{children}</td>;
}

/** Sorteerbare kolomkop; behoudt bestaande filters in de URL. */
export function SortTh({
  label,
  column,
  current,
  dir,
  params,
  basePath,
  className,
}: {
  label: string;
  column: string;
  current: string;
  dir: "asc" | "desc";
  params: Record<string, string | undefined>;
  basePath: string;
  className?: string;
}) {
  const active = current === column;
  const nextDir = active && dir === "asc" ? "desc" : "asc";
  const sp = new URLSearchParams();
  Object.entries({ ...params, sort: column, dir: nextDir }).forEach(([k, v]) => v && sp.set(k, v));
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <Th className={className} sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}>
      <Link href={`${basePath}?${sp.toString()}`} className={cn("inline-flex items-center gap-1 hover:text-slate-800", active && "text-slate-800")}>
        {label}
        <Icon className="size-3.5" aria-hidden />
      </Link>
    </Th>
  );
}
