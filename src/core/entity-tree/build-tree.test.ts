import { describe, expect, it } from "vitest";
import { buildEntityTree, filterEntityTree } from "./build-tree";

describe("buildEntityTree", () => {
  it("groupe par entity_kind", () => {
    const entities = [
      { id: "1", name: "Bram", slug: "bram", entity_kind: "character" },
      { id: "2", name: "L'Ancre", slug: "l-ancre", entity_kind: "location" },
    ];
    const groups = buildEntityTree(entities, []);
    expect(groups.map((g) => g.kind)).toEqual(["character", "location"]);
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].items[0].name).toBe("Bram");
  });

  it("imbrique par part_of a l'interieur d'un meme groupe (source = enfant, cible = parent)", () => {
    const entities = [
      { id: "valdoria", name: "Valdoria", slug: "valdoria", entity_kind: "location" },
      { id: "ancre", name: "L'Ancre", slug: "l-ancre", entity_kind: "location" },
    ];
    const edges = [{ source_entity_id: "ancre", target_entity_id: "valdoria" }];
    const groups = buildEntityTree(entities, edges);
    const locationGroup = groups.find((g) => g.kind === "location")!;
    expect(locationGroup.items).toHaveLength(1);
    expect(locationGroup.items[0].id).toBe("valdoria");
    expect(locationGroup.items[0].children).toHaveLength(1);
    expect(locationGroup.items[0].children[0].id).toBe("ancre");
  });

  it("n'imbrique pas une arete part_of qui traverse deux groupes differents", () => {
    const entities = [
      { id: "faction1", name: "La Main", slug: "la-main", entity_kind: "faction" },
      { id: "loc1", name: "Repaire", slug: "repaire", entity_kind: "location" },
    ];
    // arete artificielle inter-groupes, ne devrait jamais arriver en
    // pratique (part_of est spatial) mais ne doit pas planter le rendu.
    const edges = [{ source_entity_id: "loc1", target_entity_id: "faction1" }];
    const groups = buildEntityTree(entities, edges);
    const locationGroup = groups.find((g) => g.kind === "location")!;
    expect(locationGroup.items).toHaveLength(1);
    expect(locationGroup.items[0].id).toBe("loc1");
    expect(locationGroup.items[0].children).toHaveLength(0);
  });

  it("trie les groupes par nom de kind", () => {
    const entities = [
      { id: "1", name: "A", slug: "a", entity_kind: "location" },
      { id: "2", name: "B", slug: "b", entity_kind: "character" },
    ];
    const groups = buildEntityTree(entities, []);
    expect(groups.map((g) => g.kind)).toEqual(["character", "location"]);
  });

  it("renvoie une liste vide pour un monde sans entite", () => {
    expect(buildEntityTree([], [])).toEqual([]);
  });

  it("trie les fiches d'un groupe par nom, quel que soit display_order (V2, retour utilisateur : faciliter la recherche)", () => {
    const entities = [
      { id: "1", name: "Zed", slug: "zed", entity_kind: "character", display_order: 1000 },
      { id: "2", name: "Anna", slug: "anna", entity_kind: "character", display_order: 3000 },
      { id: "3", name: "Bram", slug: "bram", entity_kind: "character", display_order: 2000 },
    ];
    const groups = buildEntityTree(entities, []);
    expect(groups[0].items.map((i) => i.name)).toEqual(["Anna", "Bram", "Zed"]);
  });

  it("display_order absent (fiches historiques) : ne plante pas, tri alphabetique quand meme", () => {
    const entities = [
      { id: "1", name: "Bram", slug: "bram", entity_kind: "character" },
      { id: "2", name: "Anna", slug: "anna", entity_kind: "character" },
    ];
    const groups = buildEntityTree(entities, []);
    expect(groups[0].items.map((i) => i.name)).toEqual(["Anna", "Bram"]);
  });

  it("kindOrder : place les groupes connus dans l'ordre donne, les inconnus ensuite par ordre alphabetique", () => {
    const entities = [
      { id: "1", name: "A", slug: "a", entity_kind: "location", display_order: 0 },
      { id: "2", name: "B", slug: "b", entity_kind: "character", display_order: 0 },
      { id: "3", name: "C", slug: "c", entity_kind: "faction", display_order: 0 },
      { id: "4", name: "D", slug: "d", entity_kind: "item", display_order: 0 },
    ];
    const groups = buildEntityTree(entities, [], ["faction", "character"]);
    expect(groups.map((g) => g.kind)).toEqual(["faction", "character", "item", "location"]);
  });

  it("kindOrder vide : comportement alphabetique actuel inchange", () => {
    const entities = [
      { id: "1", name: "A", slug: "a", entity_kind: "location", display_order: 0 },
      { id: "2", name: "B", slug: "b", entity_kind: "character", display_order: 0 },
    ];
    const groups = buildEntityTree(entities, [], []);
    expect(groups.map((g) => g.kind)).toEqual(["character", "location"]);
  });
});

describe("filterEntityTree", () => {
  const entities = [
    { id: "valdoria", name: "Valdoria", slug: "valdoria", entity_kind: "location" },
    { id: "ancre", name: "L'Ancre Rouillée", slug: "l-ancre", entity_kind: "location" },
    { id: "bram", name: "Bram", slug: "bram", entity_kind: "character" },
  ];
  const edges = [{ source_entity_id: "ancre", target_entity_id: "valdoria" }];
  const groups = buildEntityTree(entities, edges);

  it("requete vide renvoie l'arbre tel quel", () => {
    expect(filterEntityTree(groups, "")).toBe(groups);
  });

  it("insensible a la casse et aux sous-chaines", () => {
    const filtered = filterEntityTree(groups, "bram");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].items[0].name).toBe("Bram");
  });

  it("un enfant correspondant garde son parent visible, avec seulement les enfants correspondants", () => {
    const filtered = filterEntityTree(groups, "rouillée");
    const locationGroup = filtered.find((g) => g.kind === "location")!;
    expect(locationGroup.items).toHaveLength(1);
    expect(locationGroup.items[0].name).toBe("Valdoria");
    expect(locationGroup.items[0].children).toHaveLength(1);
    expect(locationGroup.items[0].children[0].name).toBe("L'Ancre Rouillée");
  });

  it("un parent correspondant garde tous ses enfants, meme non-correspondants", () => {
    const filtered = filterEntityTree(groups, "valdoria");
    const locationGroup = filtered.find((g) => g.kind === "location")!;
    expect(locationGroup.items[0].children).toHaveLength(1);
  });

  it("aucune correspondance retire le groupe entier", () => {
    const filtered = filterEntityTree(groups, "zzz");
    expect(filtered).toEqual([]);
  });
});
