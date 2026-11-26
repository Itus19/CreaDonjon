import { describe, expect, it } from "vitest";
import { paragraphesDe, secretsEntre } from "./secretsMj";
import type { SegmentLu } from "@/src/core/entities/premierePhrase";

const p = (v: string): SegmentLu => ({ blockType: "paragraph", content: [{ t: "text", v }] });

describe("secrets du MJ (ADR 0116)", () => {
  it("garde les paragraphes non vides, en texte brut", () => {
    expect(paragraphesDe([p("  Aubergiste   du Fanal. "), p(""), { blockType: "divider", content: [] }])).toEqual(["Aubergiste du Fanal."]);
  });

  it("le secret est ce que le MJ lit et que le joueur ne lit pas", () => {
    expect(secretsEntre(["Aubergiste du Fanal.", "Elle cache un frère recherché."], ["Aubergiste du Fanal."])).toBe("Elle cache un frère recherché.");
  });

  it("rien de caché : aucun secret", () => {
    expect(secretsEntre(["Aubergiste du Fanal."], ["Aubergiste du Fanal."])).toBeNull();
  });

  it("borné, coupé au mot", () => {
    const s = secretsEntre(["un deux trois quatre cinq"], [], 12);
    expect(s).toBe("un deux…");
  });
});
