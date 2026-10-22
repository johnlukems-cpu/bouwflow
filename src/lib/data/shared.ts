import "server-only";

export type SortDir = "asc" | "desc";

/** Maakt zoektermen veilig voor PostgREST-filters (geen operators/wildcards). */
export function sanitizeSearch(q: string | undefined | null): string {
  return (q ?? "").replace(/[,()\\%*_:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

export function pickSort<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value ?? "") ? (value as T) : fallback;
}

export function pickDir(value: string | undefined, fallback: SortDir = "asc"): SortDir {
  return value === "asc" || value === "desc" ? value : fallback;
}

export function matchesSearch(fields: (string | null | undefined)[], q: string) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(needle));
}

export function compareValues(a: unknown, b: unknown, dir: SortDir) {
  const mul = dir === "asc" ? 1 : -1;
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return (a - b) * mul;
  return String(a).localeCompare(String(b), "nl", { numeric: true }) * mul;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return !!value && UUID_RE.test(value);
}
