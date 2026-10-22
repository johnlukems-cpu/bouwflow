import { connection } from "next/server";
import type { Metadata } from "next";
import { getAppMode } from "@/lib/env";
import { FormAlert } from "@/components/ui/field";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "Registreren" };

export default async function SignUpPage() {
  await connection();
  const mode = getAppMode();
  return (
    <>
      <h1 className="mb-1 text-center text-xl font-semibold text-navy-900">Account aanmaken</h1>
      <p className="mb-6 text-center text-sm text-slate-500">Start met BouwFlow voor uw bedrijf</p>
      {mode !== "supabase" && (
        <div className="mb-4">
          <FormAlert tone="info" message="Registreren werkt pas nadat Supabase is gekoppeld." />
        </div>
      )}
      <SignUpForm disabled={mode !== "supabase"} />
    </>
  );
}
