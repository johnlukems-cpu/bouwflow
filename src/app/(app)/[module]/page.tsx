import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FutureFeature } from "@/components/ui/future-feature";
import { PageHeader } from "@/components/ui/page-header";
import { PLANNED_MODULES } from "@/lib/modules";

export const dynamicParams = false;

export function generateStaticParams() {
  return PLANNED_MODULES.map((m) => ({ module: m.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[module]">): Promise<Metadata> {
  const { module } = await params;
  return { title: PLANNED_MODULES.find((m) => m.slug === module)?.title ?? "Module" };
}

export default async function PlannedModulePage({ params }: PageProps<"/[module]">) {
  const { module } = await params;
  const mod = PLANNED_MODULES.find((m) => m.slug === module);
  if (!mod) notFound();

  return (
    <>
      <PageHeader title={mod.title} description={mod.intro} />
      <div className="space-y-6">
        <FutureFeature title={`De module ${mod.title} is nog niet beschikbaar`}>
          Deze module staat gepland voor een volgende bouwfase. Hieronder ziet u wat de module gaat bieden. Er worden op deze pagina geen gegevens verwerkt.
        </FutureFeature>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Geplande functionaliteit" />
            <CardBody>
              <ul className="space-y-2.5">
                {mod.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-sm text-slate-700">
                    <Circle className="mt-0.5 size-4 shrink-0 text-slate-300" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          {mod.foundation && (
            <Card>
              <CardHeader title="Al voorbereid" description="Fundament dat in de huidige fase is gebouwd" />
              <CardBody>
                <ul className="space-y-2.5">
                  {mod.foundation.map((f) => (
                    <li key={f} className="flex gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
