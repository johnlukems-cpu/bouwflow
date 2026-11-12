import { NextResponse, type NextRequest } from "next/server";
import { getAppContext } from "@/lib/auth/context";
import { isUuid } from "@/lib/data/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Download via een kortlevende signed URL (60 s); RLS bepaalt of de gebruiker het document mag zien. */
export async function GET(_req: NextRequest, { params }: RouteContext<"/documenten/[id]/download">) {
  const { id } = await params;
  const ctx = await getAppContext();
  if (ctx.mode !== "supabase" || !isUuid(id)) return new NextResponse("Niet beschikbaar", { status: 404 });
  const supabase = await createSupabaseServerClient();
  const { data: doc } = await supabase.from("documents").select("storage_path, name").eq("id", id).eq("organization_id", ctx.membership.organization.id).maybeSingle();
  if (!doc) return new NextResponse("Niet gevonden", { status: 404 });
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path as string, 60, { download: doc.name as string });
  if (error || !data) return new NextResponse("Download niet beschikbaar", { status: 404 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
