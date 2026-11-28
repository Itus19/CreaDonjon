import { describe, expect, it } from "vitest";
import { describeKnowledge, factsToShare, rumourClaim, visibleFacetsAtSight, type KnowledgeFact } from "./npcKnowledge";

const epee: KnowledgeFact = { knowerId: "mabelle", facet: "item:pj-1", claim: "Épée longue", isTrue: true, source: "observation", toldById: null };
const force: KnowledgeFact = { knowerId: "mabelle", facet: "ability:str", claim: "Force 16 (+3)", isTrue: true, source: "observation", toldById: null };
const rumeur: KnowledgeFact = { knowerId: "bram", facet: null, claim: "il est recherché à Port-Brume", isTrue: false, source: "rumour", toldById: null };
const noms = (id: string) => ({ mabelle: "Mabelle", bram: "Bram", ilsa: "Ilsa" })[id] ?? id;

describe("V3.2-80 — ce que les PNJ savent du personnage", () => {
  it("au premier regard, un PNJ voit ce que le personnage porte à découvert, pas ce qu'il cache ni ce qui reste au sac", () => {
    const sac = { items: [{ id: "pj-1", equipped: true }, { id: "pj-2", equipped: true, concealed: true, conceal_dc: 14 }, { id: "pj-3", equipped: false }] };
    expect(visibleFacetsAtSight(sac)).toEqual(["item:pj-1"]);
    expect(visibleFacetsAtSight(null)).toEqual([]);
  });

  it("Mabelle dit à Ilsa ce qu'elle sait : Ilsa le tient d'elle, vrai comme faux", () => {
    expect(factsToShare([epee, force], [], "ilsa")).toEqual([
      { ...epee, knowerId: "ilsa", source: "told", toldById: "mabelle" },
      { ...force, knowerId: "ilsa", source: "told", toldById: "mabelle" },
    ]);
    expect(factsToShare([rumeur], [], "ilsa")).toEqual([{ ...rumeur, knowerId: "ilsa", source: "told", toldById: "bram" }]);
  });

  it("ce qu'Ilsa sait déjà ne se répète pas", () => {
    const dejaVu = { ...epee, knowerId: "ilsa" };
    expect(factsToShare([epee, force], [dejaVu], "ilsa").map((f) => f.facet)).toEqual(["ability:str"]);
    expect(factsToShare([rumeur], [{ ...rumeur, knowerId: "ilsa" }], "ilsa")).toEqual([]);
  });

  it("une rumeur : une phrase, ni vide ni fleuve", () => {
    expect(rumourClaim("  il   est recherché  ")).toBe("il est recherché");
    expect(rumourClaim("   ")).toBeNull();
    expect(rumourClaim("x".repeat(301))).toBeNull();
  });

  it("pour le MJ : ce qui est vrai, ce qu'il croit à tort, et de qui il le tient", () => {
    expect(describeKnowledge([epee, force], noms)).toBe("sait : Épée longue ; Force 16 (+3).");
    expect(describeKnowledge([{ ...rumeur, knowerId: "ilsa", source: "told", toldById: "bram" }], noms)).toBe("croit à tort : « il est recherché à Port-Brume » (tenu de Bram).");
    expect(describeKnowledge([], noms)).toBeNull();
  });
});
