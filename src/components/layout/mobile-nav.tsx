"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BrandMark } from "./brand";
import { SidebarNav } from "./sidebar";

export function MobileNav({ modules, isPlatformAdmin }: { modules: string[]; isPlatformAdmin?: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="-ml-2 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Menu openen"
        aria-expanded={open}
      >
        <Menu className="size-6" />
      </button>
      {open &&
        createPortal(
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigatie">
          <div className="absolute inset-0 bg-navy-950/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-navy-900 shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
              <BrandMark inverted />
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10" aria-label="Menu sluiten">
                <X className="size-5" />
              </button>
            </div>
            <SidebarNav onNavigate={() => setOpen(false)} modules={modules} isPlatformAdmin={isPlatformAdmin} />
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}
