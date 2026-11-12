# Installatiehandleiding

## 1. Vereisten

- Node.js 20.9 of hoger (getest met Node 22) en npm
- Voor databasetests: PostgreSQL 15+ met `psql`, `createdb`, `pg_dump`, `pg_restore` (getest met 16)
- Een Supabase-project (voor echte gegevens en inloggen)

## 2. Lokaal starten

```bash
npm install
cp .env.example .env.local
npm run dev
```

Zonder Supabase-gegevens draait BouwFlow in **demo-modus**: fictieve voorbeeldgegevens, alleen-lezen, met een oranje demobalk. Er wordt niets opgeslagen en er is geen demo-login.

## 3. Supabase koppelen

1. Maak een project op <https://supabase.com>. Kies een regio dicht bij Suriname, bijvoorbeeld `East US`. Noteer het databasewachtwoord en bewaar het veilig, niet in de code.
2. **Migraties uitvoeren** (in deze volgorde; alle migraties zijn niet-destructief):
   - Met de CLI: `npx supabase init` (maakt alleen `supabase/config.toml`), dan `npx supabase link --project-ref <ref>` en `npx supabase db push`.
   - Of in de SQL Editor: voer de bestanden in `supabase/migrations/` één voor één uit, op bestandsnaam gesorteerd.
3. **Omgevingsvariabelen** in `.env.local`:

   | Variabele | Waar te vinden |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API (publishable/anon key) |
   | `NEXT_PUBLIC_SITE_URL` | Lokaal `http://localhost:3000` |

   Gebruik **nooit** de `service_role`-key; BouwFlow heeft die niet nodig.
4. **Authentication → URL Configuration:** Site URL = uw `NEXT_PUBLIC_SITE_URL`. Voeg als Redirect URLs `…/auth/callback` en `…/auth/confirm` toe, lokaal en voor productie.
5. **Authentication → Email Templates:** plak de sjablonen uit `supabase/templates/` (Confirm signup, Reset password, Magic link, Change email, Invite). Ze bevatten het BouwFlow-logo en verwijzen naar `/auth/confirm`.
6. **Storage:** migratie 3 maakt de privé-bucket `documents` aan. Controleer onder Storage dat die bucket bestaat en **niet** publiek is.
7. **Platformbeheerder** (uzelf, voor abonnementsbeheer). Voer na uw eerste registratie dit uit in de SQL Editor:
   ```sql
   insert into public.platform_admins (user_id)
   select id from auth.users where email = 'uw@emailadres.sr';
   ```
8. **Abonnementsprijzen:** de pakketten (Starter, Professional, Enterprise) staan zonder prijs in `subscription_plans`. Vul de prijzen zelf in via de SQL Editor.

## 4. Eerste gebruik

1. Registreer via `/registreren` en bevestig uw e-mailadres.
2. Maak uw organisatie aan. U wordt eigenaar en krijgt 30 dagen proefperiode (Professional).
3. Ga naar **Instellingen** en vul in:
   - bedrijfsgegevens;
   - valuta (standaard SRD);
   - de geldende **belastingtarieven**. BouwFlow neemt geen tarieven aan; laat ze valideren door een deskundige.
4. Nodig collega's uit via **Instellingen → Gebruikers**. Koppel medewerkers aan hun account bij **Medewerkers**, zodat ze eigen uren en werkbonnen kunnen registreren.

## 5. Tests lokaal draaien

```bash
npm run test:all                       # lint, typecheck, unit, database, contract, back-up, build
npm run build && npm start &           # of: BOUWFLOW_DEMO_MODE=true npm start
BASE_URL=http://localhost:3000 node tests/e2e/browser-check.cjs
```

De database-scripts gebruiken standaard de lokale PostgreSQL-gebruiker `postgres`. Met `PGHOST`, `PGUSER`, `PGPASSWORD` en `PGPORT` stuurt u ze naar een andere server.
