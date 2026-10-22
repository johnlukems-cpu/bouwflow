/**
 * Bevestigingsmeldingen worden via een vaste sleutel in de URL doorgegeven
 * (?melding=...). Alleen sleutels uit deze lijst worden getoond, zodat er
 * nooit willekeurige tekst uit de URL op het scherm komt.
 */
export const FLASH_MESSAGES = {
  "klant-aangemaakt": "Klant is aangemaakt.",
  "klant-bijgewerkt": "Klantgegevens zijn opgeslagen.",
  "klant-gearchiveerd": "Klant is gearchiveerd.",
  "klant-hersteld": "Klant is hersteld uit het archief.",
  "project-aangemaakt": "Project is aangemaakt.",
  "project-bijgewerkt": "Project is opgeslagen.",
  "project-gearchiveerd": "Project is gearchiveerd.",
  "project-hersteld": "Project is hersteld uit het archief.",
  "status-gewijzigd": "Projectstatus is gewijzigd.",
  "instellingen-opgeslagen": "Instellingen zijn opgeslagen.",
  "tarief-toegevoegd": "Belastingtarief is toegevoegd.",
  "tarief-bijgewerkt": "Belastingtarief is bijgewerkt.",
  "organisatie-gewisseld": "U werkt nu in een andere organisatie.",
  "welkom": "Welkom bij BouwFlow! Uw organisatie is aangemaakt.",
  "demo-alleen-lezen": "Demo-modus: wijzigingen worden niet opgeslagen.",
} as const;

export type FlashKey = keyof typeof FLASH_MESSAGES;

export function withFlash(path: string, key: FlashKey) {
  return `${path}${path.includes("?") ? "&" : "?"}melding=${key}`;
}
