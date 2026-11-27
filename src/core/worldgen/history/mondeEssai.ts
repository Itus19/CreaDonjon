import type { AbstractWorld } from "../world";

/**
 * Le monde de test de la couche 1 (specs/generation-du-monde.md §9) : cinq
 * villes, deux États et une ville libre, une guerre imposée. Écrit à la main
 * sur le modèle d'un export d'Azgaar (§8.1), pour lire une chronique où l'on
 * comprend chaque événement. Ce n'est pas du contenu de jeu : c'est une
 * donnée de test, utilisée par les tests et par `npm run apercu:histoire`.
 */
const temperate = "temperate_deciduous_forest" as const;

export const MONDE_ESSAI: AbstractWorld = {
  __v: 1,
  seed: 936_788_045,
  presentYear: 354,
  cultures: [
    { id: "c-grane", name: "Granois" },
    { id: "c-vrie", name: "Vriens" },
  ],
  states: [
    { id: "s-grania", name: "Grania", cultureId: "c-grane", capitalSiteId: "v-hornver" },
    { id: "s-vriia", name: "Vriia", cultureId: "c-vrie", capitalSiteId: "v-ostral" },
  ],
  sites: [
    {
      id: "v-hornver",
      name: "Hornver",
      stateId: "s-grania",
      cultureId: "c-grane",
      notable: true,
      settlement: { __v: 1, seed: 1, population: 48_739, zone: "capitale", wealth: "reputee", biome: temperate, peoples: [], trades: [] },
    },
    {
      id: "v-berton",
      name: "Berton",
      stateId: "s-grania",
      cultureId: "c-grane",
      notable: true,
      settlement: { __v: 1, seed: 2, population: 6_200, zone: "ville", wealth: "correcte", biome: temperate, peoples: [], trades: [] },
    },
    {
      id: "v-ostral",
      name: "Ostral",
      stateId: "s-vriia",
      cultureId: "c-vrie",
      notable: true,
      settlement: { __v: 1, seed: 3, population: 21_400, zone: "capitale", wealth: "correcte", biome: "grassland", peoples: [], trades: [] },
    },
    {
      id: "v-pellemont",
      name: "Pellemont",
      stateId: "s-vriia",
      cultureId: "c-vrie",
      notable: false,
      settlement: { __v: 1, seed: 4, population: 900, zone: "bourg", wealth: "modeste", biome: "grassland", peoples: [], trades: [] },
    },
    {
      id: "v-gue-sale",
      name: "Gué-Salé",
      stateId: null,
      cultureId: null,
      notable: false,
      settlement: { __v: 1, seed: 5, population: 450, zone: "bourg", wealth: "modeste", biome: "wetland", peoples: [], trades: [] },
    },
  ],
  links: [
    { a: "v-hornver", b: "v-berton", distanceKm: 60, kind: "road" },
    { a: "v-berton", b: "v-pellemont", distanceKm: 85, kind: "trail" },
    { a: "v-pellemont", b: "v-ostral", distanceKm: 40, kind: "road" },
    { a: "v-ostral", b: "v-gue-sale", distanceKm: 70, kind: "trail" },
  ],
  anchors: [
    { type: "war", id: "a-1", name: "Guerre de la Frontière", startYear: 349, endYear: 351, attackers: ["s-vriia"], defenders: ["s-grania"] },
  ],
};
