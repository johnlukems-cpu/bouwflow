# BouwFlow — architectuur en ontwerpkeuzes

## 1. Multi-tenancy en beveiliging

**Model:** één database, gedeeld schema. Iedere tenant-tabel heeft een `organization_id`. Isolatie wordt in de **database** afgedwongen met Row Level Security (RLS); de applicatie controleert daarnaast rechten aan de serverzijde.

| Laag | Maatregel |
| --- | --- |
| Database | RLS op alle tabellen; helperfuncties `is_org_member()` en `has_org_role()` (SECURITY DEFINER, leeg `search_path`) |
| Database | Tabelrechten van `anon` en `authenticated` ingetrokken en per tabel opnieuw toegekend; `anon` heeft geen toegang |
| Database | Samengestelde foreign keys `(id, organization_id)`: een project kan alleen naar een klant/projectleider in **dezelfde** organisatie verwijzen, ook als iemand ID's manipuleert |
| Database | Trigger `prevent_organization_change`: een record kan niet naar een andere organisatie worden verplaatst |
| Database | Lidmaatschappen kunnen niet door clients worden aangemaakt of gewijzigd; organisaties worden alleen via de functie `create_organization()` aangemaakt (maker wordt eigenaar) |
| Database | Nummers (klant, project, later offerte/factuur) worden server-side toegekend via `next_sequence_value()` met rij-lock; clients kunnen nummers niet kiezen of wijzigen |
| Database | Geen DELETE-rechten op klanten en projecten: archiveren in plaats van verwijderen |
| Database | Activiteitenlog wordt alleen via triggers gevuld; clients kunnen alleen lezen |
| Opslag | Privé-bucket `documents`; pad `<organization_id>/...`; policies per organisatie en rol; ongeldige paden worden geweigerd |
| Server | `getAppContext()` valideert sessie (`auth.getUser()`) en de actieve organisatie tegen de eigen lidmaatschappen; een gemanipuleerde cookie geeft geen toegang |
| Server | Server actions controleren rechten (`guardWrite`) en zetten `organization_id` zelf — nooit uit formulierdata |
| Server | Alle invoer wordt met Zod gevalideerd; zoektermen worden opgeschoond voordat ze in PostgREST-filters komen; sorteerkolommen via een whitelist |
| Server | Redirects na login alleen naar interne paden (`safeRedirectPath`); meldingen in de URL alleen uit een vaste lijst |
| HTTP | Security headers (X-Frame-Options, nosniff, HSTS, Referrer-Policy, Permissions-Policy) |
| Geheimen | Alleen de publieke Supabase-URL en publishable/anon key in de browser. Er wordt geen service-role key gebruikt |

### Rollen

| Rol | Klanten schrijven | Projecten schrijven | Instellingen | Belastingtarieven |
| --- | :-: | :-: | :-: | :-: |
| owner (eigenaar) | ✓ | ✓ | ✓ | ✓ |
| admin (beheerder) | ✓ | ✓ | ✓ | ✓ |
| manager (projectleider) | ✓ | ✓ | – | – |
| finance (financieel) | ✓ | – | – | ✓ |
| employee (medewerker) | – | – | – | – |
| viewer (alleen lezen) | – | – | – | – |

Alle leden kunnen de gegevens van hun eigen organisatie lezen. De rollen staan in de enum `org_role` (uit te breiden met `ALTER TYPE ... ADD VALUE`) en in `src/lib/auth/permissions.ts`; een unit-test bewaakt dat beide overeenkomen.

## 2. Geld en berekeningen

- Bedragen in de database: `numeric(14,2)`; tarieven `numeric(6,3)`; valuta expliciet als ISO-code (`char(3)`) per project en per organisatie (standaard **SRD**).
- In TypeScript: `decimal.js` (geen floats). Afronding expliciet op centen, *half up*. Regeltotalen worden eerst afgerond en daarna opgeteld, zodat totalen op een document controleerbaar zijn.
- Belasting: per tarief gegroepeerd en per groep afgerond; zowel prijzen exclusief als inclusief belasting worden ondersteund. **Er worden geen tarieven aangenomen**: de organisatie stelt ze in bij Instellingen.
- Na-calculatie (`src/lib/finance/postcalc.ts`):
  - kostenverschil = werkelijke kosten − begrote kosten
  - begrote winst = begrote omzet − begrote kosten
  - gerealiseerde winst = gerealiseerde omzet − werkelijke kosten
  - winstmarge = winst / omzet × 100% (alleen als omzet > 0)
  - De **omzetbasis** (verkoopwaarde, gefactureerd of ontvangen) is per organisatie instelbaar; gefactureerde omzet, ontvangen betalingen en verkoopwaarde blijven altijd apart beschikbaar.
- AI bepaalt nooit financiële totalen; alle bedragen komen uit deterministische, geteste functies.

## 3. Demo-modus

Zonder Supabase-configuratie leveren de data-functies (`src/lib/data/*`) vaste, fictieve voorbeeldgegevens (`src/lib/demo/data.ts`). Schrijfacties retourneren een melding en slaan niets op. Er is geen demo-authenticatie. In productie is de demo-modus standaard uit.

## 4. Testen

- `npm test` — 29 unit-tests: geldrekenen, voorcalculatie, belasting, betalingen, na-calculatie, validatie, rechten, veilige redirects.
- `npm run test:db` — voert alle migraties uit op een tijdelijke PostgreSQL-database met een minimale nabootsing van Supabase (`supabase/tests/00_supabase_stub.sql`) en controleert 40+ beveiligings- en bedrijfsregels (isolatie tussen organisaties, rollen, nummering, archiveren, opslag, anonieme toegang).

**Nog niet getest:** de volledige keten met een echte Supabase-instantie (Auth + PostgREST). Doe na het koppelen een rooktest: registreren, organisatie aanmaken, klant en project aanmaken, en met een tweede account controleren dat de gegevens niet zichtbaar zijn.

## 5. Vervolgstappen (voorstel)

1. **Medewerkers & uitnodigingen** — RPC's voor uitnodigen, rol wijzigen en deactiveren (met bescherming van de laatste eigenaar).
2. **Materiaalbibliotheek + voorcalculatie** — tabellen `materials`, `project_estimate_lines` (kostensoort, categorie, eenheid, hoeveelheid, kost-/verkoopprijs, verlies%) gekoppeld aan de bestaande rekenkern.
3. **Kostenregistratie (werkelijk)** — één centrale tabel `project_cost_entries` met `source_type` + `source_id` en een unieke index daarop. Werkbonnen, inkoop en handmatige boekingen schrijven hierheen, zodat dezelfde kosten **nooit dubbel** worden geteld.
4. **Werkbonnen** (mobiel), daarna **inkoop**.
5. **Offertes en facturen** — eigen nummerreeksen per jaar, statussen, en bij definitief maken een **momentopname** (klantgegevens, omschrijvingen, prijzen, belastingtarieven als JSON + vaste kolommen) die daarna onwijzigbaar is (trigger). PDF-generatie en e-mailverzending als afzonderlijke functies.
6. **Betalingen** en **na-calculatie**-scherm met budgetwaarschuwingen.
7. **Abonnementen** (bijv. Stripe of een lokale betaalprovider) per organisatie.
8. Gegenereerde database-types (`npx supabase gen types typescript`) in plaats van handgeschreven types.
