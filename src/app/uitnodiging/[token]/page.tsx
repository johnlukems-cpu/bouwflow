import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LinkButton } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ACTIVE_ORG_COOKIE } from "@/lib/auth/context";
import { getAppMode } from "@/lib/env";
import { withFlash } from "@/lib/flash";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Uitnodiging", robots: { index: false } };

async function accept(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  if (!/^[0-9a-f]{64}$/.test(token)) redirect("/login");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("accept_invitation", { raw_token: token });
  if (error || !data) redirect(`/uitnodiging/${token}?fout=1`);
  (await cookies()).set(ACTIVE_ORG_COOKIE, String(data), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect(withFlash("/dashboard", "uitnodiging-geaccepteerd"));
}

export default async function InvitationPage({ params, searchParams }: PageProps<"/uitnodiging/[token]">) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  if (getAppMode() !== "supabase" || !/^[0-9a-f]{64}$/.test(token)) redirect("/login");
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <Image src="/brand/bouwflow-logo-light.png" alt="BouwFlow" width={1161} height={998} className="mx-auto mb-4 h-auto w-32" />
        <h1 className="text-center text-xl font-semibold text-navy-900">Uitnodiging voor BouwFlow</h1>
        {sp.fout && <div className="mt-4"><FormAlert message="Deze uitnodiging is ongeldig, verlopen, al gebruikt, of bedoeld voor een ander e-mailadres." /></div>}
        {auth.user ? (
          <form action={accept} className="mt-6 space-y-4 text-center">
            <input type="hidden" name="token" value={token} />
            <p className="text-sm text-slate-600">U bent ingelogd als <strong>{auth.user.email}</strong>. Accepteer de uitnodiging om toegang te krijgen tot de organisatie.</p>
            <SubmitButton className="w-full">Uitnodiging accepteren</SubmitButton>
          </form>
        ) : (
          <div className="mt-6 space-y-3 text-center text-sm text-slate-600">
            <p>Log in of maak een account aan met het e-mailadres waarop u bent uitgenodigd. Open daarna deze link opnieuw.</p>
            <LinkButton href={`/login?volgende=/uitnodiging/${token}`} className="w-full">Inloggen</LinkButton>
            <Link href="/registreren" className="block font-medium text-brand-700 hover:underline">Account aanmaken</Link>
          </div>
        )}
      </div>
    </div>
  );
}
