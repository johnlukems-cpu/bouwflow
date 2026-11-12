# Productie-readinessrapport BouwFlow

**Datum:** 12-11-2026 · **Branch:** `fase-1-basis` · **Versies:** Next.js 16.4.6, React 19.2, Supabase JS 2.118, PostgreSQL 16 (tests)

## Conclusie

**BouwFlow is functioneel compleet en goed getest, maar nog niet productieklaar.** Twee essentiële controles kunnen pas na externe configuratie worden uitgevoerd:

1. de volledige keten met een **echte Supabase-omgeving** (Auth, de API-laag PostgREST, Storage);
2. **fiscale en wettelijke validatie** van facturen en belastingregels door een Surinaamse deskundige.

Zolang die twee punten niet zijn afgerond, raden we geen live gebruik met echte klantgegevens aan.

## Testresultaten

Legenda: ✅ Geslaagd · ❌ Mislukt · ⏸️ Niet uitgevoerd · 🔌 Afhankelijk van externe configuratie

| # | Controle | Resultaat | Toelichting |
| --- | --- | --- | --- |
| 1 | Unit-tests | ✅ 45/45 | Geldrekenen, voorcalculatie, belasting, betalingen, na-calculatie, validatie (alle modules), rechten, datumnotatie DD-MM-JJJJ/tijdzone, rapportages/CSV, veilige bestandsnamen/redirects, PDF-generatie |
| 2 | Integratietests | ✅ / 🔌 | ✅ Databasecontract: alle tabellen, kolommen, embeds en RPC-argumenten die de app gebruikt bestaan in het schema (`npm run test:contract`). 🔌 End-to-end via supabase-js/PostgREST/Auth: niet mogelijk zonder Supabase-project |
| 3 | Database-integratietests | ✅ / 🔌 | ✅ 140 controles op PostgreSQL **16**. 🔌 Supabase gebruikt mogelijk een andere hoofdversie (15/17); herhaal `npm run test:db` tegen een Supabase-branch of een lokale Supabase-stack |
| 4 | Row Level Security | ✅ | Voor alle modules: lezen/schrijven per rol, anonieme toegang, vervalsen van kostenregels, statussen en totalen geweigerd |
| 5 | Organisatiescheiding | ✅ | Organisatie B ziet niets van A (16 tabellen/views), kan niets bij A boeken, goedkeuren, factureren of ontvangen; platformbeheerder ziet geen bedrijfsgegevens |
| 6 | Browserautomatisering | ✅ | 39 pagina's × desktop + mobiel (78 controles) in de productiebuild (demo-modus): geen JS-fouten. 🔌 Ingelogde schrijfflows in de browser vereisen Supabase |
| 7 | Financiële rekentests | ✅ | TypeScript (unit) én SQL (workflows): calculatie met verlies, offertetotalen, voorschot 30%, eindfactuur minus termijnen, half-up afronding, creditnota, deelbetaling, overbetaling, na-calculatie per kostensoort |
| 8 | Mobiele weergave | ✅ | 375 px: geen horizontale overflow, aanraakvlakken ≥ 32 px (formulieren 44 px), mobiel menu, werkbon- en urenformulieren |
| 9 | TypeScript | ✅ | `tsc --noEmit` zonder fouten |
| 10 | Lint | ✅ | ESLint zonder fouten of waarschuwingen |
| 11 | Productiebuild | ✅ | `next build` geslaagd |
| 12 | Supabase-opslagtests | ✅ / 🔌 | ✅ Storage-policies getest (eigen map, andere organisatie, ongeldig pad, medewerkersfoto's). 🔌 Echte bucket niet getest |
| 13 | Upload- en downloadtests | 🔌 | Code aanwezig (type/grootte-controle, veilige namen, opruimen bij fout, signed URL 60 s); vereist Supabase Storage |
| 14 | Back-up- en hersteltests | ✅ | `pg_dump` → `pg_restore` → identieke aantallen, financiële totalen en werkende nummering na herstel. 🔌 Storage-back-up en Supabase PITR zelf instellen |
| 15 | Beveiligingscontroles | ✅ / ⏸️ | ✅ `npm audit` productie: 0 kwetsbaarheden (na update Next 16.4.6/zod 4.6.7); geen geheimen in de repository; `.env*` genegeerd; security-headers actief; open-redirect- en CSV-injectiebescherming getest. ⏸️ DAST-scan (HawkScan) niet uitgevoerd: geen API-sleutel; ⏸️ geen externe pentest |
| 16 | Toegankelijkheid | ✅ | axe-core WCAG 2.1 A/AA op alle 39 pagina's: 0 meldingen (contrast gecorrigeerd, o.a. oranje knoppen met donkerblauwe tekst) |
| — | PDF-generatie | ✅ | Echte PDF's (react-pdf) voor offerte, factuur/creditnota, werkbon, inkooporder, na-calculatie; meerdere pagina's met paginanummering; momentopname voor definitieve documenten |

### Volledige gebruikersworkflow (klant → projectafsluiting → na-calculatie)

✅ **Getest op databaseniveau** (`supabase/tests/20_workflows.sql`), met exacte bedragen:
klant → project → calculatie → offerte → definitief (momentopname, vergrendeld) → acceptatie (project bijgewerkt) → voorschotfactuur 30% → betaling (deel + volledig, dubbel geweigerd) → eindfactuur minus voorschot → creditnota → inkooporder → deelontvangst (idempotent) → voorraad → uren (overlap geweigerd) → werkbon met materialen → goedkeuring (één keer geboekt) → na-calculatie (begroot 4.875,00 vs. werkelijk 1.550,00; gefactureerd en ontvangen apart).

🔌 **Dezelfde workflow via de browser met inloggen:** pas mogelijk na het koppelen van Supabase. Zie de rooktest hieronder.

## Wat in deze omgeving niet kon

- **Lokale Supabase-stack** (Docker-images, PostgREST- en Auth-binaries): het downloaden werd door de netwerk- en veiligheidsregels van de bouwomgeving geblokkeerd. Daarom is de database rechtstreeks getest, met een minimale nabootsing van het Supabase-authenticatieschema.

## Na de eerste deployment (rooktest, circa 30 minuten)

1. Registreren met e-mailbevestiging, daarna een organisatie aanmaken.
2. Instellingen invullen, inclusief een belastingtarief.
3. Workflow doorlopen:
   1. klant en project aanmaken;
   2. calculatieregel toevoegen, offerte maken, definitief maken en de PDF openen;
   3. portaallink maken en de offerte accepteren in een privévenster;
   4. voorschotfactuur maken, definitief maken en een betaling registreren;
   5. dubbel klikken op "Betaling registreren": er mag maar één betaling ontstaan.
4. Medewerker uitnodigen, koppelen en laten inloggen op een telefoon. De medewerker maakt een werkbon met foto; u keurt die goed en controleert de na-calculatie.
5. Tweede account met eigen organisatie: controleer dat niets van de eerste organisatie zichtbaar is, ook niet via URL's met ID's.
6. Document uploaden en downloaden.
7. `npm run test:db` draaien tegen een Supabase-branch.

## Bekende beperkingen

- Geen payrollmodule (zie EXTERNE-CONFIGURATIE.md).
- Geen e-mailverzending van offertes/facturen; geen betaalprovider voor abonnementen.
- Het BouwFlow-logo staat op PDF's; een eigen logo per klantorganisatie is nog niet mogelijk.
- Datum- en tijdvelden in formulieren gebruiken de notatie van de browser. De weergave elders is altijd DD-MM-JJJJ.
- Rapportages: omzet per maand en projectresultaten; geen geavanceerde grafieken of filters per periode buiten het jaar.
