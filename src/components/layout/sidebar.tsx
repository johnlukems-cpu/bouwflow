"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "@/lib/navigation";
import { cn } from "@/components/ui/cn";
import { BrandMark } from "./brand";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Hoofdnavigatie" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon className={cn("size-4.5 shrink-0", active ? "text-accent-400" : "text-white/50 group-hover:text-white/80")} aria-hidden />
                    <span className="flex-1 truncate">{item.label}</span>
                    {!item.available && (
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/50" title="Toekomstige functionaliteit">
                        Later
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ orgName }: { orgName: string }) {
  return (
    <aside className="no-print hidden w-64 shrink-0 flex-col bg-navy-900 lg:fixed lg:inset-y-0 lg:flex">
      <div className="flex h-16 items-center border-b border-white/10 px-5">
        <BrandMark inverted />
      </div>
      <SidebarNav />
      <div className="border-t border-white/10 px-5 py-3 text-xs text-white/50">
        <p className="truncate" title={orgName}>{orgName}</p>
        <p className="mt-0.5 text-white/30">Projecten in vertrouwen</p>
      </div>
    </aside>
  );
}
