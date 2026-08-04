import { describe, expect, it } from "vitest";
import { diffEntitySnapshots } from "./diff";
import type { EntitySnapshot } from "./types";

function block(overrides: Partial<EntitySnapshot["blocks"][number]> = {}): EntitySnapshot["blocks"][number] {
  return {
    id: "block-1",
    blockType: "text",
    display: { label: "Description", layout: "prose" },
    data: { text: "..." },
    displayOrder: 1000,
    visibilityLevel: "players",
    visibilityScopeId: null,
    createdBy: "user-1",
    ...overrides,
  };
}

function snapshot(overrides: Partial<EntitySnapshot> = {}): EntitySnapshot {
  return {
    entity: { name: "Bram", entityKind: "character", aliases: [] },
    blocks: [],
    ...overrides,
  };
}

describe("diffEntitySnapshots", () => {
  it("ne rapporte aucun changement entre deux instantanes identiques", () => {
    const a = snapshot({ blocks: [block()] });
    const b = snapshot({ blocks: [block()] });
    expect(diffEntitySnapshots(a, b)).toEqual({ entityChanges: [], blocks: [] });
  });

  it("detecte un changement de nom", () => {
    const a = snapshot({ entity: { name: "Bram", entityKind: "character", aliases: [] } });
    const b = snapshot({ entity: { name: "Bram le Tavernier", entityKind: "character", aliases: [] } });
    expect(diffEntitySnapshots(a, b).entityChanges).toEqual([
      { field: "name", before: "Bram", after: "Bram le Tavernier" },
    ]);
  });

  it("detecte un changement de type d'entite", () => {
    const a = snapshot({ entity: { name: "Bram", entityKind: "character", aliases: [] } });
    const b = snapshot({ entity: { name: "Bram", entityKind: "npc", aliases: [] } });
    expect(diffEntitySnapshots(a, b).entityChanges).toEqual([
      { field: "entityKind", before: "character", after: "npc" },
    ]);
  });

  it("detecte un changement d'alias, insensible a l'ordre", () => {
    const a = snapshot({ entity: { name: "Bram", entityKind: "character", aliases: ["Le Tavernier", "Bram"] } });
    const b = snapshot({ entity: { name: "Bram", entityKind: "character", aliases: ["Bram", "Le Tavernier"] } });
    expect(diffEntitySnapshots(a, b).entityChanges).toEqual([]);

    const c = snapshot({ entity: { name: "Bram", entityKind: "character", aliases: ["Bram"] } });
    expect(diffEntitySnapshots(a, c).entityChanges).toEqual([
      { field: "aliases", before: ["Le Tavernier", "Bram"], after: ["Bram"] },
    ]);
  });

  it("marque un bloc present uniquement dans le second instantane comme ajoute", () => {
    const a = snapshot({ blocks: [] });
    const b = snapshot({ blocks: [block({ id: "block-2" })] });
    expect(diffEntitySnapshots(a, b).blocks).toEqual([
      { id: "block-2", status: "added", blockType: "text", label: "Description" },
    ]);
  });

  it("marque un bloc present uniquement dans le premier instantane comme supprime", () => {
    const a = snapshot({ blocks: [block({ id: "block-3" })] });
    const b = snapshot({ blocks: [] });
    expect(diffEntitySnapshots(a, b).blocks).toEqual([
      { id: "block-3", status: "removed", blockType: "text", label: "Description" },
    ]);
  });

  it("marque un bloc present dans les deux mais dont le contenu differe comme modifie", () => {
    const a = snapshot({ blocks: [block({ data: { text: "avant" } })] });
    const b = snapshot({ blocks: [block({ data: { text: "apres" } })] });
    expect(diffEntitySnapshots(a, b).blocks).toEqual([
      { id: "block-1", status: "changed", blockType: "text", label: "Description" },
    ]);
  });

  it("un bloc dont seule la visibilite change est aussi rapporte modifie", () => {
    const a = snapshot({ blocks: [block({ visibilityLevel: "players" })] });
    const b = snapshot({ blocks: [block({ visibilityLevel: "gm" })] });
    expect(diffEntitySnapshots(a, b).blocks).toEqual([
      { id: "block-1", status: "changed", blockType: "text", label: "Description" },
    ]);
  });

  it("ignore l'ordre d'affichage seul (reordonnancement pur, non redactionnel)", () => {
    const a = snapshot({ blocks: [block({ displayOrder: 1000 })] });
    const b = snapshot({ blocks: [block({ displayOrder: 2000 })] });
    expect(diffEntitySnapshots(a, b).blocks).toEqual([]);
  });
});
