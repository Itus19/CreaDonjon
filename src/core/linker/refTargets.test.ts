import { describe, expect, it } from "vitest";
import { collectRefTargetIds } from "./refTargets";
import type { Segment } from "../schemas/entities/segments";

function segment(content: Segment["content"]): Segment {
  return { id: "s1", blockType: "paragraph", visibility: { level: "public", scopeId: null }, content, align: "left" };
}

describe("collectRefTargetIds", () => {
  it("collecte les id d'entite et les cles de regle, deduplique", () => {
    const segments: Segment[] = [
      segment([
        { t: "text", v: "Fine est une " },
        { t: "ref", kind: "rule", key: "tiefling", label: "tieffeline" },
        { t: "text", v: " qui connaît " },
        { t: "ref", kind: "entity", id: "ent1", label: "Bram" },
      ]),
      segment([{ t: "ref", kind: "entity", id: "ent1", label: "Bram" }]),
    ];
    expect(collectRefTargetIds(segments)).toEqual({ entityIds: ["ent1"], ruleKeys: ["tiefling"] });
  });

  it("ignore les noeuds texte et les ref sans id/key", () => {
    const segments: Segment[] = [segment([{ t: "text", v: "rien à lier" }])];
    expect(collectRefTargetIds(segments)).toEqual({ entityIds: [], ruleKeys: [] });
  });

  it("liste vide sans segments", () => {
    expect(collectRefTargetIds([])).toEqual({ entityIds: [], ruleKeys: [] });
  });
});
