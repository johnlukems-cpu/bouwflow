/**
 * Centrale toegang tot configuratie. Alleen NEXT_PUBLIC_*-waarden mogen in
 * browsercode terechtkomen. Geheime sleutels (service role) worden in deze
 * fase niet gebruikt en mogen NOOIT een NEXT_PUBLIC_-prefix krijgen.
 */
export function getSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  if (!url || !key) return null;
  return { url, key };
}

export type AppMode = "supabase" | "demo" | "unconfigured";

/**
 * - supabase:     Supabase is geconfigureerd → echte gegevens, echte login.
 * - demo:         geen Supabase; alleen-lezen demo met vaste voorbeeldgegevens.
 *                 Standaard aan buiten productie; in productie alleen met
 *                 BOUWFLOW_DEMO_MODE=true.
 * - unconfigured: productie zonder Supabase en zonder demo → installatiescherm.
 */
export function getAppMode(): AppMode {
  if (getSupabaseConfig()) return "supabase";
  const demoFlag = process.env.BOUWFLOW_DEMO_MODE;
  if (demoFlag === "true") return "demo";
  if (demoFlag === "false") return "unconfigured";
  return process.env.NODE_ENV === "production" ? "unconfigured" : "demo";
}

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
