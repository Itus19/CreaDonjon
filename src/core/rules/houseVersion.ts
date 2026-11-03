import { z } from "zod";
import { ENTRY_TYPES } from "../schemas/rule-blocks/entry-types";

/**
 * V3.1-94 (ADR 0072) — La « version maison » d'une règle officielle : une
 * COPIE complète de la fiche, sous la MÊME clé, dans la variante active
 * (surcharge `replace_entry`, déjà prévue par le schéma, SCHEMA.md §9.4).
 * Elle remplace l'officielle partout dans le monde (fiches, renvois,
 * assistant) ; la base officielle n'est jamais touchée (règle 18).
 */

/** Les cinq types qui ont un formulaire « Créer un/une… » : on ne copie que ce qu'on sait ensuite modifier (V3.1-2). */
export const EDITABLE_HOMEBREW_TYPES = ["spell", "subclass", "feature", "background", "weapon"] as const;

export function isEditableHomebrewType(entryType: string): boolean {
  return (EDITABLE_HOMEBREW_TYPES as readonly string[]).includes(entryType);
}

const zHouseBlock = z.object({
  block_type: z.string().min(1),
  display: z.unknown(),
  data: z.unknown(),
  display_order: z.number(),
});

/** Charge utile d'une surcharge `replace_entry` écrite par « Créer une version maison » : l'entrée complète, et son nom (une copie n'a pas de table de traduction). */
export const zHouseVersionPayload = z.object({
  entry_key: z.string().min(1),
  entry_type: z.enum(ENTRY_TYPES),
  name: z.string().trim().min(1),
  parent_class_key: z.string().optional(),
  blocks: z.array(zHouseBlock),
});
export type HouseVersionPayload = z.infer<typeof zHouseVersionPayload>;

function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, stable((v as Record<string, unknown>)[k])]));
  return v;
}

/**
 * Les types de blocs où la version maison diffère de l'officielle (donnée
 * changée, bloc ajouté ou retiré) : ce sont eux qui portent « Modifiée dans
 * ta variante » et la bascule Officiel / Ta variante, qui ne fait que LIRE.
 */
export function houseVersionChangedBlocks(
  official: readonly { block_type: string; data: unknown }[],
  house: readonly { block_type: string; data: unknown }[]
): string[] {
  const avant = new Map(official.map((b) => [b.block_type, JSON.stringify(stable(b.data))]));
  const apres = new Map(house.map((b) => [b.block_type, JSON.stringify(stable(b.data))]));
  const types = new Set([...avant.keys(), ...apres.keys()]);
  return [...types].filter((t) => avant.get(t) !== apres.get(t));
}
