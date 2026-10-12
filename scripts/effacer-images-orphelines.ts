// V3.1-128 (docs/QUOTAS.md Q5, ADR 0057) — efface les images que plus rien
// ne designe : celles que liste `recenser-images-orphelines`, pas une de plus.
//
// Lancement :
//   npm run effacer:images-orphelines                          (liste + empreinte, n'efface rien)
//   npm run effacer:images-orphelines -- --confirmer <empreinte>   (efface)
//   ajouter `--monde <id du monde>` pour s'en tenir a un seul monde
//
// Garde-fous :
// - l'effacement exige l'EMPREINTE de la liste relue. La liste est recalculee
//   au moment d'effacer : si elle a change (une image envoyee, designee ou
//   effacee entre-temps), l'empreinte ne correspond plus et rien n'est efface ;
// - une image de moins d'une heure n'entre jamais dans la liste (envoi en cours) ;
// - le fichier d'abord, la ligne ensuite (meme ordre que `deleteAsset`) ;
// - une image de l'historique d'une fiche n'est pas comptee comme designee :
//   restaurer une ancienne version de cette fiche rendra une image vide.
//
// Irreversible. Une sauvegarde du stockage avant (docs/SECURITE.md §7) est prudente.

import { BUCKET, afficher, clientAdmin, empreinte, mo, recenser } from "./imagesOrphelines";

const index = process.argv.indexOf("--confirmer");
const EMPREINTE_DONNEE = index >= 0 ? (process.argv[index + 1] ?? "") : null;
const indexMonde = process.argv.indexOf("--monde");
const MONDE = indexMonde >= 0 ? (process.argv[indexMonde + 1] ?? "") : null;
if (MONDE !== null && !/^[0-9a-f-]{36}$/.test(MONDE)) throw new Error("--monde attend l'identifiant (uuid) d'un monde.");

async function main(): Promise<void> {
  const admin = clientAdmin();
  const r = await recenser(admin, MONDE);
  if (MONDE) console.log(`Monde ${MONDE} seulement.`);
  afficher(r);
  const attendue = empreinte(r);

  if (r.lignes.length === 0 && r.fichiers.length === 0) {
    console.log("\nAucun orphelin : rien a effacer.");
    return;
  }
  if (EMPREINTE_DONNEE === null) {
    console.log(`\nEmpreinte de cette liste : ${attendue}`);
    console.log(`Rien n'a ete efface. Pour effacer EXACTEMENT cette liste :\n  npm run effacer:images-orphelines -- --confirmer ${attendue}${MONDE ? ` --monde ${MONDE}` : ""}`);
    return;
  }
  if (EMPREINTE_DONNEE !== attendue) {
    console.error(`\nL'empreinte donnee (${EMPREINTE_DONNEE || "vide"}) ne correspond pas a la liste actuelle (${attendue}).`);
    console.error("La liste a change depuis la relecture, ou l'empreinte est mal recopiee. Rien n'a ete efface : relire la liste ci-dessus.");
    process.exit(1);
  }

  let fichiersRetires = 0;
  let lignesRetirees = 0;
  let octets = 0;
  const echecs: string[] = [];

  // Les lignes orphelines : leur fichier d'abord, puis la ligne.
  for (const a of r.lignes) {
    const { error: erreurFichier } = await admin.storage.from(BUCKET).remove([a.storage_path]);
    if (erreurFichier) {
      echecs.push(`fichier ${a.storage_path} : ${erreurFichier.message}`);
      continue; // la ligne reste : elle designe encore un fichier present
    }
    fichiersRetires++;
    const { error: erreurLigne } = await admin.from("assets").delete().eq("id", a.id);
    if (erreurLigne) {
      echecs.push(`ligne assets ${a.id} : ${erreurLigne.message}`);
      continue;
    }
    lignesRetirees++;
    octets += a.byte_size;
  }

  // Les fichiers sans ligne.
  for (const f of r.fichiers) {
    const { error } = await admin.storage.from(BUCKET).remove([f.chemin]);
    if (error) {
      echecs.push(`fichier ${f.chemin} : ${error.message}`);
      continue;
    }
    fichiersRetires++;
    octets += f.octets;
  }

  console.log(`\nEfface : ${lignesRetirees} ligne(s) assets, ${fichiersRetires} fichier(s), ${mo(octets)} liberes.`);
  if (echecs.length > 0) {
    console.error(`${echecs.length} echec(s), rien d'autre n'a ete touche :`);
    for (const e of echecs) console.error(`- ${e}`);
    process.exit(1);
  }
}

main().catch((erreur: unknown) => {
  console.error("Effacement interrompu", erreur);
  process.exit(1);
});
