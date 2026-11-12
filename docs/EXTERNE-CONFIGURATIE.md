# Resterende externe configuratie

Deze punten kan de software zelf niet regelen. Ze vragen een account, een beslissing of een deskundige validatie.

## Verplicht vóór ingebruikname

| # | Onderwerp | Wat te doen | Wie |
| --- | --- | --- | --- |
| 1 | Supabase-project | Project aanmaken, migraties uitvoeren, URL en publishable key instellen | Technisch beheer |
| 2 | Auth-URL's | Site URL en Redirect URLs (`/auth/callback`, `/auth/confirm`) instellen | Technisch beheer |
| 3 | E-mail (SMTP) | Eigen SMTP-provider koppelen in Supabase (de ingebouwde mailer heeft strenge limieten) en de sjablonen uit `supabase/templates/` plakken | Technisch beheer |
| 4 | Hosting | Vercel-project, domein en environment variables | Technisch beheer |
| 5 | Platformbeheerder | Eigen account toevoegen aan `platform_admins` (SQL in INSTALLATIE.md) | Eigenaar BouwFlow |
| 6 | Abonnementsprijzen | Prijzen invullen in `subscription_plans` (nu leeg = "Prijs op aanvraag") | Eigenaar BouwFlow |
| 7 | **Belastingtarieven** | Per klantorganisatie de geldende tarieven instellen. BouwFlow neemt **geen** Surinaamse tarieven aan | Klant + fiscalist |
| 8 | **Fiscale/wettelijke validatie** | Laat de factuurinhoud, nummering, creditnota-aanpak, afronding per belastinggroep en de bewaarplicht valideren door een Surinaamse fiscalist/accountant | Deskundige |
| 9 | Juridisch | Algemene voorwaarden, verwerkersovereenkomst en privacyverklaring voor uw SaaS-klanten | Jurist |

## Aanbevolen

| Onderwerp | Toelichting |
| --- | --- |
| Betaalprovider voor abonnementen | Nog niet gekoppeld. Kolommen `billing_provider` en `billing_customer_ref` en de platformpagina zijn voorbereid. Abonnementsstatussen beheert u nu handmatig |
| E-mailverzending van offertes/facturen | Nog niet gekoppeld. Gebruikers downloaden de PDF en versturen die zelf, of delen het klantportaal |
| Uitnodigingsmails | Uitnodigingslinks worden in de app getoond en gedeeld; BouwFlow verstuurt ze (nog) niet zelf |
| Foutmonitoring | Bijv. Sentry; nog niet geïntegreerd |
| Rate limiting | Op `/portaal/*`, `/login` en `/registreren` via de host of een WAF |
| Eigen logo per klantorganisatie op PDF's | Nu staat het BouwFlow-logo erop, met de bedrijfsgegevens van de organisatie als afzender |
| Storage-back-up | Bucket `documents` periodiek apart back-uppen |
| Supabase Auth-beveiliging | Leaked password protection en MFA voor beheerders inschakelen |

## Payroll

BouwFlow bevat **geen** payrollmodule: die bestond niet in het bestaande product. Er worden geen loonberekeningen of salarisbetalingen uitgevoerd. Voeg zo'n module pas toe nadat de Surinaamse loonregels (loonbelasting, AOV/AWW, overige premies) aantoonbaar door een deskundige zijn gevalideerd.
