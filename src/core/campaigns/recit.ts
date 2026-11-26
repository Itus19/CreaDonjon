import { z } from "zod";

/**
 * V3.2-5 (élargi le 26 novembre 2026) — Le réglage « Récit » d'une partie :
 * comment la narration s'adresse à la personne qui joue, sur quel registre,
 * et si les scènes intimes sont permises. Il vit dans
 * `campaigns.table_settings.recit` (jsonb, aucune migration) et ne voyage
 * que jusqu'à la consigne du modèle : le moteur n'en lit rien.
 *
 * Le registre est une consigne de la personne qui possède la partie, pas un
 * contenu du wiki : il entre dans la consigne système, sans balise de données
 * (règle 10, qui vise le contenu du monde).
 */

export const RECIT_PERSONNES = ["tu", "vous", "il"] as const;
export type RecitPersonne = (typeof RECIT_PERSONNES)[number];

/** Bornes de colonne : de quoi écrire une page de consignes, pas un roman. */
export const REGISTRE_MAX = 2000;
export const STYLE_INTIME_MAX = 4000;

export interface RecitSettings {
  personne: RecitPersonne;
  /** Le ton général, en texte libre. */
  registre: string;
  /** Coupé par défaut. Allumé, `style_intime` rejoint la consigne. */
  scenes_intimes: boolean;
  style_intime: string;
}

/** Le registre écrit par l'auteur le 26 novembre 2026, valeur de départ de toute partie. */
export const REGISTRE_PAR_DEFAUT =
  "Sombre et réaliste, inspiré du Witcher : monde moralement ambigu, choix coûteux, victoires qui se paient d'un prix. " +
  "Violence, politique, désir et mort sont traités avec la même honnêteté brute. " +
  "La lumière et l'obscurité coexistent : ni utopie, ni désespoir permanent. " +
  "L'humour naît naturellement des situations et des personnalités, sans jamais forcer le trait.";

export const DEFAULT_RECIT: RecitSettings = {
  personne: "tu",
  registre: REGISTRE_PAR_DEFAUT,
  scenes_intimes: false,
  style_intime: "",
};

/** Schéma d'ÉCRITURE : partiel, strict, borné. Un texte vide est permis (le registre retombe alors sur rien). */
export const zRecitPatch = z
  .object({
    personne: z.enum(RECIT_PERSONNES).optional(),
    registre: z.string().max(REGISTRE_MAX).optional(),
    scenes_intimes: z.boolean().optional(),
    style_intime: z.string().max(STYLE_INTIME_MAX).optional(),
  })
  .strict();
export type RecitPatch = z.infer<typeof zRecitPatch>;

/** LECTURE : champ par champ, une valeur illisible retombe sur le défaut (scènes intimes coupées). */
export function parseRecit(raw: unknown): RecitSettings {
  const source = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const personne = z.enum(RECIT_PERSONNES).safeParse(source.personne);
  return {
    personne: personne.success ? personne.data : DEFAULT_RECIT.personne,
    registre: typeof source.registre === "string" ? source.registre.slice(0, REGISTRE_MAX) : DEFAULT_RECIT.registre,
    scenes_intimes: source.scenes_intimes === true,
    style_intime: typeof source.style_intime === "string" ? source.style_intime.slice(0, STYLE_INTIME_MAX) : DEFAULT_RECIT.style_intime,
  };
}

export function mergeRecit(current: RecitSettings, patch: RecitPatch | undefined): RecitSettings {
  if (!patch) return current;
  return {
    personne: patch.personne ?? current.personne,
    registre: patch.registre ?? current.registre,
    scenes_intimes: patch.scenes_intimes ?? current.scenes_intimes,
    style_intime: patch.style_intime ?? current.style_intime,
  };
}
