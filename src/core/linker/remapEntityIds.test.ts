import { describe, expect, it } from "vitest";
import { remapEntityIds } from "./remapEntityIds";

describe("remapEntityIds", () => {
  const idMap = new Map([["old-1", "new-1"]]);

  it("reecrit un ref d'entite trouve en profondeur, quelle que soit la forme englobante", () => {
    const data = {
      items: [{ id: "i1", ref: { kind: "entity", id: "old-1" }, qty: 1 }],
      segments: [{ content: [{ t: "ref", kind: "entity", id: "old-1", label: "X" }] }],
    };
    const result = remapEntityIds(data, idMap) as typeof data;
    expect(result.items[0].ref).toEqual({ kind: "entity", id: "new-1" });
    expect(result.segments[0].content[0]).toEqual({ t: "ref", kind: "entity", id: "new-1", label: "X" });
  });

  it("laisse intact un ref d'entite absent de la table de correspondance", () => {
    const data = { ref: { kind: "entity", id: "inconnu" } };
    expect(remapEntityIds(data, idMap)).toEqual(data);
  });

  it("ignore un ref de regle (kind different), meme s'il porte un id present dans la table", () => {
    const data = { ref: { kind: "rule", id: "old-1" } };
    expect(remapEntityIds(data, idMap)).toEqual(data);
  });

  it("laisse passer les valeurs scalaires et null sans erreur", () => {
    expect(remapEntityIds(null, idMap)).toBeNull();
    expect(remapEntityIds(42, idMap)).toBe(42);
    expect(remapEntityIds("old-1", idMap)).toBe("old-1"); // une chaine nue n'est jamais une reference
  });
});
