"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
      <AlertTriangle className="mx-auto size-10 text-accent-500" aria-hidden />
      <h1 className="mt-4 text-lg font-semibold text-slate-900">Er is iets misgegaan</h1>
      <p className="mt-2 text-sm text-slate-600">
        De gegevens konden niet worden geladen. Probeer het opnieuw. Blijft het probleem bestaan, neem dan contact op met de beheerder.
      </p>
      {error.digest && <p className="mt-2 text-xs text-slate-500">Foutcode: {error.digest}</p>}
      <Button className="mt-6" onClick={reset}>
        Opnieuw proberen
      </Button>
    </div>
  );
}
