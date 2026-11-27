import type { StatblockBlockData } from "../schemas/blocks/statblock";
import type { InventoryBlockData } from "../schemas/blocks/inventory";
import type { BlockAbility } from "../schemas/blocks/abilities";
import type { BlockReference } from "../schemas/blocks/reference";

/**
 * V3.2-49 (ADR 0118) — Les facettes d'un PNJ et la vue joueur.
 *
 * Une facette est un détail qu'on découvre séparément : une caractéristique
 * (`ability:str`), la CA (`ac`), les PV (`hp`), la vitesse (`speed`), une
 * action ou un trait par son rang (`action:0`, `trait:1`), un objet par son
 * identifiant (`item:pnj-1`), la bourse (`purse`).
 *
 * La vue joueur se CONSTRUIT à partir des facettes découvertes, champ par
 * champ, plutôt que de retirer ce qui est caché : un champ ajouté plus tard
 * au bloc ne peut pas fuir par oubli (règle absolue 5).
 */

const ABILITY_KEYS: readonly BlockAbility[] = ["str", "dex", "con", "int", "wis", "cha"];
const FACET_PATTERN = /^(?:ac|hp|speed|purse|ability:(?:str|dex|con|int|wis|cha)|(?:action|trait):\d{1,3}|item:[A-Za-z0-9_-]{1,64})$/;

export function isFacetKey(value: string): boolean {
  return FACET_PATTERN.test(value);
}

export interface PlayerStatblockView {
  abilities: Partial<Record<BlockAbility, number>>;
  ac?: number;
  hp?: number;
  speed?: string;
  actions: { name: string; text: string }[];
  traits: { name: string; text: string }[];
}

export function playerViewOfStatblock(data: StatblockBlockData, known: ReadonlySet<string>): PlayerStatblockView {
  const abilities: Partial<Record<BlockAbility, number>> = {};
  for (const ability of ABILITY_KEYS) if (known.has(`ability:${ability}`)) abilities[ability] = data.abilities[ability];
  const view: PlayerStatblockView = {
    abilities,
    actions: data.actions.filter((_, i) => known.has(`action:${i}`)).map((a) => ({ name: a.name, text: a.text })),
    traits: data.traits.filter((_, i) => known.has(`trait:${i}`)).map((t) => ({ name: t.name, text: t.text })),
  };
  if (known.has("ac")) view.ac = data.ac.value;
  if (known.has("hp")) view.hp = data.hp.value;
  if (known.has("speed")) view.speed = data.speed;
  return view;
}

/** Un objet vu : ni notes, ni drapeau « caché », ni poids saisi à la main. */
export type PlayerItemView = { id: string; qty: number; equipped: boolean } & ({ ref: BlockReference } | { label: string });

export interface PlayerInventoryView {
  items: PlayerItemView[];
  currency?: InventoryBlockData["currency"];
}

export function playerViewOfInventory(data: InventoryBlockData, known: ReadonlySet<string>): PlayerInventoryView {
  const items: PlayerItemView[] = data.items
    .filter((item) => known.has(`item:${item.id}`))
    .map((item) => {
      const common = { id: item.id, qty: item.qty, equipped: item.equipped === true };
      return "ref" in item ? { ...common, ref: item.ref } : { ...common, label: item.label };
    });
  return known.has("purse") ? { items, currency: data.currency } : { items };
}

/** Les facettes qu'on découvre en voyant le PNJ : ce qu'il porte sans le cacher. */
export function seenAtAGlance(data: InventoryBlockData): string[] {
  return data.items.filter((item) => item.equipped === true && item.concealed !== true).map((item) => `item:${item.id}`);
}
