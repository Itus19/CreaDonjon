import type { RuntimeState } from "../schemas/runtimeState";

/**
 * Patch partiel (V1-B3, specs/wiki-blocs.md §4.5) : "une bascule ecrit le
 * plus petit fait possible". Les compteurs (hit_dice/resources/
 * spell_slots_used) et les sous-objets (hp/death_saves) se fusionnent cle
 * par cle ; les listes (conditions/attuned) se remplacent entierement —
 * une liste partielle n'a pas de sens ("juste ajouter une condition" se
 * fait en renvoyant la liste complete, calculee par l'appelant).
 */
export interface RuntimeStatePatch {
  hp?: Partial<RuntimeState["hp"]>;
  hit_dice?: Record<string, number>;
  exhaustion?: number;
  xp?: number;
  resources?: Record<string, number>;
  spell_slots_used?: Record<string, number>;
  conditions?: string[];
  death_saves?: Partial<RuntimeState["death_saves"]>;
  attuned?: string[];
}

export function mergeRuntimeState(current: RuntimeState, patch: RuntimeStatePatch): RuntimeState {
  return {
    hp: { ...current.hp, ...patch.hp },
    hit_dice: { ...current.hit_dice, ...patch.hit_dice },
    exhaustion: patch.exhaustion ?? current.exhaustion,
    xp: patch.xp ?? current.xp,
    resources: { ...current.resources, ...patch.resources },
    spell_slots_used: { ...current.spell_slots_used, ...patch.spell_slots_used },
    conditions: patch.conditions ?? current.conditions,
    death_saves: { ...current.death_saves, ...patch.death_saves },
    attuned: patch.attuned ?? current.attuned,
  };
}
