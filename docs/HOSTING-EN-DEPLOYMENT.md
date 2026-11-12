# Hosting- en deploymenthandleiding

## Aanbevolen opzet

| Onderdeel | Dienst | Opmerking |
| --- | --- | --- |
| Applicatie | Vercel (Node.js-runtime) | Elke andere Node 20+-host met `next start` kan ook |
| Database, Auth, Storage | Supabase (betaald plan voor productie) | Een betaald plan geeft dagelijkse back-ups en Point-in-Time Recovery |
| E-mail | Eigen SMTP (bijv. Postmark, Mailgun, Amazon SES) | Instellen in Supabase → Authentication → SMTP |
| Domein | Bijv. `app.uwbedrijf.sr` | HTTPS via de host |

## Deployment op Vercel

1. Importeer de GitHub-repository `johnlukems-cpu/bouwflow` in Vercel. Kies de branch die u als productie gebruikt; merge `fase-1-basis` eerst naar `main`.
2. **Environment Variables** (Production én Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` = uw productiedomein (wordt gebruikt in e-mail-, uitnodigings- en portaallinks)
   - Zet `BOUWFLOW_DEMO_MODE` **niet**, of op `false`.
3. Region: kies een regio dicht bij uw Supabase-project (bijv. `iad1`).
4. Voeg het productiedomein toe in Vercel. Voeg in Supabase de Site URL en de Redirect URLs (`/auth/callback`, `/auth/confirm`) toe.
5. Deploy. Controleer daarna de rooktest uit `docs/PRODUCTIE-READINESS.md`, sectie "Na de eerste deployment".

De PDF-generatie (`@react-pdf/renderer`) draait server-side in de Node.js-runtime. Het logo wordt via `outputFileTracingIncludes` meegebundeld.

## Database-migraties in productie

- Voer nieuwe migraties eerst uit op een **staging-project** met een kopie van de productiegegevens.
- Alle migraties in deze repository zijn **niet-destructief**: ze voegen alleen tabellen, kolommen, functies en policies toe.
- Maak vóór elke migratie een back-up (zie hieronder).

## Back-up en herstel

- **Database:** Supabase maakt op betaalde plannen dagelijkse back-ups; schakel Point-in-Time Recovery in voor productie. Maak daarnaast periodiek een eigen, versleutelde back-up buiten Supabase:
  ```bash
  DATABASE_URL="postgresql://postgres:<wachtwoord>@db.<ref>.supabase.co:5432/postgres" scripts/backup.sh
  ```
  Herstel: `pg_restore --no-owner --schema=public -d <doel-database> <bestand>.dump` op een project waar de migraties en `auth.users` al aanwezig zijn. Het herstel is getest met `npm run test:backup`: aantallen, financiële totalen en de doorlopende nummering blijven correct.
- **Bestanden (Storage):** die zitten niet in de databasedump. Back-up de bucket `documents` apart (bijv. met de Supabase CLI of de S3-compatibele API van Supabase Storage).
- **Hersteloefening:** voer minimaal elk kwartaal een herstel uit op een testproject.

## Logging en monitoring

- Applicatielogs: Vercel → Logs. Serverfouten krijgen in de interface een foutcode (`digest`) die naar de logregel verwijst; er worden geen technische details aan gebruikers getoond.
- Database en Auth: Supabase → Logs.
- Aanbevolen: een foutmonitoringdienst (bijv. Sentry) en uptime-bewaking op `/login`. Die zijn nog niet geïntegreerd.

## Beveiliging in productie

- Security-headers worden gezet in `next.config.ts`: HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy en Permissions-Policy.
- Zet in Supabase Auth **Leaked password protection** aan, en MFA voor eigenaren/beheerders.
- Beperk toegang tot het Supabase-dashboard tot weinig personen en gebruik daar ook MFA.
- Het klantportaal werkt met geheime, intrekbare links (90 dagen geldig). Overweeg rate limiting op `/portaal/*` via de host of een WAF.
