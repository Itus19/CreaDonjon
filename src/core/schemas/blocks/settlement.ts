import { z } from "zod";
import { BIOMES } from "../../worldgen/biomes";
import { zSettlementClimate } from "../../weather/climate";

/**
 * Bloc `settlement` : une ville décrite par ses agrégats, pas par ses
 * habitants (ADR 0104 §3, ADR 0109 décision G1, specs/generation-du-monde.md
 * §4.1). Posé sur l'entité du lieu ; aucune table nouvelle.
 *
 * Pas encore dans le registre des blocs (`registry.ts`) : son éditeur et sa
 * vue publique viennent au ticket G-3. Le noyau (`materializeOccupants`)
 * s'en sert déjà.
 *
 * `zone` et `wealth` reprennent les clés des axes « Zone » et « Richesse »
 * des générateurs Taverne et Échoppe (`src/core/generators/tools.ts`) : une
 * ville et son auberge parlent la même langue. `zone` n'est pas dérivé de
 * `population` (une capitale est un fait politique, pas un seuil) : les deux
 * sont saisis, ce qui respecte la règle absolue 16.
 */
export const SETTLEMENT_ZONES = ["bourg", "ville", "capitale"] as const;
export type SettlementZone = (typeof SETTLEMENT_ZONES)[number];

export const SETTLEMENT_WEALTH = ["modeste", "correcte", "reputee"] as const;
export type SettlementWealth = (typeof SETTLEMENT_WEALTH)[number];

/** Un peuple ou un métier et son poids relatif dans la ville. */
export const zSettlementShare = z.object({
  key: z.string().trim().min(1).max(64),
  share: z.number().int().min(1).max(1000),
});
export type SettlementShare = z.infer<typeof zSettlementShare>;

function uniqueKeys(list: readonly SettlementShare[]): boolean {
  return new Set(list.map((s) => s.key)).size === list.length;
}

export const zSettlementBlockData = z.object({
  __v: z.literal(1),
  seed: z.number().int().min(0).max(0xffffffff),
  population: z.number().int().min(0).max(10_000_000),
  zone: z.enum(SETTLEMENT_ZONES),
  wealth: z.enum(SETTLEMENT_WEALTH),
  biome: z.enum(BIOMES),
  /** ME-2 (specs/meteo.md §3.1) : le climat importé de la carte de CE monde ; ce qui manque vient du biome. Facultatif, donc sans changement de version. */
  climate: zSettlementClimate.optional(),
  peoples: z.array(zSettlementShare).max(32).refine(uniqueKeys, "Un peuple apparaît deux fois").default([]),
  trades: z.array(zSettlementShare).max(64).refine(uniqueKeys, "Un métier apparaît deux fois").default([]),
  /**
   * G-7b : la ville de la carte dont cette page est née, pour un monde créé
   * depuis Azgaar (bloc `generated_world`). Absent pour une ville écrite à la main.
   */
  siteId: z.string().trim().min(1).max(64).optional(),
});
export type SettlementBlockData = z.infer<typeof zSettlementBlockData>;
