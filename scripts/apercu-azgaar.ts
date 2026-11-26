// G-7 (specs/generation-du-monde.md §8) — l'histoire d'une carte Azgaar, en aperçu.
//
// Lit un export « Complet » d'Azgaar (JSON), le convertit en monde abstrait, en
// simule l'histoire et affiche la chronique telle qu'elle entrerait dans la
// frise. Aucune base, aucun réseau : coût (QUOTAS) nul.
//
// Lancement : npm run apercu:azgaar -- <fichier.json> [années] [nombre d'entrées affichées]
//   npm run apercu:azgaar -- ~/Téléchargements/Anteau_Full.json 600 80

import { readFileSync } from "node:fs";
import { azgaarToAbstractWorld, zAzgaarExport } from "../src/core/worldgen/azgaar/import";
import { zAbstractWorld } from "../src/core/worldgen/world";
import { simulateHistory } from "../src/core/worldgen/history/simulate";
import { chronicleToTimelineEntries } from "../src/core/worldgen/history/timeline";

const [file, yearsArg, shownArg] = process.argv.slice(2);
if (!file) throw new Error("Indique le fichier JSON exporté d'Azgaar (Exporter en JSON > Complet).");
const years = yearsArg === undefined ? 300 : Number(yearsArg);
const shown = shownArg === undefined ? 60 : Number(shownArg);

const world = zAbstractWorld.parse(azgaarToAbstractWorld(zAzgaarExport.parse(JSON.parse(readFileSync(file, "utf8")))));
const chronicle = simulateHistory(world, { years });
const entries = chronicleToTimelineEntries(chronicle, world);

console.log(
  `Monde : ${world.sites.length} villes, ${world.states.length} États, ${world.cultures.length} peuples, ` +
    `${world.links.length} liens, ${world.anchors.length} guerres imposées, présent en ${world.presentYear}.`
);
console.log(`Chronique de ${chronicle.startYear} à ${chronicle.presentYear} : ${entries.length} événements gardés, ${chronicle.dropped} écartés par le plafond.\n`);
const major = entries.filter((e) => e.scope !== "detail");
for (const entry of major.slice(0, shown)) {
  const period = entry.date.end ? `${entry.date.year}-${entry.date.end.year}` : String(entry.date.year);
  console.log(`${period.padStart(9)}  [${(entry.scope ?? "").padEnd(7)}]  ${entry.title}`);
}
if (major.length > shown) console.log(`… et ${major.length - shown} autres (hors détails).`);
