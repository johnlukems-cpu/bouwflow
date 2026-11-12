/** Modules van BouwFlow en de koppeling met abonnementen (zie subscription_plans.modules). */
export const MODULE_KEYS = [
  "dashboard", "klanten", "projecten", "instellingen",
  "leveranciers", "medewerkers", "planning", "materialen", "voorraad", "calculatie", "inkoop",
  "werkbonnen", "uren", "offertes", "facturatie", "betalingen", "nacalculatie", "rapportages",
  "documenten", "klantportaal",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

/** Altijd beschikbaar, ongeacht het abonnement. */
export const ALWAYS_AVAILABLE_MODULES: readonly ModuleKey[] = ["dashboard", "klanten", "projecten", "instellingen"];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  klanten: "Klanten",
  projecten: "Projecten",
  instellingen: "Instellingen",
  leveranciers: "Leveranciers",
  medewerkers: "Medewerkers",
  planning: "Planning",
  materialen: "Materiaalbibliotheek",
  voorraad: "Voorraad",
  calculatie: "Voorcalculatie",
  inkoop: "Inkoop",
  werkbonnen: "Werkbonnen",
  uren: "Urenregistratie",
  offertes: "Offertes",
  facturatie: "Facturatie",
  betalingen: "Betalingen",
  nacalculatie: "Na-calculatie",
  rapportages: "Rapportages",
  documenten: "Documenten",
  klantportaal: "Klantportaal",
};
