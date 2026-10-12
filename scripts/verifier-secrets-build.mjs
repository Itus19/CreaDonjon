/**
 * docs/SECURITE.md §4 — verifie qu'aucun secret ne part au navigateur.
 *
 * A lancer APRES `npm run build` : parcourt `.next/static`, c'est-a-dire
 * tout ce que le navigateur telecharge, et y cherche :
 * - la VALEUR de chaque variable secrete presente dans l'environnement ;
 * - le NOM de ces variables (signe qu'un fichier client les lit).
 *
 * N'affiche jamais une valeur : seulement le nom de la variable et le
 * fichier ou elle a ete trouvee. Sort en erreur (code 1) au premier constat.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Tout ce qui n'est PAS `NEXT_PUBLIC_` et ne doit jamais quitter le serveur.
const SECRETS = ["SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY", "VOYAGE_API_KEY", "MANUAL_TEST_PASSWORD"];
const DOSSIER = ".next/static";

function fichiers(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

let liste;
try {
  liste = fichiers(DOSSIER);
} catch (erreur) {
  console.error(`Dossier ${DOSSIER} illisible : lancer \`npm run build\` d'abord.`, erreur);
  process.exit(1);
}

// Une valeur trop courte trouverait des faux positifs partout.
const valeurs = SECRETS.flatMap((nom) => {
  const valeur = process.env[nom];
  return valeur && valeur.length >= 12 ? [{ nom, valeur }] : [];
});
const absentes = SECRETS.filter((nom) => !valeurs.some((v) => v.nom === nom));

const constats = [];
for (const fichier of liste) {
  const contenu = readFileSync(fichier, "utf8");
  for (const { nom, valeur } of valeurs) {
    if (contenu.includes(valeur)) constats.push(`VALEUR de ${nom} dans ${fichier}`);
  }
  for (const nom of SECRETS) {
    if (contenu.includes(nom)) constats.push(`nom ${nom} dans ${fichier}`);
  }
}

console.log(`${liste.length} fichiers envoyes au navigateur, ${valeurs.length} valeurs secretes cherchees.`);
if (absentes.length > 0) console.log(`Absentes de l'environnement (seul leur nom est cherche) : ${absentes.join(", ")}`);
if (constats.length > 0) {
  console.error("SECRET EXPOSE :");
  for (const constat of constats) console.error(`- ${constat}`);
  process.exit(1);
}
console.log("Aucun secret trouve.");
