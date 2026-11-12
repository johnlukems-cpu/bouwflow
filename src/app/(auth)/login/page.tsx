import type { Metadata } from "next";
import Link from "next/link";
import { getAppMode } from "@/lib/env";
import { FormAlert } from "@/components/ui/field";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Inloggen" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const mode = getAppMode();
  const next = typeof sp.volgende === "string" ? sp.volgende : undefined;
  return (
    <>
      <h1 className="mb-1 text-center text-xl font-semibold text-navy-900">Inloggen</h1>
      <p className="mb-6 text-center text-sm text-slate-600">Log in op uw BouwFlow-omgeving</p>
      {mode !== "supabase" && (
        <div className="mb-4 space-y-3">
          <FormAlert tone="info" message="Supabase is nog niet gekoppeld; inloggen werkt pas na het instellen van de verbinding." />
          {mode === "demo" && (
            <Link href="/dashboard" className="block text-center text-sm font-medium text-accent-700 hover:text-accent-700">
              Bekijk de demo-omgeving (alleen-lezen) →
            </Link>
          )}
        </div>
      )}
      {typeof sp.fout === "string" && <div className="mb-4"><FormAlert message="De link is ongeldig of verlopen. Log opnieuw in of vraag een nieuwe link aan." /></div>}
      <LoginForm next={next} disabled={mode !== "supabase"} />
    </>
  );
}
