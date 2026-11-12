# BouwFlow — architectuur en ontwerpkeuzes

## 1. Overzicht

- **Frontend/server:** Next.js 16 App Router. Alle data-toegang en schrijfacties lopen via servercomponenten en server actions (`src/app/**/actions.ts`, `src/lib/save.ts`).
- **Database:** Supabase PostgreSQL. Bedrijfsregels en financiële berekeningen die niet mogen misgaan, staan **in de database** (triggers, functies, constraints). De applicatie toont en valideert; de database bewaakt.
- **Migraties:** `supabase/migrations/` (8 bestanden, allemaal niet-destructief).

| Migratie | Inhoud |
| --- | --- |
| 0100 | Organisaties, leden, rollen, instellingen, belastingtarieven, nummering, activiteitenlog |
| 0200 | Klanten, projecten |
| 0300 | Privé-opslag `documents` + policies |
| 0400 | Abonnementen, moduletoegang, platformbeheer, uitnodigingen, ledenbeheer, audit trail |
| 0500 | Leveranciers, medewerkers, materiaalbibliotheek + prijshistorie, voorraad, **kostenregister** |
| 0600 | Voorcalculatie, taken, uren, werkbonnen, inkoop + ontvangsten |
| 0700 | Offertes, facturen (incl. termijn/credit), betalingen, saldi, projectfinanciën, klantportaal |
| 0800 | Documentmetadata |

## 2. Multi-tenancy en beveiliging

- Iedere tabel heeft `organization_id` en **Row Level Security**.
- **Samengestelde foreign keys** `(id, organization_id)`: een record kan alleen naar records binnen dezelfde organisatie verwijzen, ook als iemand een ID manipuleert.
- `prevent_organization_change` voorkomt het verplaatsen van records naar een andere organisatie.
- Schrijfrechten (`has_org_role`) vereisen een actieve rol **én** een geldig abonnement of een lopende proefperiode. Lezen blijft altijd mogelijk.
- **Organisatie-ID's** komen altijd uit de server-context, nooit uit formulieren. De actieve organisatie-cookie wordt gecontroleerd tegen de eigen lidmaatschappen.
- **Lidmaatschappen** kunnen alleen via functies worden gewijzigd:
  - `create_organization`, `create_invitation` en `accept_invitation` (het e-mailadres moet overeenkomen);
  - `update_member`, die de laatste eigenaar beschermt.
- **Platformbeheerders** beheren abonnementen via aparte functies en zien **geen** bedrijfsgegevens van klanten.
- **Klantportaal:**
  - werkt met een geheime token van 256 bits; in de database staat alleen de SHA-256-hash;
  - links zijn intrekbaar en 90 dagen geldig;
  - toegang loopt uitsluitend via `portal_overview` en `portal_respond_quote`;
  - de klant ziet alleen niet-concept offertes en definitieve facturen.
- **Opslag:**
  - privé-bucket met paden `<organization_id>/…`;
  - downloads via signed URLs die 60 seconden geldig zijn;
  - de server controleert bestandstype en grootte (25 MB) en maakt bestandsnamen veilig.
- **Foutmeldingen** uit workflows gaan via een kortlevende, door de server gezette cookie, niet via de URL. Daardoor kan niemand een link met misleidende tekst maken.
- **Geen service-role key:** de applicatie gebruikt alleen de publishable key; RLS bepaalt de rest.

### Rollen

| Recht | Eigenaar | Beheerder | Projectleider | Financieel | Medewerker | Alleen lezen |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Klanten, leveranciers, materialen, inkoop | ✓ | ✓ | ✓ | ✓ | – | – |
| Projecten, calculatie, planning, medewerkers | ✓ | ✓ | ✓ | – | – | – |
| Uren/werkbonnen goedkeuren | ✓ | ✓ | ✓ | – | – | – |
| Eigen uren/werkbonnen registreren | ✓ | ✓ | ✓ | – | ✓ | – |
| Offertes | ✓ | ✓ | ✓ | ✓ | – | – |
| Facturen en betalingen | ✓ | ✓ | – | ✓ | – | – |
| Instellingen, gebruikers | ✓ | ✓ | – | – | – | – |
| Audit trail lezen | ✓ | ✓ | – | ✓ | – | – |

## 3. Workflows

| Workflow | Stappen | Waar afgedwongen |
| --- | --- | --- |
| **A** Klant → project | Klant → project → taken (planning) → calculatie → offerte → acceptatie → project `gepland` + verkoopwaarde | `create_quote_from_estimate`, `respond_quote_internal` |
| **B** Calculatie → factuur | Calculatie → offerte → acceptatie → voorschot-/termijnfactuur (percentage per belastinggroep) → eindfactuur (minus termijnen) → betaling → saldo | `create_invoice_from_quote`, `finalize_invoice`, `payment_guard`, view `invoice_balances` |
| **C** Uitvoering | Taken → medewerker → uren/werkbon → goedkeuring → arbeidskosten (kostprijs als momentopname) + materiaalverbruik (voorraaduitgifte of directe kosten) | `approve_time_entry`, `approve_work_order` |
| **D** Na-calculatie | Begroting (calculatie) vs. kostenregister per kostensoort, uren, omzet volgens gekozen basis, winst, marge, waarschuwingen | view `project_financials` + `src/lib/finance/postcalc.ts` |
| **E** Inkoop en voorraad | Inkooporder → bestellen → (deel)ontvangst → voorraad (`receipt`) of direct projectkosten → uitgifte aan project → materiaalkosten | `receive_purchase_line`, `stock_movement_to_costs` |
| **F** Financieel | Offerte → factuur → betaling → saldo → rapportage. Gefactureerd, ontvangen en verkoopwaarde blijven gescheiden | `invoice_balances`, `project_financials`, `src/lib/reports.ts` |

### Geen dubbele registratie

- **Kostenregister** (`project_cost_entries`): elke werkelijke kost staat er precies één keer in, met een unieke bronverwijzing `(source_type, source_id)`. Het register is onwijzigbaar; correcties gaan via een tegenboeking.
- **Werkbon → uren:** maximaal één urenregel per werkbon (`time_entries.work_order_id` is uniek).
- **Uren:** dezelfde medewerker kan geen overlappende tijden registreren.
- **Goedkeuringsfuncties zijn idempotent:** nogmaals goedkeuren boekt niets dubbel.
- **Voorraad:**
  - mutaties zijn onwijzigbaar en hebben een unieke bron;
  - uitgifte boven de voorraad wordt geweigerd.
- **Ontvangsten en betalingen** hebben een idempotentiesleutel, die bij het tonen van het formulier wordt gemaakt. Een dubbele klik of herhaald verzoek wordt daardoor één keer verwerkt.
- **Overbetaling** en **meer crediteren dan gefactureerd** worden geweigerd.

## 4. Financiële regels

- **Bedragen:**
  - database: `numeric(14,2)`, met prijzen tot 4 decimalen;
  - applicatie: `decimal.js`, nooit JavaScript-floats;
  - afronding: half away from zero, in database en applicatie gelijk.
- **Calculatieregel:** kosten = round(hoeveelheid × (1 + verlies%) × kostprijs, 2). Dit is een *generated column* in de database.
- **Documentregel:** round(aantal × prijs × (100 − korting) / 100, 2). Belasting wordt per tarief gegroepeerd en per groep afgerond; prijzen exclusief én inclusief belasting worden ondersteund. Totalen berekent de database; clients kunnen ze niet zetten.
- **Definitieve documenten:**
  - ze zijn vergrendeld, met een momentopname (`snapshot`) van bedrijf, klant, project en regels; ook het tarief per regel wordt als momentopname bewaard;
  - PDF's van definitieve documenten worden uit die momentopname opgebouwd;
  - wijzigingen gaan via een nieuwe offerteversie (`revise_quote`) of een creditnota.
- **Nummering:** factuurnummers worden pas bij definitief maken toegekend (doorlopend per jaar, zonder gaten door concepten). Creditnota's hebben een eigen reeks (CR-).
- **Na-calculatie:**
  - kostenverschil = werkelijk − begroot;
  - winst = omzet − kosten;
  - marge = winst / omzet × 100%, alleen als de omzet groter is dan 0;
  - de omzetbasis is per organisatie instelbaar (verkoopwaarde, gefactureerd excl. belasting, of ontvangen, naar verhouding omgerekend naar excl. belasting).
- **Historische prijzen:** `material_price_history` bewaart elke prijswijziging. Calculatie- en documentregels bewaren hun eigen prijzen.

## 5. Abonnementen en moduletoegang

- `subscription_plans` bepaalt welke modules (`modules`) en hoeveel gebruikers (`max_users`) een pakket heeft.
- Dashboard, Klanten, Projecten en Instellingen zijn altijd beschikbaar.
- Moduletoegang wordt server-side gecontroleerd (`ModuleGate`, `guardWrite`) en in de database bij het klantportaal.
- De gebruikerslimiet wordt in de database afgedwongen bij het uitnodigen.
- Er is nog geen betaalprovider; statussen beheert de platformbeheerder.

## 6. Demo-modus

Zonder Supabase-configuratie leveren de data-functies fictieve gegevens uit `src/lib/demo/`. Afgeleide bedragen (totalen, kosten, saldi, voorraad) worden met dezelfde rekenfuncties berekend. Schrijfacties tonen een melding en slaan niets op.
