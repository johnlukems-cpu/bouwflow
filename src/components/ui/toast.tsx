"use client";

import { CheckCircle2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FLASH_MESSAGES, type FlashKey } from "@/lib/flash";

export function FlashToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const key = params.get("melding");
  // Toestand afleiden tijdens het renderen (geen setState in een effect).
  const [seen, setSeen] = useState<string | null>(null);
  const [current, setCurrent] = useState<FlashKey | null>(null);
  if (key !== seen) {
    setSeen(key);
    if (key && key in FLASH_MESSAGES) setCurrent(key as FlashKey);
  }

  // Parameter uit de URL verwijderen zodat de melding niet opnieuw verschijnt.
  useEffect(() => {
    if (!key) return;
    const next = new URLSearchParams(params.toString());
    next.delete("melding");
    router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`, { scroll: false });
  }, [key, params, pathname, router]);

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setCurrent(null), 5000);
    return () => clearTimeout(t);
  }, [current, seen]);

  const message = current ? FLASH_MESSAGES[current] : null;
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:justify-end sm:px-6">
      <div role="status" className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-navy-900 p-4 text-sm text-white shadow-lg">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent-400" aria-hidden />
        <p className="flex-1">{message}</p>
        <button type="button" onClick={() => setCurrent(null)} className="text-white/70 hover:text-white" aria-label="Melding sluiten">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
