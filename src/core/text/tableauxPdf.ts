/**
 * Tableaux aplatis — les tableaux du SRD français, relus dans le texte
 * extrait du PDF (une rangée par ligne, parfois deux ou trois tableaux côte à
 * côte, une cellule longue sur plusieurs lignes) et réécrits en lignes
 * « a | b | c » que le rendu des textes de règle affiche en tableau. Pur.
 *
 * Rien n'est deviné : chaque tableau a sa description (en-tête, ligne qui le
 * suit, début et découpe d'une rangée, nombre de rangées attendu), et une
 * rangée qui ne se découpe pas, ou un compte faux, est refusé.
 */

export type SpecBloc =
  | {
      type: "tableau";
      /** Ligne de titre qui précède l'en-tête ; réécrite en gras. */
      titre?: string;
      /** Les lignes d'en-tête dans la source, exactes (espaces de bord ignorés). */
      entete: string[];
      /** Les noms de colonnes affichés. */
      colonnes: string[];
      /** La première ligne après le tableau (exclue). */
      jusqua: string;
      /** Une ligne qui ouvre une rangée ; les autres continuent la précédente. */
      debutRangee: RegExp;
      /** Les cellules d'une rangée (ou de `parLigne` rangées) en groupes. */
      decoupe: RegExp;
      /** Plusieurs tableaux côte à côte : autant de rangées par ligne. */
      parLigne?: number;
      /** Avec `parLigne` : garder l'ordre des lignes (un profil de créature) plutôt que colonne par colonne. */
      ordreLignes?: boolean;
      rangees: number;
    }
  /** Des lignes reprises telles quelles (un profil de créature) ; `debut` en gras sauf `gras: false`. */
  | { type: "lignes"; debut: string; jusqua: string; gras?: boolean };

export type Lecture = { ok: true; rangees: string[][]; debut: number; fin: number } | { ok: false; erreur: string };

const BRUIT = [/^=== page \d+ ===$/, /^\d+ Document de Référence du Système 5\.2\.1$/, /^Document de Référence du Système 5\.2\.1( \d+)?$/];
const propre = (l: string) => l.replace(/\s+/g, " ").trim();
const estBruit = (l: string) => propre(l) === "" || BRUIT.some((r) => r.test(propre(l)));

/** Les lignes utiles à partir de `depuis`, avec leur position. */
function utiles(lignes: readonly string[], depuis: number): { i: number; t: string }[] {
  const out: { i: number; t: string }[] = [];
  for (let i = depuis; i < lignes.length; i++) if (!estBruit(lignes[i])) out.push({ i, t: propre(lignes[i]) });
  return out;
}

export function lireBloc(lignes: readonly string[], depuis: number, spec: SpecBloc): Lecture {
  const u = utiles(lignes, depuis);
  const premiere = spec.type === "lignes" ? [spec.debut] : [...(spec.titre ? [spec.titre] : []), ...spec.entete.map(propre)];
  const k = u.findIndex((_, j) => premiere.every((p, n) => u[j + n]?.t === p));
  if (k < 0) return { ok: false, erreur: `en-tête « ${premiere.join(" / ")} » introuvable` };
  const corps = u.slice(k + (spec.type === "lignes" ? 1 : premiere.length));
  const f = corps.findIndex((x) => x.t === propre(spec.jusqua));
  if (f < 0) return { ok: false, erreur: `borne « ${spec.jusqua} » introuvable` };
  const contenu = corps.slice(0, f).map((x) => x.t);
  const fin = corps[f].i;
  if (spec.type === "lignes") return { ok: true, rangees: [[spec.debut], ...contenu.map((t) => [t])], debut: u[k].i, fin };

  // Recoller les suites ; une ligne qui répète l'en-tête (tableau coupé en deux) est sautée.
  const brutes: string[] = [];
  for (const t of contenu) {
    if (spec.entete.map(propre).includes(t)) continue;
    if (spec.debutRangee.test(t) || brutes.length === 0) brutes.push(t);
    else brutes[brutes.length - 1] += ` ${t}`;
  }
  const n = spec.colonnes.length;
  const par = spec.parLigne ?? 1;
  const piles: string[][][] = Array.from({ length: par }, () => []);
  const ordre: string[][] = [];
  for (const b of brutes) {
    const m = spec.decoupe.exec(b);
    if (!m) return { ok: false, erreur: `rangée qui ne se découpe pas : « ${b} »` };
    const cellules = m.slice(1).filter((c) => c !== undefined).map(propre);
    if (cellules.length % n !== 0 || cellules.length / n > par) return { ok: false, erreur: `rangée de ${cellules.length} cellules pour ${n} colonnes : « ${b} »` };
    for (let p = 0; p * n < cellules.length; p++) {
      const r = cellules.slice(p * n, p * n + n);
      piles[p].push(r);
      ordre.push(r);
    }
  }
  const rangees = spec.ordreLignes ? ordre : piles.flat();
  if (rangees.length !== spec.rangees) return { ok: false, erreur: `${rangees.length} rangées lues, ${spec.rangees} attendues` };
  return { ok: true, rangees, debut: u[k].i, fin };
}

export function blocEnTexte(spec: SpecBloc, rangees: readonly string[][]): string {
  if (spec.type === "lignes") return rangees.map((r, i) => (i === 0 && spec.gras !== false ? `**${r[0]}**` : r[0])).join("\n");
  return [...(spec.titre ? [`**${spec.titre}**`] : []), spec.colonnes.join(" | "), ...rangees.map((r) => r.join(" | "))].join("\n");
}

/** Une liste à puces écrite sur une seule ligne (« • a • b ») : chaque puce sur sa ligne. */
export function puceParLigne(texte: string): string {
  return texte.replace(/\s+•\s+/g, "\n• ");
}

export type BlocDeTexte = { type: "ligne"; texte: string } | { type: "tableau"; colonnes: string[]; rangees: string[][] };

const LIGNE_DE_TABLEAU = /\s\|\s/;

/**
 * Pour le rendu : les lignes d'un texte de règle, où deux lignes consécutives
 * ou plus de la forme « a | b » forment un tableau (la première est
 * l'en-tête). Une ligne isolée avec une barre reste du texte. Une grammaire
 * fermée de plus, comme les marques de mise en forme (règle 7 : pas de
 * parseur généraliste).
 */
export function decouperLignesEtTableaux(texte: string): BlocDeTexte[] {
  const lignes = texte.split("\n");
  const out: BlocDeTexte[] = [];
  for (let i = 0; i < lignes.length; ) {
    let j = i;
    while (j < lignes.length && LIGNE_DE_TABLEAU.test(lignes[j])) j++;
    if (j - i >= 2) {
      const cellules = lignes.slice(i, j).map((l) => l.split("|").map((c) => c.trim()));
      const colonnes = cellules[0];
      out.push({ type: "tableau", colonnes, rangees: cellules.slice(1).map((r) => colonnes.map((_, k) => r[k] ?? "")) });
      i = j;
    } else {
      if (lignes[i] !== "" || i < lignes.length - 1) out.push({ type: "ligne", texte: lignes[i] });
      i++;
    }
  }
  return out;
}
