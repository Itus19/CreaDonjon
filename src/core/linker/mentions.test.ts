import { describe, expect, it } from "vitest";
import { extractMentionsFromSegments } from "./mentions";
import type { Segment } from "../schemas/entities/segments";

function segment(visibility: Segment["visibility"], content: Segment["content"]): Segment {
  return { id: "s1", blockType: "paragraph", visibility, content, align: "left" };
}

describe("extractMentionsFromSegments", () => {
  it("extrait une mention d'entite et une mention de regle", () => {
    const segments: Segment[] = [
      segment({ level: "public", scopeId: null }, [
        { t: "text", v: "Fine est une " },
        { t: "ref", kind: "rule", key: "tiefling", label: "tieffeline" },
        { t: "text", v: " qui connaît " },
        { t: "ref", kind: "entity", id: "ent1", label: "Bram" },
      ]),
    ];
    expect(extractMentionsFromSegments(segments)).toEqual([
      { targetKind: "rule", targetRuleKey: "tiefling", visibilityLevel: "public", visibilityScopeId: null },
      { targetKind: "entity", targetEntityId: "ent1", visibilityLevel: "public", visibilityScopeId: null },
    ]);
  });

  it("herite la visibilite du segment d'origine, pas une valeur par defaut", () => {
    const segments: Segment[] = [
      segment({ level: "gm", scopeId: null }, [{ t: "ref", kind: "entity", id: "secret1", label: "Le complot" }]),
    ];
    expect(extractMentionsFromSegments(segments)[0].visibilityLevel).toBe("gm");
  });

  it("liste vide sans noeud ref", () => {
    expect(extractMentionsFromSegments([segment({ level: "public", scopeId: null }, [{ t: "text", v: "rien" }])])).toEqual([]);
  });
});
