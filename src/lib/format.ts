/** Datum als DD-MM-JJJJ. (locale blijft voor compatibiliteit; de notatie is altijd DD-MM-JJJJ.) */
export function formatDate(value: string | null | undefined, _locale?: string): string {
  void _locale;
  if (!value) return "—";
  // Datums (YYYY-MM-DD) zonder tijdzoneverschuiving tonen
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDDMMYYYY(d, "UTC");
}

export function formatDateTime(value: string, locale = "nl-SR", timeZone = "America/Paramaribo"): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const time = safeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }, d);
  return `${formatDDMMYYYY(d, timeZone)} ${time}`;
}

function safeFormat(locale: string, opts: Intl.DateTimeFormatOptions, d: Date) {
  try {
    return new Intl.DateTimeFormat(locale, opts).format(d);
  } catch {
    return new Intl.DateTimeFormat("nl-NL", { ...opts, timeZone: "UTC" }).format(d);
  }
}

/** Datumnotatie DD-MM-JJJJ (Surinaamse/Nederlandse conventie), onafhankelijk van de browser. */
export function formatDDMMYYYY(d: Date, timeZone = "America/Paramaribo"): string {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone }).formatToParts(d);
  } catch {
    parts = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).formatToParts(d);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")}`;
}

/** Vandaag als YYYY-MM-DD in de tijdzone van de organisatie. */
export function todayISO(timeZone = "America/Paramaribo"): string {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).format(new Date());
  return parts;
}
