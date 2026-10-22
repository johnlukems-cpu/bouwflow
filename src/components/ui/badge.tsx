import type { ReactNode } from "react";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/types";
import { cn } from "./cn";

export type Tone = "slate" | "blue" | "amber" | "green" | "red" | "orange" | "purple";

const tones: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-brand-50 text-brand-700 ring-brand-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  orange: "bg-accent-50 text-accent-700 ring-accent-100",
  purple: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function Badge({ tone = "slate", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONES: Record<ProjectStatus, Tone> = {
  concept: "slate",
  planned: "purple",
  in_progress: "blue",
  paused: "amber",
  completed: "green",
  cancelled: "red",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge tone={STATUS_TONES[status]}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {PROJECT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge tone="orange" className={className}>
      Demo
    </Badge>
  );
}

export function FutureBadge() {
  return <Badge tone="slate">Binnenkort</Badge>;
}
