import { isValidAsiChoice, parseAsiChoice } from "@/src/core/rules/abilityScoreImprovement";
import { zClassProgressionBlockData } from "@/src/core/schemas/rule-blocks/blocks";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { Chemin, Etape, SousEtape } from "./cheminCreation";
import { progressionClasse, type LigneProgression } from "./progressionClasse";

/**
 * V3.1-51 — Ce que l'étape Classe montre de chaque emplacement : la
 * progression (une ligne par niveau) et ce qu'il reste à choisir au-delà du
 * premier niveau. Pur : l'assistant lui donne ce qu'il a déjà chargé (blocs
 * des fiches de classe, chemin, niveaux d'amélioration), il ne charge rien.
 */

interface BlocFiche {
  blockType: string;
  data: unknown;
}

const NIVEAU_MAX_PAR_DEFAUT = 20;

/**
 * Les aptitudes de chaque niveau, lues dans le bloc `class_progression` : les
 * colonnes de genre `grants` listent soit une aptitude (`feature`, nommée par
 * `nomDe`), soit un choix libre (`choice`, son texte). Un bloc illisible ne
 * donne aucune aptitude (la progression reste affichée, sans détail).
 */
export function aptitudesParNiveau(donnees: unknown, nomDe: (cle: string) => string): { maxNiveau: number; parNiveau: Record<number, string[]> } {
  const lu = zClassProgressionBlockData.safeParse(donnees);
  if (!lu.success) return { maxNiveau: NIVEAU_MAX_PAR_DEFAUT, parNiveau: {} };
  const bloc = lu.data;
  const colonneNiveau = bloc.columns.find((c) => c.kind === "level")?.key ?? "level";
  const colonnesAptitudes = bloc.columns.filter((c) => c.kind === "grants");
  const parNiveau: Record<number, string[]> = {};
  for (const ligne of bloc.rows) {
    const niveau = Number(ligne[colonneNiveau]);
    if (!Number.isInteger(niveau) || niveau < 1) continue;
    const noms: string[] = [];
    for (const colonne of colonnesAptitudes) {
      const accordees = ligne[colonne.key];
      if (!Array.isArray(accordees)) continue;
      for (const a of accordees) {
        if (!a || typeof a !== "object") continue;
        const { feature, choice } = a as { feature?: unknown; choice?: unknown };
        if (typeof feature === "string") noms.push(nomDe(feature));
        else if (typeof choice === "string") noms.push(choice);
      }
    }
    parNiveau[niveau] = noms;
  }
  return { maxNiveau: bloc.max_level, parNiveau };
}

export interface ProgressionEmplacement {
  classKey: string;
  maxNiveau: number;
  lignes: LigneProgression[];
  aFaireAuDelaDuPremier: number;
}

export interface EntreeProgressions {
  classes: CharacterBlockData["classes"];
  /** Montée de niveau : le niveau de chaque classe avant. Absent : création. */
  niveauxAvant?: ReadonlyMap<string, number>;
  blocs: Readonly<Record<string, readonly BlocFiche[]>>;
  chemin: Chemin;
  /** Les niveaux où chaque classe accorde une amélioration (`asiGrantedLevels`). */
  niveauxAmelioration: Readonly<Record<string, readonly number[]>>;
  reponses: Readonly<Record<string, unknown>>;
  nomAptitude: (cle: string) => string;
  libelleAmelioration: string;
}

/** La clé de réponse de l'amélioration d'un niveau, comme la route de montée de niveau la relit. */
export function cleAmelioration(classKey: string, niveau: number): string {
  return `${classKey}.l${niveau}.asi`;
}

/** Une entrée par emplacement (`null` tant que sa classe n'est pas choisie), et la somme des choix à faire au-delà du premier niveau. */
export function progressionsPersonnage(e: EntreeProgressions): { parEmplacement: (ProgressionEmplacement | null)[]; aFaireAuDelaDuPremier: number } {
  const sousEtapes = e.chemin.etapes.flatMap((et) => et.sous);
  let total = 0;
  const parEmplacement = e.classes.map((slot): ProgressionEmplacement | null => {
    if (slot.class.kind !== "rule" || !slot.class.key) return null;
    const classKey = slot.class.key;
    const blocs = e.blocs[classKey];
    const progression = blocs?.find((b) => b.blockType === "class_progression");
    const { maxNiveau, parNiveau } = progression ? aptitudesParNiveau(progression.data, e.nomAptitude) : { maxNiveau: NIVEAU_MAX_PAR_DEFAUT, parNiveau: {} };
    const emplacementSousClasse = blocs?.find((b) => b.blockType === "subclass_slot")?.data as { label?: string; chosen_at_level?: number } | undefined;
    const niveauAvant = e.niveauxAvant ? (e.niveauxAvant.get(classKey) ?? 0) : undefined;

    const resultat = progressionClasse({
      niveau: slot.level,
      ...(niveauAvant !== undefined ? { niveauAvant } : {}),
      maxNiveau: Math.max(maxNiveau, slot.level),
      aptitudesParNiveau: parNiveau,
      sousClasse:
        emplacementSousClasse && typeof emplacementSousClasse.chosen_at_level === "number"
          ? { niveau: emplacementSousClasse.chosen_at_level, choisie: Boolean(slot.subclass), libelle: emplacementSousClasse.label ?? "" }
          : null,
      ameliorations: (e.niveauxAmelioration[classKey] ?? []).map((niveau) => {
        const choix = parseAsiChoice(e.reponses[cleAmelioration(classKey, niveau)]);
        return { niveau, fait: choix !== null && isValidAsiChoice(choix), libelle: e.libelleAmelioration };
      }),
      choix: sousEtapes.filter((s) => s.classKey === classKey),
    });

    let lignes = resultat.lignes;
    let aFaire = resultat.aFaireAuDelaDuPremier;
    if (niveauAvant !== undefined) {
      // Montée de niveau : les niveaux acquis sont verrouillés, leurs choix ne se rouvrent pas.
      lignes = lignes.map((l) => (l.etat === "acquis" ? { ...l, pastilles: [] } : l));
      aFaire = lignes.filter((l) => l.etat === "nouveau").reduce((n, l) => n + l.pastilles.filter((p) => !p.fait).length, 0);
    }
    total += aFaire;
    return { classKey, maxNiveau: Math.max(maxNiveau, slot.level), lignes, aFaireAuDelaDuPremier: aFaire };
  });
  return { parEmplacement, aFaireAuDelaDuPremier: total };
}

/**
 * Montée de niveau : le chemin réduit à ce qui change. Classe (les choix des
 * nouveaux niveaux, quelle que soit leur étape d'origine), Points de vie,
 * Sorts, Aperçu.
 */
export function cheminMontee(nouvelles: readonly SousEtape[], opts: { avecPointsDeVie: boolean; avecSorts: boolean }): Chemin {
  const etapes: Etape[] = [
    { cle: "classe", sous: [...nouvelles], aFaire: nouvelles.filter((s) => !s.fait).length },
    ...(opts.avecPointsDeVie ? [{ cle: "pv", sous: [], aFaire: 0 } as Etape] : []),
    ...(opts.avecSorts ? [{ cle: "sorts", sous: [], aFaire: 0 } as Etape] : []),
    { cle: "apercu", sous: [], aFaire: 0 },
  ];
  return {
    etapes,
    ordre: etapes.flatMap((et) => [et.cle, ...et.sous.map((s) => `c:${s.cle}`)]),
    aFaire: etapes.reduce((n, et) => n + et.aFaire, 0),
  };
}
