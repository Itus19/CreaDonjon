// G-6 (specs/generation-du-monde.md §9) — l'aperçu de la chronique du monde de test.
//
// Aucune base, aucun réseau : le script simule l'histoire de `MONDE_ESSAI` et
// l'affiche telle qu'elle entrerait dans la frise. Coût (QUOTAS) : nul.
//
// Lancement : npm run apercu:histoire -- [graine] [années]
//   npm run apercu:histoire              graine du monde de test, 300 ans
//   npm run apercu:histoire -- 42 600    graine 42, 600 ans

import { MONDE_ESSAI } from "../src/core/worldgen/history/mondeEssai";
import { simulateHistory } from "../src/core/worldgen/history/simulate";
import { chronicleToTimelineEntries } from "../src/core/worldgen/history/timeline";

const [seedArg, yearsArg] = process.argv.slice(2);
const seed = seedArg === undefined ? MONDE_ESSAI.seed : Number(seedArg);
const years = yearsArg === undefined ? 300 : Number(yearsArg);
if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("La graine doit être un entier de 0 à 2^32 - 1.");

const world = { ...MONDE_ESSAI, seed };
const chronicle = simulateHistory(world, { years });
const entries = chronicleToTimelineEntries(chronicle, world);

console.log(`Chronique de ${chronicle.startYear} à ${chronicle.presentYear} (graine ${seed}) : ${entries.length} événements, ${chronicle.dropped} écartés par le plafond.\n`);
for (const entry of entries) {
  const period = entry.date.end ? `${entry.date.year}-${entry.date.end.year}` : String(entry.date.year);
  console.log(`${period.padStart(9)}  [${(entry.scope ?? "").padEnd(7)}]  ${entry.title}`);
}
