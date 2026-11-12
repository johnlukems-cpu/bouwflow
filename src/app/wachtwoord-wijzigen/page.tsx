import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getAppMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Nieuw wachtwoord" };

export default async function ChangePasswordPage() {
  if (getAppMode() !== "supabase") redirect("/login");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?fout=link");
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <Image src="/brand/bouwflow-logo-light.png" alt="BouwFlow" width={1161} height={998} className="mx-auto mb-4 h-auto w-28" />
        <h1 className="mb-6 text-center text-xl font-semibold text-navy-900">Nieuw wachtwoord instellen</h1>
        <NewPasswordForm />
      </div>
    </div>
  );
}
