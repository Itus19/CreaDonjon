import { z } from "zod";

/**
 * V3-B5 — « Le moteur demande un jet, il ne le lance pas. » Ce que la barre
 * d'intention pose AVANT tout dé : le personnage sait ce qu'on lui demande,
 * jamais le résultat. Au plus une par personnage (`.nullable()`, jamais un
 * tableau) — une nouvelle intention remplace la précédente, elle ne s'y
 * empile pas.
 *
 * `modifier`/`chips`/`what`/`dc` sont déjà calculés au moment de la pose :
 * le chemin « annoncé à la main » ou « volet de dés » n'a plus qu'à ajouter
 * un nombre nu à `modifier`, jamais à relire la fiche une seconde fois — et
 * la fiche a pu changer entre la pose et la réponse (un +1 tiré, un
 * désavantage gagné), donc ce qui a été PROMIS au joueur au moment de la
 * demande est ce qui doit compter, pas ce que la fiche dit maintenant.
 */
export const PENDING_REQUEST_KINDS = ["weapon_attack", "weapon_damage", "skill_check", "ability_check", "saving_throw"] as const;
export type PendingRequestKind = (typeof PENDING_REQUEST_KINDS)[number];

export const zPendingRequest = z.object({
  kind: z.enum(PENDING_REQUEST_KINDS),
  /** id d'objet d'inventaire pour une arme, clé de compétence/caractéristique sinon — même `action_id` que `IntentChoice`. */
  action_id: z.string().min(1),
  target_id: z.string().nullable(),
  target_label: z.string().nullable(),
  advantage: z.enum(["normal", "advantage", "disadvantage"]),
  dc: z.number().int().nullable(),
  /**
   * Borne haute du nombre nu attendu : 20 pour un d20 (attaque, test,
   * sauvegarde) — mais des dégâts se lisent sur le dé de L'ARME, jamais un
   * d20. Une épée courte (1d6) plafonne à 6, doublé (dés du critique
   * comptés deux fois, jamais le modificateur — même règle qu'`action.ts`)
   * si `critical` est vrai. Fixé à la pose, comme `modifier`.
   */
  die_max: z.number().int().min(1),
  /** Somme déjà calculée des `chips` — c'est ce qu'un résultat nu (volet, à la main) doit recevoir en plus du dé. */
  modifier: z.number().int(),
  /** Le détail des sources du modificateur, pour le rejournaliser avec le jet une fois encaissé — jamais recalculé depuis la fiche à ce moment-là. */
  chips: z.array(z.object({ label: z.string(), value: z.number() })),
  /** Libellé humain de ce qui est demandé — « Attaque — épée longue », « Sauvegarde de Constitution ». */
  what: z.string().min(1),
  /** V3-B2 : quel intent.text a posé cette demande, pour le fait final ("Perrin attaque..."). */
  actor_name: z.string().min(1),
  player_action_text: z.string(),
  /** Vrai seulement pour une demande de DÉGÂTS posée après une attaque qui a touché en critique — double les dés au moment d'encaisser. */
  critical: z.boolean(),
});
export type PendingRequest = z.infer<typeof zPendingRequest>;

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
  /** V3-B5 — `.default(null)`, même raison que `inspiration` : toutes les lignes déjà en base ont été écrites sans ce champ, aucune migration SQL. */
  pending_request: zPendingRequest.nullable().default(null),
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
    pending_request: null,
    death_saves: { success: 0, fail: 0 },
    attuned: [],
  };
}
