/**
 * Les biomes d'un monde généré (specs/generation-du-monde.md §5, ADR 0109
 * décision G4) : la liste fermée d'Azgaar's Fantasy Map Generator, dans le
 * même ordre, pour que l'import de sa carte s'y branche sans table de
 * traduction. Identifiants techniques en anglais (règle absolue 15) ; les
 * libellés vivront dans `messages/` avec l'éditeur du bloc (ticket G-3).
 */
export const BIOMES = [
  "marine",
  "hot_desert",
  "cold_desert",
  "savanna",
  "grassland",
  "tropical_seasonal_forest",
  "temperate_deciduous_forest",
  "tropical_rainforest",
  "temperate_rainforest",
  "taiga",
  "tundra",
  "glacier",
  "wetland",
] as const;
export type Biome = (typeof BIOMES)[number];
