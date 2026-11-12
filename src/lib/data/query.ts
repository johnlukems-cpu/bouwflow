import "server-only";
import type { AppContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Supa = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Result<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

/**
 * Leest gegevens uit Supabase (gefilterd op de actieve organisatie door de
 * aanroeper én door RLS), of uit de demo-dataset in demo-modus.
 */
export async function load<T>(ctx: AppContext, label: string, demo: () => T, build: (sb: Supa, orgId: string) => Result<T>): Promise<T> {
  if (ctx.mode === "demo") return demo();
  const sb = await createSupabaseServerClient();
  const { data, error } = await build(sb, ctx.membership.organization.id);
  if (error) throw new Error(`${label} konden niet worden geladen: ${error.message}`);
  return (data ?? ([] as unknown)) as T;
}

/** Normaliseert een PostgREST-embed (object of array) naar één object. */
export function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/** Zet numerieke kolommen om naar strings (PostgREST levert numeric als number of string). */
export function numStr<T extends object>(row: T, keys: (keyof T)[]): T {
  const out = { ...row } as Record<keyof T, unknown>;
  for (const k of keys) {
    const v = out[k];
    if (v !== null && v !== undefined) out[k] = String(v);
  }
  return out as T;
}
