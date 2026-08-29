import { type RelationshipAxisKey } from "./keys";

/**
 * Bandes nommées (V2-H1, specs/psyche-pnj.md §1.5/§3) : le nombre ne sort
 * jamais du moteur — l'écran et le contexte IA reçoivent une bande, jamais
 * la valeur brute. Seuils exacts de la spec.
 */
export const BAND_TIERS = [
  "extreme_neg",
  "strong_neg",
  "slight_neg",
  "neutral",
  "slight_pos",
  "strong_pos",
  "extreme_pos",
] as const;
export type BandTier = (typeof BAND_TIERS)[number];

export function bandTierFor(value: number): BandTier {
  if (value <= -67) return "extreme_neg";
  if (value <= -34) return "strong_neg";
  if (value <= -12) return "slight_neg";
  if (value <= 11) return "neutral";
  if (value <= 33) return "slight_pos";
  if (value <= 66) return "strong_pos";
  return "extreme_pos";
}

/** specs/psyche-pnj.md §3 — un mot par axe de relation et par bande, jamais le nombre nu. */
export const RELATIONSHIP_AXIS_BAND_LABELS_FR: Record<RelationshipAxisKey, Record<BandTier, string>> = {
  trust_distrust: {
    extreme_neg: "convaincu de sa duplicité",
    strong_neg: "méfiant",
    slight_neg: "réservé",
    neutral: "neutre",
    slight_pos: "ouvert",
    strong_pos: "confiant",
    extreme_pos: "aveugle",
  },
  friendship_hostility: {
    extreme_neg: "haineux",
    strong_neg: "hostile",
    slight_neg: "froid",
    neutral: "indifférent",
    slight_pos: "cordial",
    strong_pos: "amical",
    extreme_pos: "dévoué",
  },
  respect_contempt: {
    extreme_neg: "méprisant",
    strong_neg: "dédaigneux",
    slight_neg: "sceptique",
    neutral: "neutre",
    slight_pos: "estime",
    strong_pos: "admiratif",
    extreme_pos: "révérencieux",
  },
  attraction_repulsion: {
    extreme_neg: "répugné",
    strong_neg: "rebuté",
    slight_neg: "distant",
    neutral: "indifférent",
    slight_pos: "intrigué",
    strong_pos: "attiré",
    extreme_pos: "épris",
  },
  debt_independence: {
    extreme_neg: "se sent lésé",
    strong_neg: "rancunier",
    slight_neg: "quitte",
    neutral: "neutre",
    slight_pos: "redevable",
    strong_pos: "obligé",
    extreme_pos: "lié",
  },
  fear_assurance: {
    extreme_neg: "le domine",
    strong_neg: "l'intimide",
    slight_neg: "prudent",
    neutral: "neutre",
    slight_pos: "mal à l'aise",
    strong_pos: "craintif",
    extreme_pos: "terrifié",
  },
  interest_indifference: {
    extreme_neg: "l'évite",
    strong_neg: "l'ignore",
    slight_neg: "distrait",
    neutral: "neutre",
    slight_pos: "attentif",
    strong_pos: "intéressé",
    extreme_pos: "obsédé",
  },
};

export function relationshipAxisLabel(axis: RelationshipAxisKey, value: number): string {
  return RELATIONSHIP_AXIS_BAND_LABELS_FR[axis][bandTierFor(value)];
}
