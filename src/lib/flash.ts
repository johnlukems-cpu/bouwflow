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
  "opgeslagen": "Wijzigingen zijn opgeslagen.",
  "geen-rechten": "Deze actie is niet toegestaan (rechten, abonnement of module).",
  "actie-mislukt": "De actie is niet gelukt. Controleer de gegevens en probeer het opnieuw.",
  "aangemaakt": "Het record is aangemaakt.",
  "verwijderd": "Het record is verwijderd.",
  "gearchiveerd": "Het record is gearchiveerd.",
  "hersteld": "Het record is hersteld.",
  "goedgekeurd": "Goedgekeurd en verwerkt in de projectkosten.",
  "afgekeurd": "Afgekeurd.",
  "ingediend": "Ingediend ter goedkeuring.",
  "offerte-verzonden": "Offerte is definitief gemaakt en kan naar de klant.",
  "offerte-geaccepteerd": "Offerte is geaccepteerd; het project is bijgewerkt.",
  "offerte-afgewezen": "Offerte is als afgewezen geregistreerd.",
  "offerte-herzien": "Nieuwe offerteversie aangemaakt.",
  "factuur-definitief": "Factuur is definitief gemaakt en genummerd.",
  "betaling-geregistreerd": "Betaling is geregistreerd.",
  "ontvangst-geboekt": "Ontvangst is geboekt.",
  "besteld": "Inkooporder is besteld.",
  "voorraad-geboekt": "Voorraadmutatie is geboekt.",
  "kosten-geboekt": "Kosten zijn geboekt.",
  "uitnodiging-aangemaakt": "Uitnodiging is aangemaakt. Deel de link met de collega.",
  "uitnodiging-geaccepteerd": "Welkom! U bent toegevoegd aan de organisatie.",
  "lid-bijgewerkt": "Gebruiker is bijgewerkt.",
  "portaallink-aangemaakt": "Portaallink is aangemaakt.",
  "portaallink-ingetrokken": "Portaallink is ingetrokken.",
  "document-geupload": "Document is geüpload.",
  "abonnement-bijgewerkt": "Abonnement is bijgewerkt.",
} as const;

export type FlashKey = keyof typeof FLASH_MESSAGES;

export function withFlash(path: string, key: FlashKey) {
  return `${path}${path.includes("?") ? "&" : "?"}melding=${key}`;
}
