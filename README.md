# BouwFlow

**Projecten in vertrouwen.** BouwFlow is een multi-tenant SaaS-platform voor bouw- en installatiebedrijven: van materiaalberekening en offerte tot projectuitvoering, facturatie en na-calculatie.

Stack: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, Storage, Row Level Security) · Vitest · Vercel.

---

## Status: fase 1 (technische basis)

| Onderdeel | Status |
| --- | --- |
| App-shell: sidebar, topbar, mobiele navigatie, alle 17 modules in het menu | ✅ Werkend |
| Authenticatie: registreren, inloggen, uitloggen, e-mailbevestiging | ✅ Gebouwd (werkt na koppeling met Supabase) |
| Onboarding: organisatie aanmaken (gebruiker wordt eigenaar) | ✅ Gebouwd (werkt na koppeling met Supabase) |
| Dashboard met KPI's en recente activiteiten | ✅ Werkend (KPI's voor offertes, facturen en werkelijke kosten zijn als "nog niet beschikbaar" gemarkeerd) |
| Klanten: toevoegen, bekijken, wijzigen, archiveren/herstellen, zoeken, filteren, sorteren, projecten per klant | ✅ Werkend |
| Projecten: toevoegen, bekijken, wijzigen, status wijzigen, archiveren, zoeken, filteren, sorteren, detailpagina met 11 tabbladen | ✅ Werkend (tabbladen behalve Overzicht zijn gemarkeerd als toekomstige functionaliteit) |
| Instellingen: bedrijfsgegevens, valuta, taal, belastingtarieven, nummering, omzetbasis | ✅ Werkend |
| Database-migraties met RLS, multi-tenant isolatie, rollen, documentnummering, activiteitenlog, beveiligde opslag | ✅ Gebouwd en getest |
| Financiële rekenkern: voorcalculatie, belasting op documenten, betalingen, na-calculatie | ✅ Gebouwd en getest (nog niet gekoppeld aan schermen) |
| Leveranciers, materiaalberekening, voorraad, planning, medewerkers, werkbonnen, inkoop, offertes, facturatie, betalingen, na-calculatie, rapportages, documenten | 🕒 Toekomstige fase; elke module heeft een informatiepagina die duidelijk als "Toekomstige functionaliteit" is gemarkeerd |

### Demo-modus
Zonder Supabase-configuratie draait BouwFlow tijdens ontwikkeling in **demo-modus**: een **alleen-lezen** omgeving met fictieve voorbeeldgegevens. Elke pagina toont een oranje demo-balk. Er is geen demo-login en er wordt niets opgeslagen. In productie staat de demo-modus standaard uit (zie `BOUWFLOW_DEMO_MODE`).

---

## Lokaal installeren

Vereisten: Node.js 20.9 of hoger (getest met Node 22) en npm.

```bash
npm install
cp .env.example .env.local   # vul daarna de Supabase-gegevens in (of laat leeg voor demo-modus)
npm run dev                  # http://localhost:3000
```

### Beschikbare scripts

| Script | Doel |
| --- | --- |
| `npm run dev` | Ontwikkelserver |
| `npm run build` / `npm start` | Productiebuild / productieserver |
| `npm run lint` | ESLint |
| `npm run typecheck` | Route-types genereren + TypeScript-controle |
| `npm test` | Unit-tests (financiële berekeningen, validatie, rechten, redirects) |
| `npm run test:db` | Migraties + RLS-tests tegen een tijdelijke lokale PostgreSQL-database (vereist `psql`/`createdb` en een draaiende PostgreSQL 15+) |
| `npm run check` | lint + typecheck + unit-tests |

---

## Supabase koppelen (zelf in te vullen)

> Ik heb **geen** credentials verzonnen. Onderstaande stappen moet u zelf uitvoeren.

1. **Project aanmaken** op <https://supabase.com> (kies een regio dicht bij uw gebruikers).
2. **Migraties uitvoeren** — kies één van beide:
   - Supabase CLI: `npx supabase init` (maakt alleen `supabase/config.toml` aan), dan `npx supabase link --project-ref <uw-project-ref>` en `npx supabase db push`
   - Of handmatig: voer in de SQL Editor de bestanden in `supabase/migrations/` **op volgorde** uit.
3. **Omgevingsvariabelen** in `.env.local` (lokaal) en in Vercel (Project → Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL` — Project Settings → API
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — de *publishable* key (of de oudere *anon* key via `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - `NEXT_PUBLIC_SITE_URL` — bijv. `http://localhost:3000` of uw productiedomein
4. **Authentication → URL Configuration**:
   - *Site URL*: uw `NEXT_PUBLIC_SITE_URL`
   - *Redirect URLs*: `http://localhost:3000/auth/callback`, `https://<uw-domein>/auth/callback` en dezelfde met `/auth/confirm`
5. **E-mail** (aanbevolen voor productie): stel bij Authentication → SMTP een eigen SMTP-server in; de ingebouwde Supabase-mailer heeft strenge limieten. Optioneel kunt u de bevestigingsmail laten verwijzen naar
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&volgende=/onboarding`.
6. **Beveiliging**: zet bij Authentication "Leaked password protection" aan en overweeg MFA voor beheerders.

Daarna: registreren → e-mail bevestigen → organisatie aanmaken → u bent eigenaar en kunt klanten en projecten beheren.

**Functies die pas werken na koppeling:** registreren, inloggen, onboarding, en het opslaan van klanten, projecten, instellingen en belastingtarieven. Zonder koppeling toont de app alleen de demo.

### Deployment op Vercel
1. Push de repository naar GitHub en importeer hem in Vercel.
2. Vul de omgevingsvariabelen (stap 3) in voor *Production* en *Preview*.
3. Voeg het Vercel-domein toe aan de Redirect URLs in Supabase.

---

## Projectstructuur

```
src/
  app/
    (auth)/            login, registreren, auth-acties
    (app)/             ingelogde omgeving (sidebar + topbar)
      dashboard/
      klanten/         lijst, nieuw, [id], [id]/bewerken, server actions
      projecten/       lijst, nieuw, [id] (tabbladen), [id]/bewerken, server actions
      instellingen/
      [module]/        informatiepagina's voor toekomstige modules
    auth/callback|confirm   verwerking van e-maillinks
    onboarding/        organisatie aanmaken
  components/ui/       herbruikbare UI-componenten (knoppen, velden, tabellen, badges, ...)
  components/layout/   sidebar, topbar, mobiele navigatie
  lib/
    auth/              server-side context (gebruiker + actieve organisatie) en rechten
    data/              data-toegang (Supabase of demo)
    finance/           exacte financiële berekeningen + tests
    validation/        Zod-schema's met Nederlandse foutmeldingen + tests
    supabase/          Supabase-clients (server, proxy)
  proxy.ts             sessie verversen + niet-ingelogde gebruikers naar /login
supabase/
  migrations/          database-schema, RLS-policies, functies en triggers
  tests/               RLS- en bedrijfsregeltests (plain SQL)
docs/ARCHITECTUUR.md   ontwerpkeuzes, beveiliging en vervolgstappen
```

Zie [`docs/ARCHITECTUUR.md`](docs/ARCHITECTUUR.md) voor de ontwerpkeuzes.
