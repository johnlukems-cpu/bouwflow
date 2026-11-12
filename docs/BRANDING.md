# Huisstijl BouwFlow

**Productnaam:** BouwFlow · **Slogan:** Projecten in vertrouwen. · **Taal:** Nederlands · **Markt:** Suriname

## Kleuren (gedefinieerd in `src/app/globals.css`)

| Naam | Hex | Gebruik | Tailwind-token |
| --- | --- | --- | --- |
| Donkerblauw | `#102D50` | Navigatie, koppen, zakelijke onderdelen | `navy-900` |
| Blauw | `#087DC5` | Secundaire acties, informatie | `brand-500` (tekst op wit: `brand-700` `#05669F`) |
| Oranje | `#F28A00` | Primaire acties, accenten, voortgang | `accent-500` (tekst op wit: `accent-700` `#9E5900`) |
| Wit | `#FFFFFF` | Kaarten, documenten | `white` |
| Lichtgrijs | `#F4F6F8` | Achtergrond | `canvas` |
| Donkergrijs | `#333B45` | Lopende tekst | `ink` |

**Toegankelijkheid:**
- Witte tekst op oranje haalt de WCAG AA-norm niet (2,6:1). Primaire knoppen zijn daarom oranje met **donkerblauwe** tekst (circa 5:1).
- Links en blauwe tekst gebruiken `brand-700`.
- Alle pagina's zijn met axe-core gecontroleerd op WCAG 2.1 AA: nul meldingen.

## Logovarianten (`public/brand/`)

Alle varianten zijn afgeleid van het officiële logo `bouwflow-logo.png`, met behoud van verhoudingen en zonder hertekening. Opnieuw genereren kan met `python3 scripts/brand/make-logos.py`.

| Bestand | Gebruik |
| --- | --- |
| `bouwflow-logo.png` | Origineel (niet wijzigen) |
| `bouwflow-logo-light.png` | Volledig logo, transparant, voor lichte achtergronden (login, registratie, onboarding, portaal) |
| `bouwflow-logo-dark.png` | Volledig logo met witte tekst, voor donkere achtergronden |
| `bouwflow-compact-light.png` | Compact logo (beeldmerk + woordmerk) voor lichte achtergronden; PDF-documenten, e-mails, klantportaal |
| `bouwflow-compact-dark.png` | Compact logo voor de donkere desktopnavigatie |
| `bouwflow-mark.png` | Beeldmerk, transparant |
| `icon-192.png`, `icon-512.png` | App-iconen (PWA-manifest), mobiele topbalk |
| `src/app/icon.png`, `favicon.ico`, `apple-icon.png` | Favicon en Apple-touch-icon |
| `src/app/opengraph-image.png` | Voorbeeldafbeelding bij gedeelde links |

De slogan staat op merkpagina's: inloggen, zijbalk, e-mails, PDF-voettekst en klantportaal. Niet op elk scherm.
