import type { Chemin, SousEtape } from "./cheminCreation";

/**
 * V3.1-51 — La progression d'une classe, une ligne par niveau, et les choix
 * qu'elle porte. Les niveaux, la sous-classe, les améliorations et le
 * plafond viennent du ruleset (l'appelant les lit dans `class_progression`
 * et `subclass_slot`) : rien n'est écrit en dur ici.
 *
 * - création : sous le niveau, acquis ; au niveau, atteint ; au-delà, à venir ;
 * - montée de niveau : jusqu'au niveau d'avant, acquis (verrouillé) ; les
 *   niveaux gagnés, nouveaux.
 * Chaque choix d'un niveau atteint est une pastille sur sa ligne ; une ligne
 * à venir annonce seulement ce qui viendra.
 */

export interface PastilleNiveau {
  /** La clé du choix (`c:<clé>` pour s'y rendre), ou `sousclasse` / `amelioration:<niveau>`. */
  cle: string;
  genre: "choix" | "sousclasse" | "amelioration";
  libelle: string;
  fait: boolean;
}

export interface LigneProgression {
  niveau: number;
  etat: "acquis" | "atteint" | "nouveau" | "avenir";
  aptitudes: string[];
  pastilles: PastilleNiveau[];
  /** Ligne à venir : ce que le niveau apportera (sous-classe, amélioration). */
  aVenir: string[];
}

export interface EntreeProgression {
  niveau: number;
  /** Montée de niveau : le niveau de la classe avant. Absent : création. */
  niveauAvant?: number;
  maxNiveau: number;
  aptitudesParNiveau: Readonly<Record<number, readonly string[]>>;
  sousClasse: { niveau: number; choisie: boolean; libelle: string } | null;
  /** Améliorations de caractéristique et dons épiques, aux niveaux que la progression accorde. */
  ameliorations: readonly { niveau: number; fait: boolean; libelle: string }[];
  /** Les sous-étapes du chemin de CETTE classe (`SousEtape.classKey`). */
  choix: readonly SousEtape[];
}

export function progressionClasse(e: EntreeProgression): { lignes: LigneProgression[]; aFaireAuDelaDuPremier: number } {
  const lignes: LigneProgression[] = [];
  let aFaire = 0;
  for (let n = 1; n <= e.maxNiveau; n++) {
    const atteint = n <= e.niveau;
    const etat: LigneProgression["etat"] =
      e.niveauAvant !== undefined ? (n <= e.niveauAvant ? "acquis" : atteint ? "nouveau" : "avenir") : n < e.niveau ? "acquis" : n === e.niveau ? "atteint" : "avenir";

    const pastilles: PastilleNiveau[] = [];
    const aVenir: string[] = [];
    if (e.sousClasse && e.sousClasse.niveau === n) {
      if (atteint) pastilles.push({ cle: "sousclasse", genre: "sousclasse", libelle: e.sousClasse.libelle, fait: e.sousClasse.choisie });
      else aVenir.push(e.sousClasse.libelle);
    }
    for (const a of e.ameliorations) {
      if (a.niveau !== n) continue;
      if (atteint) pastilles.push({ cle: `amelioration:${n}`, genre: "amelioration", libelle: a.libelle, fait: a.fait });
      else aVenir.push(a.libelle);
    }
    if (atteint) {
      for (const c of e.choix) if (c.niveau === n) pastilles.push({ cle: c.cle, genre: "choix", libelle: c.libelle, fait: c.fait });
    }
    if (n > 1) aFaire += pastilles.filter((p) => !p.fait).length;
    lignes.push({ niveau: n, etat, aptitudes: [...(e.aptitudesParNiveau[n] ?? [])], pastilles, aVenir });
  }
  return { lignes, aFaireAuDelaDuPremier: aFaire };
}

/** Monter de niveau : les sous-étapes qui n'existaient pas avant (les choix des nouveaux niveaux, d'une nouvelle classe). */
export function sousEtapesNouvelles(avant: Chemin, apres: Chemin): SousEtape[] {
  const connues = new Set(avant.etapes.flatMap((e) => e.sous.map((s) => s.cle)));
  return apres.etapes.flatMap((e) => e.sous).filter((s) => !connues.has(s.cle));
}
