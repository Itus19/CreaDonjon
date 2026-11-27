/** Un export Azgaar minuscule, de la même forme que le vrai (specs/generation-du-monde.md §8.1). Partagé par les tests. */
export function petiteCarte() {
  const cell = (i: number, biome: number, burg: number) => ({ i, biome, burg });
  return {
    info: { version: "1.159.0", seed: "936788045", mapName: "Essai", width: 100, height: 100 },
    settings: { populationRate: 1000, distanceScale: 4, options: { map: { lore: { calendar: { year: 355, era: "Ère d'essai" } } } } },
    pack: {
      cells: [cell(0, 0, 0), cell(1, 6, 1), cell(2, 6, 0), cell(3, 4, 2), cell(4, 12, 3), cell(5, 6, 4)],
      cultures: [
        { i: 0, name: "Wildlands" },
        { i: 1, name: "Granois" },
        { i: 2, name: "Vriens", removed: true },
      ],
      burgs: [
        0,
        { i: 1, name: "Hornver", cell: 1, x: 10, y: 10, state: 1, culture: 1, capital: 1, population: 48.739, group: "capital" },
        { i: 2, name: "Ostral", cell: 3, x: 40, y: 10, state: 2, culture: 1, capital: 1, population: 4.2, group: "town" },
        { i: 3, name: "Gué-Salé", cell: 4, x: 40, y: 40, state: 0, culture: 0, capital: 0, population: 0.45, group: "village" },
        { i: 4, name: "Ruine", cell: 5, x: 0, y: 0, state: 1, culture: 1, capital: 0, population: 1, removed: true },
      ],
      states: [
        { i: 0, name: "Neutrals" },
        { i: 1, name: "Grania", capital: 1, culture: 1 },
        { i: 2, name: "Vriia", capital: 2, culture: 2 },
        { i: 3, name: "Disparu", capital: 4, culture: 1, removed: true },
      ],
      routes: [
        { i: 0, group: "roads", points: [[10, 10, 1], [25, 10, 2], [40, 10, 3]] },
        { i: 1, group: "trails", points: [[40, 10, 3], [40, 40, 4]] },
        { i: 2, group: "searoutes", points: [[10, 10, 1], [40, 10, 3]] },
      ],
      events: [
        { i: 0, type: "war", name: "Guerre de la Frontière", start: "349", end: "351", attackers: [2], defenders: [1] },
        { i: 1, type: "war", name: "Guerre en cours", start: "354", attackers: [1], defenders: [2, 3] },
        { i: 2, type: "vassalage", name: "Vassalité", start: "330", suzerain: 1, vassal: 2 },
      ],
    },
  };
}
