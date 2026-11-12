import type { Metadata } from "next";
import { DocumentList } from "@/components/lists/documents";
import { ModuleGate } from "@/components/ui/module-gate";
import { PageHeader } from "@/components/ui/page-header";
import { getAppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listDocuments } from "@/lib/data/finance";

export const metadata: Metadata = { title: "Documenten" };

export default async function DocumentsPage() {
  const ctx = await getAppContext();
  const docs = await listDocuments(ctx);
  return (
    <ModuleGate ctx={ctx} module="documenten">
      <PageHeader title="Documenten" description="Alle documenten van uw organisatie. Projectdocumenten uploadt u bij voorkeur vanuit het project." />
      <DocumentList documents={docs} demo={ctx.mode === "demo"} canUpload={can(ctx.membership.role, "documents.write")} hidden={{}} back="/documenten" title="Alle documenten" />
    </ModuleGate>
  );
}
