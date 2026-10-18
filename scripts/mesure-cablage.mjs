// V3.1-62 — pilote de mesure du cablage (docs/CABLAGE.md §2). Ouvre les
// ecrans du Banc d'essai avec Chromium, en Testeur MJ et Testeuse A : chaque
// ecran une fois pour que le mode developpement le compile (« chauffe »),
// puis trois fois mesure. Ecrit un marqueur horodate avant chaque ecran
// (fichier a part, lu par scripts/analyse-mesure.ts) et les releves du
// navigateur (TTFB, chargements apres affichage) en JSON.
//
// Prealables : `CREADONJON_MESURE=1 npm run dev > <journal> 2>&1` lance a
// part ; MANUAL_TEST_PASSWORD defini ; Playwright installe globalement
// (environnement cloud : `npm root -g`/playwright, Chromium dans /opt/pw-browsers).
// Lancement : node scripts/mesure-cablage.mjs <marqueurs.jsonl> <navigateur.json>
// Aucune dependance ajoutee au projet : outil de developpement seulement.
import { createRequire } from "node:module";
import { appendFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? `${execSync("npm root -g").toString().trim()}/playwright`);
const [marqueurs, sortie] = process.argv.slice(2);
const BASE = "http://localhost:3000";
const W = "banc-d-essai";
const comptes = {
  mj: "tag-banc-essai-mj@creadonjon.tag",
  a: "tag-banc-essai-a@creadonjon.tag",
};
const pages = [
  { nom: "MJ accueil du monde", compte: "mj", url: `/m/${W}` },
  { nom: "MJ fiche wiki (faction)", compte: "mj", url: `/m/${W}/f/1` },
  { nom: "MJ fiche de personnage (PJ A)", compte: "mj", url: `/m/${W}/f/2` },
  { nom: "MJ page Initiative", compte: "mj", url: `/m/${W}/mj/initiative` },
  { nom: "MJ fenetre Initiative (API)", compte: "mj", api: `/api/worlds/${W}/mj/initiative/window`, depuis: `/m/${W}` },
  { nom: "MJ fenetre fiche PJ A (API)", compte: "mj", api: `/api/worlds/${W}/entities/2/window`, depuis: `/m/${W}` },
  { nom: "Joueuse accueil", compte: "a", url: `/m/${W}/joueur/accueil` },
  { nom: "Joueuse fiche (page joueur)", compte: "a", url: `/m/${W}/joueur` },
  { nom: "Joueuse fiche wiki (PJ A)", compte: "a", url: `/m/${W}/joueur/wiki/2` },
  // Etape 3 (18 octobre) : les ecrans de la coquille refaite (V3.1-20 a 36).
  { nom: "MJ accueil general", compte: "mj", url: `/` },
  { nom: "MJ page Table", compte: "mj", url: `/m/${W}/mj/table` },
  { nom: "MJ fenetre Table (API)", compte: "mj", api: `/api/worlds/${W}/mj/table/window`, depuis: `/m/${W}` },
  { nom: "Joueuse accueil general", compte: "a", url: `/` },
  { nom: "Joueuse prochaine session", compte: "a", url: `/m/${W}/joueur/prochaine-session` },
];
const marque = (page) => appendFileSync(marqueurs, JSON.stringify({ page, t: Date.now() }) + "\n");
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const contextes = {};
for (const [cle, email] of Object.entries(comptes)) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  // Premier passage : le mode developpement compile la page, bien au-dela de 30 s.
  await p.goto(`${BASE}/login`, { timeout: 180000 });
  // Ecran-titre (V3.1-85) : le formulaire s'ouvre par « Se connecter ».
  await p.getByRole("button", { name: "Se connecter" }).first().click();
  await p.fill('input[name="identifier"]', email);
  await p.fill('input[name="password"]', process.env.MANUAL_TEST_PASSWORD);
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 }), p.click('button[type="submit"]')]);
  await p.close();
  contextes[cle] = ctx;
}

const resultats = [];
for (const def of pages) {
  const ctx = contextes[def.compte];
  for (let essai = 0; essai <= 3; essai++) {
    const nom = essai === 0 ? `(chauffe) ${def.nom}` : `${def.nom} #${essai}`;
    const page = await ctx.newPage();
    if (def.api) {
      marque(`(page de depart) ${nom}`);
      await page.goto(BASE + def.depuis, { waitUntil: "networkidle" });
      await attendre(500);
      marque(nom);
      const t0 = Date.now();
      const statut = await page.evaluate(async (u) => (await fetch(u)).status, def.api);
      resultats.push({ page: def.nom, essai, api: true, statut, totalMs: Date.now() - t0 });
    } else {
      const apres = [];
      let charge = false;
      page.on("domcontentloaded", () => (charge = true));
      page.on("requestfinished", async (req) => {
        const u = new URL(req.url());
        if (!charge || u.origin !== BASE) return;
        if (req.resourceType() !== "fetch" && req.resourceType() !== "xhr") return;
        const t = req.timing();
        apres.push({ chemin: u.pathname, debut: t.startTime, ms: t.responseEnd });
      });
      marque(nom);
      const t0 = Date.now();
      const rep = await page.goto(BASE + def.url, { waitUntil: "domcontentloaded", timeout: 120000 });
      // Un ecran qui n'atteint jamais le repos reseau (sondage periodique) est signale, jamais tu.
      const reposNonAtteint = await page.waitForLoadState("networkidle", { timeout: 60000 }).then(() => false, () => true);
      await attendre(800);
      const stable = Date.now() - t0;
      const nav = await page.evaluate(() => {
        const n = performance.getEntriesByType("navigation")[0];
        return { ttfb: Math.round(n.responseStart - n.requestStart), dcl: Math.round(n.domContentLoadedEventEnd) };
      });
      resultats.push({ page: def.nom, essai, statut: rep?.status(), url: page.url(), ttfbMs: nav.ttfb, dclMs: nav.dcl, stableMs: stable - 800, reposNonAtteint, chargementsApresAffichage: apres.map((a) => a.chemin) });
    }
    await page.close();
  }
}
writeFileSync(sortie, JSON.stringify(resultats, null, 1));
await browser.close();
