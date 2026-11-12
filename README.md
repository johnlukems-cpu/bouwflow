# BouwFlow

**Projecten in vertrouwen.** BouwFlow is een multi-tenant SaaS-platform voor bouw-, installatie-, elektrotechnische, loodgieters-, HVAC- en onderhoudsbedrijven in Suriname. Het ondersteunt het volledige proces van calculatie tot na-calculatie: klanten, projecten, planning, voorcalculatie, inkoop, voorraad, werkbonnen, uren, offertes, facturen, betalingen en rapportages.

Stack: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, Storage, Row Level Security) · react-pdf · Vitest · Playwright/axe-core.

> **Status:** functioneel compleet en uitgebreid getest tegen PostgreSQL, maar **nog niet gekoppeld aan een echte Supabase-omgeving**. Lees [docs/PRODUCTIE-READINESS.md](docs/PRODUCTIE-READINESS.md) voordat u live gaat.

## Documentatie

| Document | Inhoud |
| --- | --- |
| [docs/INSTALLATIE.md](docs/INSTALLATIE.md) | Lokale installatie en Supabase koppelen |
| [docs/HOSTING-EN-DEPLOYMENT.md](docs/HOSTING-EN-DEPLOYMENT.md) | Hosting (Vercel), domein, back-ups, monitoring |
| [docs/EXTERNE-CONFIGURATIE.md](docs/EXTERNE-CONFIGURATIE.md) | Wat u zelf nog moet instellen of laten valideren |
| [docs/PRODUCTIE-READINESS.md](docs/PRODUCTIE-READINESS.md) | Eindcontrole: geslaagd / mislukt / niet uitgevoerd / extern |
| [docs/ARCHITECTUUR.md](docs/ARCHITECTUUR.md) | Ontwerp, beveiliging, workflows, financiële regels |
| [docs/BRANDING.md](docs/BRANDING.md) | Huisstijl, kleuren en logovarianten |

## Modules

Dashboard · Klanten · Leveranciers · Projecten (met 11 tabbladen) · Planning · Voorcalculatie · Werkbonnen · Urenregistratie · Materiaalbibliotheek · Voorraad · Inkoop · Offertes · Facturatie (voorschot-, termijn-, eind- en creditfacturen) · Betalingen · Na-calculatie · Rapportages (incl. CSV) · Documenten · Medewerkers · Instellingen · Gebruikers en rechten · Abonnement · Audit trail · Platformbeheer · Klantportaal · PDF's voor offertes, facturen, werkbonnen, inkooporders en na-calculaties.

Er is **geen payrollmodule**: die bestond niet in het bestaande product en is bewust niet gebouwd (zie het readiness-rapport).

## Snel starten

```bash
npm install
cp .env.example .env.local   # leeg laten = alleen-lezen demo-modus
npm run dev                  # http://localhost:3000
```

## Scripts

| Script | Doel |
| --- | --- |
| `npm run dev` / `build` / `start` | Ontwikkeling / productiebuild / productieserver |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Unit-tests (financiële berekeningen, validatie, rechten, PDF, rapportages) |
| `npm run test:db` | Migraties + RLS- en workflowtests op een tijdelijke PostgreSQL-database |
| `npm run test:contract` | Controleert of alle tabellen/kolommen/RPC's die de app gebruikt in het schema bestaan |
| `npm run test:backup` | Back-up (pg_dump) en herstel (pg_restore) inclusief vergelijking |
| `npm run test:all` | Alles hierboven + productiebuild |
| `node tests/e2e/browser-check.cjs` | Browsercontrole desktop + mobiel + toegankelijkheid (axe) tegen een draaiende server |
| `scripts/backup.sh` | Back-up van de productiedatabase |
