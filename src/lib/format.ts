export function formatDate(value: string | null | undefined, locale = "nl-SR"): string {
  if (!value) return "—";
  // Datums (YYYY-MM-DD) zonder tijdzoneverschuiving tonen
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return safeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }, d);
}

export function formatDateTime(value: string, locale = "nl-SR", timeZone = "America/Paramaribo"): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return safeFormat(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone }, d);
}

function safeFormat(locale: string, opts: Intl.DateTimeFormatOptions, d: Date) {
  try {
    return new Intl.DateTimeFormat(locale, opts).format(d);
  } catch {
    return new Intl.DateTimeFormat("nl-NL", { ...opts, timeZone: "UTC" }).format(d);
  }
}
