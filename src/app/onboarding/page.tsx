import { connection } from "next/server";
import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getAppMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Organisatie aanmaken" };

export default async function OnboardingPage() {
  await connection();
  if (getAppMode() !== "supabase") redirect("/dashboard");
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { count } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id)
    .eq("is_active", true);
  if ((count ?? 0) > 0) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <Image src="/brand/bouwflow-logo-light.png" alt="BouwFlow" width={1161} height={998} className="mx-auto mb-4 h-auto w-32" />
        <h1 className="text-center text-xl font-semibold text-navy-900">Welkom bij BouwFlow</h1>
        <p className="mb-6 mt-1 text-center text-sm text-slate-600">
          Maak de organisatie aan voor uw bedrijf. U wordt automatisch eigenaar en kunt later collega&apos;s toevoegen.
        </p>
        <OnboardingForm />
      </div>
    </div>
  );
}
