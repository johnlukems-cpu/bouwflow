import type { Metadata } from "next";
import { ResetRequestForm } from "./reset-form";

export const metadata: Metadata = { title: "Wachtwoord vergeten" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-1 text-center text-xl font-semibold text-navy-900">Wachtwoord vergeten</h1>
      <p className="mb-6 text-center text-sm text-slate-600">U ontvangt een link om een nieuw wachtwoord in te stellen.</p>
      <ResetRequestForm />
    </>
  );
}
