import { z } from "zod";

/**
 * V3.1-170 — Les pronoms d'une entité (bloc `character`) : des jeux connus,
 * plusieurs possibles (une personne genrée au masculin ET au féminin), plus
 * une saisie libre. La liste vit ici, une seule fois : l'écran la propose en
 * pastilles, le mode solo la lit pour accorder (`pronounGuidance`).
 */

export interface PronounSet {
  key: string;
  /** Le pronom sujet, ce que montre la pastille. */
  label: string;
  /** Sujet / complément / tonique : ce que le narrateur emploie. */
  forms: string;
}

export const PRONOUN_SETS = [
  { key: "he", label: "il", forms: "il/le/lui" },
  { key: "she", label: "elle", forms: "elle/la/elle" },
  { key: "neutral", label: "iel", forms: "iel/lae/ellui" },
  { key: "they_masculine", label: "ils", forms: "ils/les/eux" },
  { key: "they_feminine", label: "elles", forms: "elles/les/elles" },
] as const satisfies readonly PronounSet[];

export type PronounSetKey = (typeof PRONOUN_SETS)[number]["key"];

const PRONOUN_SET_KEYS = PRONOUN_SETS.map((p) => p.key) as [PronounSetKey, ...PronounSetKey[]];

const zPronounsObject = z.object({
  sets: z.array(z.enum(PRONOUN_SET_KEYS)).max(PRONOUN_SETS.length),
  custom: z.string().max(80).optional(),
});

/**
 * La forme stockée. Une ancienne valeur texte (avant V3.1-170, le champ était
 * un texte libre) se relit comme saisie libre : la donnée vit dans le JSON
 * du bloc, aucune migration SQL. Un jeu répété ne compte qu'une fois, une
 * saisie libre vide disparaît.
 */
export const zPronouns = z.preprocess(
  (brut) => (typeof brut === "string" ? { sets: [], custom: brut } : brut),
  zPronounsObject.transform((p) => {
    const custom = p.custom?.trim();
    return { sets: [...new Set(p.sets)], ...(custom ? { custom } : {}) };
  })
);

export type Pronouns = z.infer<typeof zPronouns>;

/**
 * Comment accorder l'entité, en une ligne pour le contexte d'un modèle (le
 * mode solo) : le jeu choisi et ses formes, ou l'alternance quand il y en a
 * plusieurs, dans l'ordre choisi ; la saisie libre s'ajoute telle quelle.
 * `null` quand rien n'est choisi : on ne devine pas un genre.
 */
export function pronounGuidance(p: Pronouns | undefined): string | null {
  if (!p) return null;
  const jeux = p.sets.map((k) => PRONOUN_SETS.find((s) => s.key === k)).filter((s): s is (typeof PRONOUN_SETS)[number] => s !== undefined);
  const libre = p.custom ? `« ${p.custom} »` : null;
  let base: string | null = null;
  if (jeux.length === 1) base = `${jeux[0].label} (${jeux[0].forms})`;
  else if (jeux.length > 1) base = `${jeux.map((j) => j.label).join(" et ")}, en alternance (${jeux.map((j) => j.forms).join(" ; ")})`;
  if (base && libre) return `${base} ; aussi ${libre}`;
  return base ?? libre;
}
