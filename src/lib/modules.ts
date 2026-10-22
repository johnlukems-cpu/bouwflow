/** Beschrijving van modules die nog niet zijn gebouwd (eerlijk als "toekomstig" gelabeld). */
export interface PlannedModule {
  slug: string;
  title: string;
  intro: string;
  features: string[];
  /** Onderdelen die in deze fase al als fundament klaarstaan. */
  foundation?: string[];
}

export const PLANNED_MODULES: PlannedModule[] = [
  {
    slug: "leveranciers",
    title: "Leveranciers",
    intro: "Beheer van groothandels, leveranciers en onderaannemers.",
    features: ["Leveranciersgegevens en contactpersonen", "Prijsafspraken en levertijden", "Koppeling met inkoop en materiaalbibliotheek", "Archiveren in plaats van verwijderen"],
  },
  {
    slug: "materiaalberekening",
    title: "Materiaalberekening",
    intro: "Voorcalculatie per project met materiaal-, arbeids-, machine-, transport-, onderaannemer- en overige regels.",
    features: [
      "Regels met artikelnummer, omschrijving, categorie, eenheid en hoeveelheid",
      "Kost- en verkoopprijs per eenheid, snij-/materiaalverlies",
      "Automatische totalen per kostensoort en voor het hele project",
      "Categorieën: kabels, leidingen, elektrische componenten, sanitair, bouwmaterialen, beton, hout, verf, tegels, machines, overig",
    ],
    foundation: ["Rekenkern met exacte decimale berekeningen (incl. snijverlies, totalen en marge) is gebouwd en getest."],
  },
  {
    slug: "materialen",
    title: "Materialen en voorraad",
    intro: "Materiaalbibliotheek per organisatie, met prijzen en voorraadniveaus.",
    features: ["Artikelen met eenheid, categorie, kost- en verkoopprijs", "Voorraadmutaties en minimale voorraad", "Hergebruik in calculaties en werkbonnen"],
  },
  {
    slug: "planning",
    title: "Planning",
    intro: "Overzicht van projecten, medewerkers en materieel in de tijd.",
    features: ["Week- en maandplanning", "Inzet van medewerkers per project", "Conflicten en beschikbaarheid"],
  },
  {
    slug: "medewerkers",
    title: "Medewerkers",
    intro: "Personeel, functies, uurtarieven en gebruikersrollen.",
    features: ["Medewerkers met interne kostprijs per uur", "Koppeling aan gebruikersaccounts en rollen", "Uitnodigen van collega's"],
    foundation: ["Rollen (eigenaar, beheerder, projectleider, financieel, medewerker, alleen-lezen) zijn in de database vastgelegd en beveiligd."],
  },
  {
    slug: "werkbonnen",
    title: "Werkbonnen",
    intro: "Digitale werkbonnen, geschikt voor gebruik op de telefoon op de bouwplaats.",
    features: ["Werkbonnummer, project, medewerker en datum", "Begin- en eindtijd, pauze en automatisch berekende uren", "Uitgevoerde werkzaamheden, gebruikte materialen en opmerkingen", "Foto's en statussen"],
  },
  {
    slug: "inkoop",
    title: "Inkoop",
    intro: "Inkooporders en inkoopfacturen, toegerekend aan projecten.",
    features: ["Inkooporders per leverancier", "Ontvangst en toerekening aan projecten", "Geen dubbele telling van kosten in de na-calculatie"],
  },
  {
    slug: "offertes",
    title: "Offertes",
    intro: "Offertes opstellen vanuit de projectcalculatie.",
    features: ["Eigen offertenummering", "Offerteregels toevoegen en wijzigen met automatische totalen", "Statussen (concept, verzonden, geaccepteerd, afgewezen, verlopen)", "Omzetten naar project of opdracht", "Momentopname van klantgegevens, prijzen en belastingregels", "PDF-generatie en verzending (afzonderlijke functionaliteit)"],
    foundation: ["Rekenkern voor documenttotalen met configureerbare belastingtarieven is gebouwd en getest.", "Nummervoorvoegsel is instelbaar bij Instellingen."],
  },
  {
    slug: "facturatie",
    title: "Facturatie",
    intro: "Facturen vanuit projecten, inclusief termijn- en deelfacturen.",
    features: ["Eigen factuurnummering", "Factuurregels beheren", "Gedeeltelijke facturatie en termijnfacturen", "Vervaldatums en betaalstatussen", "Momentopname van gegevens op definitieve facturen", "PDF-generatie en verzending (afzonderlijke functionaliteit)"],
    foundation: ["Belastingtarieven zijn per organisatie configureerbaar; er worden geen tarieven aangenomen."],
  },
  {
    slug: "betalingen",
    title: "Betalingen",
    intro: "Ontvangen betalingen registreren en openstaande bedragen bewaken.",
    features: ["Betalingen per factuur", "Openstaand bedrag en status (open, deels betaald, betaald, vervallen)", "Overzicht van debiteuren"],
    foundation: ["Rekenregels voor openstaande bedragen en betaalstatus zijn gebouwd en getest."],
  },
  {
    slug: "na-calculatie",
    title: "Na-calculatie",
    intro: "Kernfunctie van BouwFlow: begroot versus werkelijk, per project en per kostensoort.",
    features: [
      "Materiaal-, arbeids-, machine-, transport- en overige kosten: begroot vs. werkelijk",
      "Begrote vs. werkelijke arbeidsuren",
      "Begrote vs. gerealiseerde omzet en winst, winstmarge",
      "Waarschuwingen bij budgetoverschrijding",
      "Keuze van omzetbasis: verkoopwaarde, gefactureerd of ontvangen",
    ],
    foundation: [
      "Formules geïmplementeerd en getest: kostenverschil = werkelijk − begroot; begrote winst = begrote omzet − begrote kosten; gerealiseerde winst = gerealiseerde omzet − werkelijke kosten; marge = winst / omzet × 100% (alleen bij omzet > 0).",
      "Omzetbasis en waarschuwingsdrempel zijn instelbaar bij Instellingen.",
    ],
  },
  {
    slug: "rapportages",
    title: "Rapportages",
    intro: "Inzicht in omzet, marges, uren en projectresultaten.",
    features: ["Projectresultaten per periode", "Marge per klant en per projectsoort", "Export naar Excel/CSV"],
  },
  {
    slug: "documenten",
    title: "Documenten",
    intro: "Centrale, beveiligde opslag van tekeningen, vergunningen, foto's en contracten.",
    features: ["Uploaden per project of klant", "Mappen en zoeken", "Toegang alleen binnen de eigen organisatie"],
    foundation: ["Privé-opslagbucket met toegangsregels per organisatie is voorbereid in de database-migraties."],
  },
];
