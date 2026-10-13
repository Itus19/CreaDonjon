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
 * - un `catch` muet (V3.1-126, CLAUDE.md : pas de `catch` silencieux), voir
 *   `estMuet` ci-dessous.
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
  catchMuets: 0,
};

const RACINES = ["components", "app", "src", "lib"];

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

/** Le corps entre accolades qui commence juste apres `ouverture` (l'index du caractere suivant l'accolade ouvrante). */
function corps(source: string, ouverture: number): string {
  let profondeur = 1;
  let i = ouverture;
  for (; i < source.length && profondeur > 0; i++) {
    if (source[i] === "{") profondeur++;
    else if (source[i] === "}") profondeur--;
  }
  return source.slice(ouverture, i - 1);
}

/**
 * Un `catch` est muet s'il avale l'erreur : `catch { ... }` ou
 * `catch (x) { ... }` ou `.catch(() => { ... })` dont le corps ne
 * - relance (`throw`), ni ne renvoie une erreur typee ou HTTP (`ok: false`,
 *   `error:`, `NextResponse`), ni ne pose un etat d'erreur (`setXxxError(`,
 *   `set...("error")`) ;
 * - utilise la variable capturee (journal, message) ;
 * - ne porte le marqueur `catch-attendu` (echec prevu par conception : saisie
 *   mal formee, comportement documente du framework), a justifier dans le
 *   commentaire qui suit le marqueur.
 * Les formes en expression `.catch(() => setX(null))`, `.catch(() => setX([]))`
 * et `.catch(() => CONSTANTE)` (repli sans trace) comptent aussi. Pas
 * `.catch(() => null)` : il sert a lire un corps JSON que Zod valide ensuite.
 */
function catchMuets(source: string): number {
  const motif = /catch\s*(?:\((\w+)\))?\s*\{|\.catch\(\(\)\s*=>\s*\{/g;
  let n = 0;
  for (let m = motif.exec(source); m; m = motif.exec(source)) {
    const brut = corps(source, m.index + m[0].length);
    if (brut.includes("catch-attendu")) continue;
    const code = sansCommentaires(brut);
    const traite =
      /\bthrow\b|NextResponse|ok: false|error:|"error"|\bset\w*Error\(/.test(code) ||
      (m[1] !== undefined && new RegExp(`\\b${m[1]}\\b`).test(code));
    if (!traite) n++;
  }
  const replis = source.match(/\.catch\(\(\)\s*=>\s*(?:set\w+\((?:null|\[\])\)|[A-Z][A-Z_]{2,})\)/g);
  return n + (replis?.length ?? 0);
}

function compter() {
  const sources = RACINES.flatMap(fichiers).map((f) => readFileSync(f, "utf8"));
  const occurrences = (motif: RegExp) => sources.reduce((n, s) => n + (sansCommentaires(s).match(motif)?.length ?? 0), 0);
  return {
    fichiersChargeantApresAffichage: sources.filter((s) => s.includes("useEffect") && s.includes("fetch(")).length,
    rafraichissementsComplets: occurrences(/router\.refresh\(\)/g),
    rechargementsNavigateur: occurrences(/window\.location\.reload\(\)/g),
    catchMuets: sources.reduce((n, s) => n + catchMuets(s), 0),
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
