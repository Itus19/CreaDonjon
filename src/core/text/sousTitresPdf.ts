/**
 * V3.1-188 — deux restes de l'extraction du PDF du SRD français. Pur.
 *
 * 1. La fin du sous-titre d'un objet magique (rareté, harmonisation) a glissé
 *    au début de sa description : « (bronze) ou légendaire (fer) Souffler… ».
 *    `fragmentDeSousTitre` le reconnaît ; `retrouverSousTitre` relit le
 *    sous-titre entier dans la source (« Objet merveilleux, rare (argent ou
 *    airain), très rare (bronze) ou légendaire (fer) »), pour le remettre en
 *    tête au lieu de perdre une précision (« avec un Paladin »).
 * 2. `paragraphesDeLaSource` relit un passage déplacé par la mise en page
 *    (le texte de *divination*, glissé au milieu du sort suivant).
 */

const MORCEAU = String.raw`(?:\([^()]*\)|(?:peu courante?|très rare|rare|légendaire|artefact)|ou|,)`;
const FRAGMENT = new RegExp(String.raw`^((?:${MORCEAU}\s*)+?)\s*(?=[A-ZÀ-ÝŒ])`);

export function fragmentDeSousTitre(texte: string): { fragment: string; reste: string } | null {
  const t = texte.trimStart();
  if (!/^[a-zà-ÿ(]/.test(t)) return null;
  const m = FRAGMENT.exec(t);
  if (!m) return null;
  const fragment = m[1].trim();
  // Au moins une parenthèse ou un mot de rareté : « ou » ou une virgule seuls ne suffisent pas.
  if (!/\(|rare|courant|légendaire|artefact/.test(fragment)) return null;
  return { fragment, reste: t.slice(m[0].length).trimStart() };
}

const propre = (l: string) => l.replace(/\s+/g, " ").trim();
const CATEGORIE = /^(Objet merveilleux|Arme|Armure|Anneau|Baguette|Bâton|Potion|Parchemin|Sceptre|Munitions?|Bouclier)\b/;

/** Le sous-titre entier : les lignes de la catégorie jusqu'au fragment, juste avant le début du texte (sous `titre`, s'il est donné). */
export function retrouverSousTitre(lignes: readonly string[], fragment: string, debutDuTexte: string, titre?: string): string | null {
  const debut = propre(debutDuTexte).slice(0, 40);
  // Deux objets peuvent commencer par la même phrase : avec un titre, on ne cherche que sous lui.
  const titres = titre === undefined ? [-1] : lignes.flatMap((l, k) => (propre(l) === propre(titre) ? [k] : []));
  for (const t of titres) {
    const r = chercher(lignes, fragment, debut, t < 0 ? 0 : t + 1, t < 0 ? lignes.length : Math.min(lignes.length, t + 12));
    if (r) return r;
  }
  return null;
}

function chercher(lignes: readonly string[], fragment: string, debut: string, de: number, a: number): string | null {
  for (let i = de; i < a; i++) {
    if (propre(lignes[i]) === "" || !propre(lignes.slice(i, i + 3).join(" ")).startsWith(debut)) continue;
    // Remonter jusqu'à la ligne de catégorie (au plus 4 lignes non vides : la source a des lignes vides intercalées).
    for (let j = i - 1, vues = 0; j >= 0 && vues < 4; j--) {
      if (propre(lignes[j]) === "") continue;
      vues++;
      if (!CATEGORIE.test(propre(lignes[j]))) continue;
      const sousTitre = propre(lignes.slice(j, i).join(" "));
      if (sousTitre.endsWith(fragment)) return sousTitre;
      break;
    }
  }
  return null;
}

/** Un passage de la source, de la ligne qui commence par `debut` jusqu'à `jusqua` (exclue) ; un paragraphe par phrase finie en fin de ligne. */
export function paragraphesDeLaSource(lignes: readonly string[], debut: string, jusqua: string): string | null {
  const i = lignes.findIndex((l) => propre(l).startsWith(debut));
  if (i < 0) return null;
  const f = lignes.findIndex((l, k) => k > i && propre(l) === jusqua);
  if (f < 0) return null;
  const paragraphes: string[] = [""];
  for (const l of lignes.slice(i, f).map(propre).filter((x) => x !== "")) {
    paragraphes[paragraphes.length - 1] = propre(`${paragraphes[paragraphes.length - 1]} ${l}`);
    if (/[.!?»]$/.test(l)) paragraphes.push("");
  }
  return paragraphes.filter((p) => p !== "").join("\n");
}
