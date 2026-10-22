import { connection } from "next/server";
import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getAppMode } from "@/lib/env";

export const metadata: Metadata = { title: "Installatie vereist" };

export default async function InstallPage() {
  await connection();
  if (getAppMode() !== "unconfigured") redirect("/dashboard");
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <Image src="/brand/bouwflow-icon.png" alt="" width={56} height={56} className="mb-4" />
        <h1 className="text-xl font-semibold text-navy-900">BouwFlow is nog niet gekoppeld</h1>
        <p className="mt-2 text-sm text-slate-600">
          Stel de omgevingsvariabelen <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> en{" "}
          <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in en start de applicatie opnieuw. Zie de README voor de stappen.
        </p>
      </div>
    </div>
  );
}
