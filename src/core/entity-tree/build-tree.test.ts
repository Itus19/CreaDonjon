import { describe, expect, it } from "vitest";
import { buildEntityTree } from "./build-tree";

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
});
