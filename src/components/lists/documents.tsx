import { File, FileImage, FolderOpen } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { UploadForm } from "@/components/ui/upload-form";
import { formatBytes } from "@/lib/documents";
import { formatDate } from "@/lib/format";
import type { DocumentFile } from "@/lib/types";

const CAT: Record<string, string> = { tekening: "Tekening", vergunning: "Vergunning", foto: "Foto", contract: "Contract", offerte: "Offerte", factuur: "Factuur", werkbon: "Werkbon", overig: "Overig" };

export function DocumentList({ documents, demo, canUpload, hidden, back, title = "Documenten" }: { documents: DocumentFile[]; demo: boolean; canUpload: boolean; hidden: Record<string, string>; back: string; title?: string }) {
  return (
    <Card>
      <CardHeader title={title} description="Bestanden staan in beveiligde opslag; alleen uw organisatie heeft toegang. Downloadlinks zijn 60 seconden geldig." />
      {documents.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Nog geen documenten" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {documents.map((d) => {
            const Icon = d.mime_type.startsWith("image/") ? FileImage : File;
            return (
              <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                <Icon className="size-5 shrink-0 text-slate-500" aria-hidden />
                <div className="min-w-0 flex-1">
                  {demo ? (
                    <span className="block truncate font-medium text-slate-900">{d.name}</span>
                  ) : (
                    <a href={`/documenten/${d.id}/download`} className="block truncate font-medium text-brand-700 hover:underline">{d.name}</a>
                  )}
                  <p className="text-xs text-slate-600">{CAT[d.category] ?? d.category} · {formatBytes(d.size_bytes)} · {formatDate(d.created_at)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {canUpload && (
        <CardBody className="border-t border-slate-100">
          <UploadForm hidden={{ ...hidden, back }} disabled={demo} />
        </CardBody>
      )}
    </Card>
  );
}
