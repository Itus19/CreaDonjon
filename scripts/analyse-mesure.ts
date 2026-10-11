// V3.1-62 — lit le journal d'un `CREADONJON_MESURE=1 npm run dev` et en tire,
// page par page, le tableau des requetes a la base (docs/CABLAGE.md).
//
// Lancement : npx tsx scripts/analyse-mesure.ts <journal-du-serveur> <marqueurs>
//
// Le pilote de mesure ecrit dans un fichier a lui, avant chaque page, une
// ligne `{"page":"<nom>","t":<Date.now()>}` (jamais dans le journal du
// serveur, que le serveur reecrit a sa propre position). Toute ligne
// `[mesure] {...}` (lib/supabase/measuredFetch.ts) partie apres ce marqueur et
// avant le suivant appartient a cette page : chargement initial ET
// chargements lances apres l'affichage (routes /api appelees par la page).
// Mesurer une page a la fois.

import { readFileSync } from "node:fs";
import { resumerRequetes, type RequeteMesuree } from "../src/core/mesure/vagues";

const [chemin, cheminMarqueurs] = process.argv.slice(2);
if (!chemin || !cheminMarqueurs) throw new Error("Usage : npx tsx scripts/analyse-mesure.ts <journal-du-serveur> <marqueurs>");

interface Ligne extends RequeteMesuree {
  origine: string;
}

const marqueurs = readFileSync(cheminMarqueurs, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l) as { page: string; t: number })
  .sort((a, b) => a.t - b.t);
const pages: { page: string; lignes: Ligne[] }[] = marqueurs.map((m) => ({ page: m.page, lignes: [] }));
for (const brute of readFileSync(chemin, "utf8").split("\n")) {
  const mesure = brute.indexOf("[mesure] ");
  if (mesure < 0) continue;
  const l = JSON.parse(brute.slice(mesure + 9)) as Ligne;
  let i = -1;
  while (i + 1 < marqueurs.length && marqueurs[i + 1].t <= l.debut) i++;
  if (i >= 0) pages[i].lignes.push(l);
}

console.log("| Page | Requêtes (dont middleware) | Auth | Vagues | Durée (ms) | Cumul (ms) | Tables les plus lues |");
console.log("|---|---|---|---|---|---|---|");
for (const { page, lignes } of pages) {
  const r = resumerRequetes(lignes);
  const mw = lignes.filter((l) => l.origine === "middleware").length;
  const parTable = new Map<string, number>();
  for (const l of lignes) parTable.set(l.chemin, (parTable.get(l.chemin) ?? 0) + 1);
  const tables = [...parTable.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([t, n]) => `${t.replace("/rest/v1/", "")} ×${n}`)
    .join(", ");
  console.log(`| ${page} | ${r.requetes} (${mw}) | ${r.auth} | ${r.vagues} | ${r.dureeMs} | ${r.cumulMs} | ${tables} |`);
}
