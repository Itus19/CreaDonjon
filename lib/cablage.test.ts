import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * V3.1-62 — le cliquet du cablage (docs/CABLAGE.md §6). Compte, dans le code
 * d'interface, les trois motifs que les mesures du 11 octobre accusent :
 * - un composant qui charge ses donnees APRES l'affichage (`useEffect` +
 *   `fetch(` dans le meme fichier, regle C1) ;
 * - un rafraichissement complet de la page (`router.refresh()`, regle C5) ;
 * - un rechargement complet du navigateur (`window.location.reload()`).
 *
 * Le test echoue si un compte AUGMENTE. Quand une correction le fait
 * baisser, on abaisse le plafond ici dans le meme commit : le cliquet ne
 * revient jamais en arriere. Un nouveau fichier qui en a vraiment besoin
 * (rare) le justifie dans son commit et dans docs/CABLAGE.md.
 */
const PLAFONDS = {
  fichiersChargeantApresAffichage: 59,
  rafraichissementsComplets: 14,
  rechargementsNavigateur: 2,
};

const RACINES = ["components", "app", "src"];

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return nom === "node_modules" ? [] : fichiers(chemin);
    return /\.tsx?$/.test(nom) && !/\.test\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

/** Le code sans ses lignes de commentaire : une mention de `router.refresh()` dans une explication n'est pas un appel. */
function sansCommentaires(source: string): string {
  return source
    .split("\n")
    .filter((ligne) => !/^\s*(\/\/|\/\*|\*)/.test(ligne))
    .join("\n");
}

function compter() {
  const sources = RACINES.flatMap(fichiers).map((f) => readFileSync(f, "utf8"));
  const occurrences = (motif: RegExp) => sources.reduce((n, s) => n + (sansCommentaires(s).match(motif)?.length ?? 0), 0);
  return {
    fichiersChargeantApresAffichage: sources.filter((s) => s.includes("useEffect") && s.includes("fetch(")).length,
    rafraichissementsComplets: occurrences(/router\.refresh\(\)/g),
    rechargementsNavigateur: occurrences(/window\.location\.reload\(\)/g),
  };
}

describe("cliquet du cablage (docs/CABLAGE.md)", () => {
  const comptes = compter();
  for (const cle of Object.keys(PLAFONDS) as (keyof typeof PLAFONDS)[]) {
    it(`${cle} ne depasse pas ${PLAFONDS[cle]}`, () => {
      expect(comptes[cle], `${cle} a augmente : voir docs/CABLAGE.md avant d'ajouter un chargement`).toBeLessThanOrEqual(PLAFONDS[cle]);
    });
  }
});
