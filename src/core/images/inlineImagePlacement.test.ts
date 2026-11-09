import { describe, expect, it } from "vitest";
import { placeImageInText, textHostOf } from "./inlineImagePlacement";
import type { Segment } from "../schemas/entities/segments";
import type { TextBlockData } from "../schemas/blocks/text";

const vis = { level: "public" as const, scopeId: null };
const p = (id: string, content: Segment["content"]): Segment => ({ id, blockType: "paragraph", visibility: vis, content, align: "left" });
const trait = (id: string): Segment => ({ id, blockType: "divider", visibility: vis, content: [], align: "left" });
const texte = (id: string, segments: Segment[]) => ({ id, data: { __v: 1 as const, segments, dropCap: false } satisfies TextBlockData });
const mot = (v: string) => ({ t: "text" as const, v });
const img = (blockId: string) => ({ t: "image" as const, blockId });

describe("textHostOf", () => {
  it("rend le bloc texte qui cite l'image, ou null", () => {
    const blocs = [texte("t1", [p("s1", [mot("a")])]), texte("t2", [p("s2", [mot("b"), img("i1")])])];
    expect(textHostOf(blocs, "i1")).toBe("t2");
    expect(textHostOf(blocs, "i9")).toBeNull();
  });
});

describe("placeImageInText", () => {
  it("pose l'image en tete du premier paragraphe du bloc choisi", () => {
    const blocs = [texte("t1", [p("s1", [mot("Bonjour")])])];
    expect(placeImageInText(blocs, "i1", "t1", "neuf")).toEqual([texte("t1", [p("s1", [img("i1"), mot("Bonjour")])])]);
  });

  it("saute un trait de separation en tete", () => {
    const blocs = [texte("t1", [trait("d"), p("s1", [mot("x")])])];
    expect(placeImageInText(blocs, "i1", "t1", "neuf")[0].data.segments[1].content[0]).toEqual(img("i1"));
  });

  it("cree un paragraphe quand le bloc n'en a aucun", () => {
    const blocs = [texte("t1", [])];
    expect(placeImageInText(blocs, "i1", "t1", "neuf")).toEqual([texte("t1", [p("neuf", [img("i1")])])]);
  });

  it("deplace l'image d'un bloc texte a l'autre, sans la dupliquer", () => {
    const blocs = [texte("t1", [p("s1", [mot("a "), img("i1"), mot(" b")])]), texte("t2", [p("s2", [mot("c")])])];
    const changes = placeImageInText(blocs, "i1", "t2", "neuf");
    expect(changes).toEqual([texte("t1", [p("s1", [mot("a "), mot(" b")])]), texte("t2", [p("s2", [img("i1"), mot("c")])])]);
  });

  it("retire l'image du texte quand aucun bloc n'est choisi ; un paragraphe vide disparait", () => {
    const blocs = [texte("t1", [p("s1", [mot("a")]), p("s2", [img("i1")])])];
    expect(placeImageInText(blocs, "i1", null, "neuf")).toEqual([texte("t1", [p("s1", [mot("a")])])]);
  });

  it("ne rend rien quand l'image est deja dans le bloc choisi", () => {
    const blocs = [texte("t1", [p("s1", [mot("a "), img("i1")])])];
    expect(placeImageInText(blocs, "i1", "t1", "neuf")).toEqual([]);
  });
});
