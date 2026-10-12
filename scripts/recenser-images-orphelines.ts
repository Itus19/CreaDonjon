// V3.1-128 (docs/QUOTAS.md Q5) — recense les images que plus rien ne designe,
// en LECTURE SEULE. Pour les effacer : `npm run effacer:images-orphelines`.
//
// Lancement : npm run recenser:images-orphelines

import { afficher, clientAdmin, empreinte, recenser } from "./imagesOrphelines";

async function main(): Promise<void> {
  const r = await recenser(clientAdmin());
  afficher(r);
  console.log(`\nEmpreinte de cette liste : ${empreinte(r)}`);
  console.log("Rien n'a ete efface. Une image de l'historique d'une fiche n'est pas comptee comme designee (ADR 0057).");
}

main().catch((erreur: unknown) => {
  console.error("Recensement interrompu", erreur);
  process.exit(1);
});
