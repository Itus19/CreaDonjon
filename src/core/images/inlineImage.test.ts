import { describe, expect, it } from "vitest";
import { applyInlineImageVisibility, inlineImageIdsIn } from "./inlineImage";
import { planImageAnchors, type AnchorableBlock } from "./blockAnchor";

type Node = { t: "text"; v: string } | { t: "image"; blockId: string };

function seg(id: string, content: Node[], blockType = "paragraph") {
  return { id, blockType, visibility: { level: "public", scopeId: null }, content, align: "left" };
}

function texte(id: string, segments: ReturnType<typeof seg>[]): AnchorableBlock {
  return { id, blockType: "text", data: { __v: 1, segments, dropCap: false } };
}

function image(id: string, data: Record<string, unknown> = {}): AnchorableBlock {
  return { id, blockType: "image", data: { __v: 1, url: "/img.png", ...data } };
}

const mot = (v: string): Node => ({ t: "text", v });
const img = (blockId: string): Node => ({ t: "image", blockId });
const ids = (blocks: AnchorableBlock[]) => blocks.map((b) => b.id);
const segmentsOf = (block: AnchorableBlock) => (block.data as { segments: ReturnType<typeof seg>[] }).segments;

describe("inlineImageIdsIn", () => {
  it("recense les images citees par les paragraphes de tous les blocs texte", () => {
    const blocks = [texte("t1", [seg("s1", [mot("Avant "), img("i1"), mot(" après")])]), texte("t2", [seg("s2", [img("i2")])]), image("i1"), image("i2"), image("i3")];
    expect([...inlineImageIdsIn(blocks)].sort()).toEqual(["i1", "i2"]);
  });

  it("ignore les blocs qui ne sont pas du texte", () => {
    expect(inlineImageIdsIn([image("i1"), { id: "x", blockType: "quest", data: { segments: [seg("s", [img("i1")])] } }]).size).toBe(0);
  });
});

describe("applyInlineImageVisibility", () => {
  it("retire du texte une image dont le bloc n'est pas visible : le texte se referme", () => {
    const brut = [texte("t1", [seg("s1", [mot("Avant "), img("i1"), mot(" après")])]), image("i1")];
    const visibles = [brut[0]]; // le bloc image est reserve au MJ
    const result = applyInlineImageVisibility(inlineImageIdsIn(brut), visibles);
    expect(segmentsOf(result[0])[0].content).toEqual([mot("Avant "), mot(" après")]);
  });

  it("supprime un paragraphe qui ne contenait que l'image cachee", () => {
    const brut = [texte("t1", [seg("s1", [mot("Texte")]), seg("s2", [img("i1")])]), image("i1")];
    const result = applyInlineImageVisibility(inlineImageIdsIn(brut), [brut[0]]);
    expect(segmentsOf(result[0]).map((s) => s.id)).toEqual(["s1"]);
  });

  it("garde un trait de separation, meme sans contenu", () => {
    const brut = [texte("t1", [seg("d", [], "divider"), seg("s1", [mot("x")])])];
    const result = applyInlineImageVisibility(inlineImageIdsIn(brut), brut);
    expect(segmentsOf(result[0]).map((s) => s.id)).toEqual(["d", "s1"]);
  });

  it("garde une image visible dans le texte, et le bloc image dans la liste", () => {
    const brut = [texte("t1", [seg("s1", [mot("Avant "), img("i1")])]), image("i1")];
    const result = applyInlineImageVisibility(inlineImageIdsIn(brut), brut);
    expect(ids(result)).toEqual(["t1", "i1"]);
    expect(segmentsOf(result[0])[0].content).toEqual([mot("Avant "), img("i1")]);
  });

  it("une image visible posee dans un paragraphe cache disparait aussi (jamais de repli dans le fil)", () => {
    const brut = [texte("t1", [seg("s1", [mot("Public")]), seg("s2", [mot("Secret "), img("i1")])]), image("i1")];
    // Le paragraphe s2 est reserve au MJ : deja retire par le filtrage des segments.
    const visibles = [texte("t1", [seg("s1", [mot("Public")])]), image("i1")];
    const result = applyInlineImageVisibility(inlineImageIdsIn(brut), visibles);
    expect(ids(result)).toEqual(["t1"]);
  });

  it("une image visible dans un bloc texte cache disparait aussi", () => {
    const brut = [texte("t1", [seg("s1", [img("i1")])]), image("i1")];
    const result = applyInlineImageVisibility(inlineImageIdsIn(brut), [image("i1")]);
    expect(ids(result)).toEqual([]);
  });

  it("une image de fond posee dans un paragraphe cache reste un fond, sans se montrer dans la page", () => {
    const brut = [texte("t1", [seg("s1", [mot("Public")]), seg("s2", [img("i1")])]), image("i1", { useAsWikiBackground: true, alsoShowInFlow: true })];
    const visibles = [texte("t1", [seg("s1", [mot("Public")])]), brut[1]];
    const result = applyInlineImageVisibility(inlineImageIdsIn(brut), visibles);
    expect(ids(result)).toEqual(["t1", "i1"]);
    expect((result[1].data as { alsoShowInFlow: boolean }).alsoShowInFlow).toBe(false);
  });

  it("ne touche pas une image qui n'est citee par aucun texte", () => {
    const brut = [texte("t1", [seg("s1", [mot("x")])]), image("i1")];
    expect(ids(applyInlineImageVisibility(inlineImageIdsIn(brut), brut))).toEqual(["t1", "i1"]);
  });

  it("ne modifie pas les blocs recus", () => {
    const brut = [texte("t1", [seg("s1", [mot("a"), img("i1")])]), image("i1")];
    applyInlineImageVisibility(inlineImageIdsIn(brut), [brut[0]]);
    expect(segmentsOf(brut[0])[0].content).toHaveLength(2);
  });
});

describe("planImageAnchors et les images dans le texte", () => {
  it("sort du fil une image citee par un paragraphe, sans l'ancrer nulle part", () => {
    const blocks = [texte("t1", [seg("s1", [mot("a"), img("i1")])]), image("i1")];
    const plan = planImageAnchors(blocks);
    expect(ids(plan.contentBlocks)).toEqual(["t1"]);
    expect(plan.anchors).toEqual({});
    expect(plan.inline.i1?.id).toBe("i1");
  });

  it("le texte prime sur un ancien ancrage par paragraphe", () => {
    const blocks = [
      texte("t1", [seg("s1", [mot("a"), img("i1")])]),
      image("i1", { placement: "anchored", anchor: { blockId: "t1", segmentId: "s1", position: "before" } }),
    ];
    const plan = planImageAnchors(blocks);
    expect(plan.anchors).toEqual({});
    expect(Object.keys(plan.inline)).toEqual(["i1"]);
  });
});
