import { SearchX } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
      <SearchX className="mx-auto size-10 text-slate-500" aria-hidden />
      <h1 className="mt-4 text-lg font-semibold text-slate-900">Niet gevonden</h1>
      <p className="mt-2 text-sm text-slate-600">Deze pagina of dit record bestaat niet, of u heeft er geen toegang toe.</p>
      <LinkButton href="/dashboard" className="mt-6">
        Naar dashboard
      </LinkButton>
    </div>
  );
}
