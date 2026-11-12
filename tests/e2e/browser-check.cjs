/**
 * Browsercontrole (Playwright): laadt alle pagina's op desktop én mobiel, controleert
 * JavaScript-fouten, horizontale overflow, aanraakvlakken en toegankelijkheid (axe-core).
 * Gebruik: BASE_URL=http://localhost:3000 node tests/e2e/browser-check.cjs
 */
const path = require("path");
const fs = require("fs");
let playwright;
try { playwright = require("playwright"); } catch { playwright = require("/opt/node22/lib/node_modules/playwright"); }
const axeSource = fs.readFileSync(path.join(__dirname, "../../node_modules/axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE_URL || "http://localhost:3101";
const P = "00000000-0000-4000-8000-0000000d0001";
const PAGES = ["/login", "/registreren", "/wachtwoord-vergeten", "/dashboard", "/klanten", "/klanten/00000000-0000-4000-8000-0000000c0001", "/klanten/nieuw", "/leveranciers", "/leveranciers/nieuw", "/medewerkers", "/materialen", "/materialen/00000000-0000-4000-8000-c10000000001", "/voorraad", "/materiaalberekening", "/planning", "/werkbonnen", "/werkbonnen/00000000-0000-4000-8000-c50000000002", "/werkbonnen/nieuw", "/uren", "/uren/nieuw", "/inkoop", "/inkoop/00000000-0000-4000-8000-c70000000001", "/offertes", "/offertes/00000000-0000-4000-8000-c90000000002", "/facturatie", "/facturatie/00000000-0000-4000-8000-cb0000000002", "/betalingen", "/na-calculatie", "/rapportages", "/documenten", "/instellingen", "/instellingen/gebruikers", "/instellingen/abonnement", "/projecten", "/projecten/nieuw", `/projecten/${P}`, `/projecten/${P}?tab=calculatie`, `/projecten/${P}?tab=na-calculatie`, `/projecten/${P}?tab=planning`];

(async () => {
  const browser = await playwright.chromium.launch();
  let failures = 0;
  const summary = { pages: 0, a11y: {} };
  for (const vp of [{ name: "desktop", width: 1366, height: 900 }, { name: "mobiel", width: 375, height: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: "nl-NL" });
    const page = await ctx.newPage();
    for (const url of PAGES) {
      const errs = [];
      page.removeAllListeners("pageerror");
      page.on("pageerror", (e) => errs.push(e.message));
      await page.goto(BASE + url, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const problems = [];
      if (errs.length) problems.push(`JS-fout: ${errs[0]}`);
      if (overflow > 1) problems.push(`horizontale overflow ${overflow}px`);
      if (vp.name === "mobiel") {
        const small = await page.evaluate(() =>
          [...document.querySelectorAll("main button, main a[class*='rounded'], main select, main input:not([type=hidden]):not([type=checkbox]):not([type=radio])")]
            .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 32; })
            .map((el) => (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 30)),
        );
        if (small.length) problems.push(`kleine aanraakvlakken (<32px): ${small.slice(0, 3).join(", ")}`);
      }
      if (vp.name === "desktop") {
        await page.addScriptTag({ content: axeSource });
        const res = await page.evaluate(async () => {
          const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
          return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, target: v.nodes[0]?.target?.[0] }));
        });
        for (const v of res) {
          summary.a11y[v.id] = (summary.a11y[v.id] || 0) + v.n;
          if (v.impact === "critical" || v.impact === "serious") problems.push(`a11y ${v.impact}: ${v.id} (${v.n}×, bijv. ${v.target})`);
        }
      }
      summary.pages++;
      if (problems.length) failures++;
      console.log(`${problems.length ? "✗" : "✓"} [${vp.name}] ${url}${problems.length ? " — " + problems.join(" | ") : ""}`);
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${summary.pages} paginacontroles, ${failures} met bevindingen. Alle axe-meldingen (incl. minder ernstig):`, JSON.stringify(summary.a11y));
  process.exit(failures ? 1 : 0);
})();
