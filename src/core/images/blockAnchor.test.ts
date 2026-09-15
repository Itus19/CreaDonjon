import { describe, expect, it } from "vitest";
import { planImageAnchors, type AnchorableBlock } from "./blockAnchor";

/**
 * Forme minimale attendue par le planificateur — volontairement plus pauvre
 * que `PublicBlock` (serveur) : le noyau ne doit rien savoir de la
 * visibilite, des rétroliens ni du reste de la fiche.
 */
function texte(id: string, segmentIds: string[] = []): AnchorableBlock {
  return {
    id,
    blockType: "text",
    data: { __v: 1, segments: segmentIds.map((sid) => ({ id: sid })) },
  };
}

function image(id: string, data: Record<string, unknown> = {}): AnchorableBlock {
  return { id, blockType: "image", data: { __v: 1, url: "/img.png", ...data } };
}

function ancree(
  blockId: string,
  segmentId: string | null,
  flow = "contourne",
  position: "before" | "after" = "before"
): Record<string, unknown> {
  return { placement: "ancree", anchor: { blockId, segmentId, position }, anchorFlow: flow };
}

const ids = (blocks: AnchorableBlock[]) => blocks.map((b) => b.id);

describe("planImageAnchors", () => {
  it("laisse passer une fiche sans aucun bloc image", () => {
    const blocks = [texte("t1", ["s1"]), texte("t2", ["s2"])];
    const plan = planImageAnchors(blocks);
    expect(ids(plan.contentBlocks)).toEqual(["t1", "t2"]);
    expect(plan.anchors).toEqual({});
  });

  it("garde une image en mode flux a sa place dans le fil", () => {
    const blocks = [texte("t1", ["s1"]), image("i1"), texte("t2", ["s2"])];
    const plan = planImageAnchors(blocks);
    expect(ids(plan.contentBlocks)).toEqual(["t1", "i1", "t2"]);
    expect(plan.anchors).toEqual({});
  });

  it("sort du fil une image ancree et la rattache au segment vise", () => {
    const blocks = [texte("t1", ["s1", "s2", "s3"]), image("i1", ancree("t1", "s2"))];
    const plan = planImageAnchors(blocks);
    expect(ids(plan.contentBlocks)).toEqual(["t1"]);
    expect(plan.anchors.t1).toHaveLength(1);
    expect(plan.anchors.t1[0].block.id).toBe("i1");
    expect(plan.anchors.t1[0].segmentId).toBe("s2");
    expect(plan.anchors.t1[0].flow).toBe("contourne");
  });

  it("reprend `anchorFlow: coupe` tel quel", () => {
    const blocks = [texte("t1", ["s1"]), image("i1", ancree("t1", "s1", "coupe"))];
    expect(planImageAnchors(blocks).anchors.t1[0].flow).toBe("coupe");
  });

  it("ancre en tete du bloc quand `segmentId` est null", () => {
    const blocks = [texte("t1", ["s1"]), image("i1", ancree("t1", null))];
    expect(planImageAnchors(blocks).anchors.t1[0].segmentId).toBeNull();
  });

  // Dernier cran du curseur, « a la fin du bloc » : aucune position ne suit le
  // dernier segment sans ce cote.
  it("pose l'image apres le segment vise quand `position` vaut after", () => {
    const blocks = [texte("t1", ["s1", "s2"]), image("i1", ancree("t1", "s2", "coupe", "after"))];
    const anchor = planImageAnchors(blocks).anchors.t1[0];
    expect(anchor.segmentId).toBe("s2");
    expect(anchor.position).toBe("after");
  });

  it("pose l'image avant le segment par defaut", () => {
    const blocks = [texte("t1", ["s1"]), image("i1", ancree("t1", "s1"))];
    expect(planImageAnchors(blocks).anchors.t1[0].position).toBe("before");
  });

  // Le cote n'a plus de sens sans segment : en tete du bloc, il n'y a pas
  // d'« apres ».
  it("oublie le cote quand le segment vise a disparu", () => {
    const blocks = [texte("t1", ["s1"]), image("i1", ancree("t1", "disparu", "coupe", "after"))];
    const anchor = planImageAnchors(blocks).anchors.t1[0];
    expect(anchor.segmentId).toBeNull();
    expect(anchor.position).toBe("before");
  });

  // Les blocs poses avant ce ticket ne portent que `wrapMode`. Ils doivent
  // rendre comme avant sans qu'aucune ecriture en base ne les convertisse :
  // la traduction se fait ici, au rendu, a un seul endroit.
  describe("traduction de l'ancien `wrapMode`", () => {
    it("ancre un ancien `wrap` en tete du bloc texte suivant", () => {
      const blocks = [image("i1", { wrapMode: "wrap" }), texte("t1", ["s1", "s2"])];
      const plan = planImageAnchors(blocks);
      expect(ids(plan.contentBlocks)).toEqual(["t1"]);
      expect(plan.anchors.t1[0].block.id).toBe("i1");
      expect(plan.anchors.t1[0].segmentId).toBeNull();
      expect(plan.anchors.t1[0].flow).toBe("contourne");
    });

    it("laisse un ancien `intercalate` dans le fil", () => {
      const blocks = [image("i1", { wrapMode: "intercalate" }), texte("t1", ["s1"])];
      expect(ids(planImageAnchors(blocks).contentBlocks)).toEqual(["i1", "t1"]);
      expect(planImageAnchors(blocks).anchors).toEqual({});
    });

    it("laisse dans le fil un ancien `wrap` sans bloc suivant", () => {
      const blocks = [texte("t1", ["s1"]), image("i1", { wrapMode: "wrap" })];
      expect(ids(planImageAnchors(blocks).contentBlocks)).toEqual(["t1", "i1"]);
    });

    // L'ancien rendu faisait flotter l'image et laissait le bloc suivant
    // s'ecouler autour, quel que soit son type. Sans segments, on ne peut
    // rien injecter : le repli est le flux, ce qui supprime au passage la
    // bordure orpheline que ce ticket corrige.
    it("laisse dans le fil un ancien `wrap` suivi d'un bloc sans segments", () => {
      const blocks = [image("i1", { wrapMode: "wrap" }), { id: "q1", blockType: "quest", data: {} }];
      expect(ids(planImageAnchors(blocks).contentBlocks)).toEqual(["i1", "q1"]);
    });

    it("prefere un ancrage explicite a l'ancien `wrapMode`", () => {
      const blocks = [texte("t1", ["s1"]), texte("t2", ["s2"]), image("i1", { wrapMode: "wrap", ...ancree("t1", "s1") })];
      const plan = planImageAnchors(blocks);
      expect(plan.anchors.t1[0].block.id).toBe("i1");
      expect(plan.anchors.t2).toBeUndefined();
    });
  });

  // Regle du depot : rien ne disparait en silence. Chaque cible perdue a un
  // repli explicite, et ce repli est visible sur la fiche.
  describe("replis", () => {
    it("repli en flux quand le bloc cible n'existe plus", () => {
      const blocks = [texte("t1", ["s1"]), image("i1", ancree("supprime", "s9"))];
      const plan = planImageAnchors(blocks);
      expect(ids(plan.contentBlocks)).toEqual(["t1", "i1"]);
      expect(plan.anchors).toEqual({});
    });

    it("repli en flux quand le bloc cible n'a pas de segments", () => {
      const blocks = [{ id: "q1", blockType: "quest", data: {} }, image("i1", ancree("q1", null))];
      expect(ids(planImageAnchors(blocks).contentBlocks)).toEqual(["q1", "i1"]);
    });

    it("repli en flux quand une image est ancree a elle-meme", () => {
      const blocks = [image("i1", ancree("i1", null))];
      expect(ids(planImageAnchors(blocks).contentBlocks)).toEqual(["i1"]);
    });

    it("repli en flux quand `placement` vaut ancree mais que `anchor` est absent", () => {
      const blocks = [texte("t1", ["s1"]), image("i1", { placement: "ancree", anchor: null })];
      expect(ids(planImageAnchors(blocks).contentBlocks)).toEqual(["t1", "i1"]);
    });

    it("ancre en tete du bloc quand le segment vise a ete supprime", () => {
      const blocks = [texte("t1", ["s1", "s2"]), image("i1", ancree("t1", "disparu"))];
      const plan = planImageAnchors(blocks);
      expect(ids(plan.contentBlocks)).toEqual(["t1"]);
      expect(plan.anchors.t1[0].segmentId).toBeNull();
    });
  });

  it("classe plusieurs images du meme bloc hote dans l'ordre de la fiche", () => {
    const blocks = [
      texte("t1", ["s1", "s2"]),
      image("iB", ancree("t1", "s2")),
      image("iA", ancree("t1", "s1")),
    ];
    const plan = planImageAnchors(blocks);
    expect(ids(plan.contentBlocks)).toEqual(["t1"]);
    expect(plan.anchors.t1.map((a) => a.block.id)).toEqual(["iB", "iA"]);
  });

  it("repartit les images entre plusieurs blocs hotes", () => {
    const blocks = [
      texte("t1", ["s1"]),
      texte("t2", ["s2"]),
      image("i1", ancree("t1", "s1")),
      image("i2", ancree("t2", "s2")),
      image("i3"),
    ];
    const plan = planImageAnchors(blocks);
    expect(ids(plan.contentBlocks)).toEqual(["t1", "t2", "i3"]);
    expect(plan.anchors.t1.map((a) => a.block.id)).toEqual(["i1"]);
    expect(plan.anchors.t2.map((a) => a.block.id)).toEqual(["i2"]);
  });

  it("ancre vers un bloc situe avant comme vers un bloc situe apres", () => {
    const blocks = [image("i1", ancree("t1", "s1")), texte("t1", ["s1"])];
    const plan = planImageAnchors(blocks);
    expect(ids(plan.contentBlocks)).toEqual(["t1"]);
    expect(plan.anchors.t1[0].block.id).toBe("i1");
  });

  it("ne touche jamais au tableau recu", () => {
    const blocks = [texte("t1", ["s1"]), image("i1", ancree("t1", "s1"))];
    planImageAnchors(blocks);
    expect(ids(blocks)).toEqual(["t1", "i1"]);
  });
});
