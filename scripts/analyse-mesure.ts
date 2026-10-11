// V3.1-62 — lit le journal d'un `CREADONJON_MESURE=1 npm run dev` et en tire,
// page par page, le tableau des requetes a la base (docs/CABLAGE.md).
//
// Lancement : npx tsx scripts/analyse-mesure.ts <journal-du-serveur>
//
// Le pilote de mesure ecrit dans le MEME journal, avant chaque page, une ligne
// `[mesure-page] {"page":"<nom>"}` ; toutes les lignes `[mesure] {...}`
// (lib/supabase/measuredFetch.ts) qui suivent, jusqu'au marqueur suivant,
// appartiennent a cette page : chargement initial ET chargements lances apres
// l'affichage (routes /api appelees par la page). Mesurer une page a la fois.

import { readFileSync } from "node:fs";
import { resumerRequetes, type RequeteMesuree } from "../src/core/mesure/vagues";

const chemin = process.argv[2];
if (!chemin) throw new Error("Usage : npx tsx scripts/analyse-mesure.ts <journal-du-serveur>");

interface Ligne extends RequeteMesuree {
  origine: string;
}

const pages: { page: string; lignes: Ligne[] }[] = [];
for (const brute of readFileSync(chemin, "utf8").split("\n")) {
  const marqueur = brute.indexOf("[mesure-page] ");
  if (marqueur >= 0) {
    const { page } = JSON.parse(brute.slice(marqueur + 14)) as { page: string };
    pages.push({ page, lignes: [] });
    continue;
  }
  const mesure = brute.indexOf("[mesure] ");
  if (mesure < 0 || pages.length === 0) continue;
  const l = JSON.parse(brute.slice(mesure + 9)) as Ligne;
  pages[pages.length - 1].lignes.push(l);
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
