import { describe, expect, it } from "vitest";
import { zNarrativeContent, zSegment, zSegmentVisibility } from "./segments";

describe("zSegmentVisibility", () => {
  it("accepte public sans scopeId", () => {
    expect(zSegmentVisibility.parse({ level: "public", scopeId: null })).toEqual({
      level: "public",
      scopeId: null,
    });
  });

  it("accepte campaign avec un scopeId", () => {
    expect(zSegmentVisibility.parse({ level: "campaign", scopeId: "c1" })).toEqual({
      level: "campaign",
      scopeId: "c1",
    });
  });

  it("refuse campaign sans scopeId", () => {
    expect(() => zSegmentVisibility.parse({ level: "campaign", scopeId: null })).toThrow();
  });

  it("refuse public avec un scopeId", () => {
    expect(() => zSegmentVisibility.parse({ level: "public", scopeId: "c1" })).toThrow();
  });
});

describe("zSegment", () => {
  it("accepte un segment avec un noeud ref vers une entite (exemple SCHEMA.md §6)", () => {
    const segment = {
      id: "s1",
      blockType: "paragraph" as const,
      visibility: { level: "public", scopeId: null },
      content: [
        { t: "text", v: "Le tavernier de " },
        { t: "ref", kind: "entity", id: "ent_9b1c", label: "L'Ancre Rouillée" },
        { t: "text", v: " semble jovial et accueillant. " },
      ],
    };
    expect(zSegment.parse(segment)).toEqual(segment);
  });

  it("accepte un ref vers une regle par cle plutot que par id", () => {
    const segment = {
      id: "s2",
      blockType: "paragraph" as const,
      visibility: { level: "gm", scopeId: null },
      content: [{ t: "ref", kind: "rule", key: "persuasion", label: "Persuasion" }],
    };
    expect(zSegment.parse(segment)).toEqual(segment);
  });

  it("refuse un ref kind=rule sans key", () => {
    const segment = {
      id: "s3",
      blockType: "paragraph" as const,
      visibility: { level: "public", scopeId: null },
      content: [{ t: "ref", kind: "rule", label: "Persuasion" }],
    };
    expect(() => zSegment.parse(segment)).toThrow();
  });

  it("refuse un segment sans contenu", () => {
    expect(() =>
      zSegment.parse({
        id: "s4",
        blockType: "paragraph",
        visibility: { level: "public", scopeId: null },
        content: [],
      })
    ).toThrow();
  });

  it("refuse un type de noeud inconnu", () => {
    expect(() =>
      zSegment.parse({
        id: "s5",
        blockType: "paragraph",
        visibility: { level: "public", scopeId: null },
        content: [{ t: "underline", v: "x" }],
      })
    ).toThrow();
  });

  it("refuse un blockType inconnu", () => {
    expect(() =>
      zSegment.parse({
        id: "s6",
        blockType: "h5",
        visibility: { level: "public", scopeId: null },
        content: [{ t: "text", v: "x" }],
      })
    ).toThrow();
  });

  it("accepte un noeud texte avec des marques combinees (gras + italique)", () => {
    const segment = {
      id: "s7",
      blockType: "paragraph" as const,
      visibility: { level: "public", scopeId: null },
      content: [{ t: "text", v: "important", marks: ["bold", "italic"] }],
    };
    expect(zSegment.parse(segment)).toEqual(segment);
  });

  it("accepte un titre (h1-h4)", () => {
    const segment = {
      id: "s8",
      blockType: "h2" as const,
      visibility: { level: "public", scopeId: null },
      content: [{ t: "text", v: "Un titre" }],
    };
    expect(zSegment.parse(segment)).toEqual(segment);
  });
});

describe("zNarrativeContent", () => {
  it("accepte une liste vide de segments", () => {
    expect(zNarrativeContent.parse([])).toEqual([]);
  });
});
