import { z } from "zod";

/**
 * Forme de `entity_runtime_state.state` (V1-B3, specs/wiki-blocs.md §4.2) :
 * ni build, ni valeur derivee — ce qui change a chaque tour de jeu et
 * depend de la campagne. Jamais dans le bloc `character` (V1-B2), jamais
 * une `entity_revision` : une mutation de jeu ecrit un `session_event`
 * (specs/wiki-blocs.md §4.5).
 */
export const zRuntimeState = z.object({
  hp: z.object({
    current: z.number().int().nonnegative(),
    temp: z.number().int().nonnegative(),
  }),
  // Cle libre ("d10", "d8"...) plutot qu'un type ferme : depend des classes du personnage.
  hit_dice: z.record(z.string(), z.number().int().nonnegative()),
  exhaustion: z.number().int().min(0).max(6),
  /**
   * V2.1-26 — l'inspiration héroïque, qui n'existait nulle part.
   *
   * `.default(0)` et jamais un champ requis : `zRuntimeState.parse` tourne à
   * chaque ouverture de fiche (`getOrInitializeRuntimeState`), et toutes les
   * lignes déjà en base ont été écrites sans ce champ. Aucune migration SQL —
   * `state` est un `jsonb`, seule sa forme Zod change.
   *
   * Un ENTIER, pas un booléen : le SRD 2024 rend l'inspiration binaire, mais
   * beaucoup de tables en distribuent plusieurs. L'entier couvre les deux, la
   * borne haute évite qu'un clic répété fasse dériver le compteur.
   */
  inspiration: z.number().int().min(0).max(5).default(0),
  xp: z.number().int().nonnegative(),
  // Cle = id de tracker du bloc `resources` (V1-B2) ; valeur = usages consommes, pas restants.
  resources: z.record(z.string(), z.number().int().nonnegative()),
  // Cle = niveau d'emplacement ("1".."9") ; valeur = emplacements consommes.
  spell_slots_used: z.record(z.string(), z.number().int().nonnegative()),
  conditions: z.array(z.string()),
  death_saves: z.object({
    success: z.number().int().min(0).max(3),
    fail: z.number().int().min(0).max(3),
  }),
  // Ids d'entites (objets attunes, cf. `inventory.items[].attuned`).
  attuned: z.array(z.string()),
});
export type RuntimeState = z.infer<typeof zRuntimeState>;

export function defaultRuntimeState(): RuntimeState {
  return {
    hp: { current: 0, temp: 0 },
    hit_dice: {},
    exhaustion: 0,
    inspiration: 0,
    xp: 0,
    resources: {},
    spell_slots_used: {},
    conditions: [],
    death_saves: { success: 0, fail: 0 },
    attuned: [],
  };
}
