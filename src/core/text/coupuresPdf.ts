/**
 * V3.1-180 — nettoyer un texte français extrait du PDF du SRD. Pur.
 *
 * 1. `recollerCoupures` : une phrase coupée en fin de ligne par la mise en
 *    page garde son retour, et le rendu (`Prose`) en fait deux paragraphes.
 *    On recolle quand la ligne finit au milieu d'une phrase (minuscule,
 *    virgule, apostrophe) et que la suivante la continue (minuscule, « ( ou
 *    un nombre ; une majuscule seulement après un petit mot de liaison :
 *    « valeur de⏎Force »). Les vrais retours restent : fin de phrase,
 *    intertitre en gras, point de liste.
 * 2. `couperDebordement` : le dernier texte d'un chapitre a parfois avalé le
 *    début du suivant (« … ce tour. Roublard Traits de base du Roublard… »),
 *    ou un titre de section resté collé à la fin.
 */

const FIN_SANS_PONCTUATION = /[a-zà-ÿœ,’']$/;
const SUITE = /^[a-zà-ÿœ«(0-9]/;
const DEBUT_RETOUR_VRAI = /^(\*|-|•)/;
const LIAISONS = new Set([
  "de", "du", "des", "au", "aux", "à", "en", "sur", "sous", "par", "pour", "avec", "dans", "le", "la", "les", "un", "une", "et", "ou",
  "votre", "vos", "son", "sa", "ses", "leur", "leurs", "ce", "cette", "ces", "contre", "entre",
]);

export interface Coupure {
  avant: string;
  apres: string;
}

/** Une rangée de tableau (« a | b », V3.1-187) : jamais recollée à sa voisine. */
const RANGEE_DE_TABLEAU = /\s\|\s/;

function seRecolle(ligne: string, suivante: string): boolean {
  if (suivante === "" || DEBUT_RETOUR_VRAI.test(suivante) || !FIN_SANS_PONCTUATION.test(ligne)) return false;
  if (RANGEE_DE_TABLEAU.test(ligne) || RANGEE_DE_TABLEAU.test(suivante)) return false;
  if (SUITE.test(suivante)) return true;
  const dernierMot = ligne.split(/\s+/).pop()?.toLowerCase() ?? "";
  return /^[A-ZÀ-ÝŒ]/.test(suivante) && LIAISONS.has(dernierMot);
}

export function recollerCoupures(texte: string): { texte: string; coupures: Coupure[] } {
  const lignes = texte.split("\n");
  const coupures: Coupure[] = [];
  const sortie: string[] = [lignes[0]];
  for (let i = 1; i < lignes.length; i++) {
    const precedente = sortie[sortie.length - 1].trimEnd();
    const suivante = lignes[i].trimStart();
    if (seRecolle(precedente, suivante)) {
      coupures.push({ avant: precedente.split(/\s+/).slice(-2).join(" "), apres: suivante.split(/\s+/).slice(0, 2).join(" ") });
      sortie[sortie.length - 1] = /[’']$/.test(precedente) ? precedente + suivante : `${precedente} ${suivante}`;
    } else sortie.push(lignes[i]);
  }
  return { texte: sortie.join("\n"), coupures };
}

/** Titres de section relevés collés à la fin d'un texte (recensement du 8 novembre). */
const TITRES_FINAUX = ["Glossaire de règles", "Épée mordante", "Épée voleuse de vie"];
const CHAPITRE_DE_CLASSE = /\s+(\S+) Traits de base (?:du |de la |de l’|de l'|des )(\S+)/;

export function couperDebordement(texte: string): { texte: string; coupe: string | null } {
  const m = CHAPITRE_DE_CLASSE.exec(texte);
  if (m && m[1] === m[2]) return { texte: texte.slice(0, m.index).trimEnd(), coupe: texte.slice(m.index).trim() };
  const fin = texte.trimEnd();
  const titre = TITRES_FINAUX.find((t) => fin.endsWith(` ${t}`));
  if (titre) return { texte: fin.slice(0, -titre.length).trimEnd(), coupe: titre };
  return { texte, coupe: null };
}
