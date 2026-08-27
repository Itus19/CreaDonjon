import { describe, expect, it } from "vitest";
import { docToSegments, segmentsToDoc, type DocJSON } from "./tiptapSync";
import type { Segment } from "../schemas/entities/segments";

describe("segmentsToDoc", () => {
  it("convertit un paragraphe simple", () => {
    const segments: Segment[] = [
      {
        id: "s1",
        blockType: "paragraph",
        visibility: { level: "public", scopeId: null },
        content: [{ t: "text", v: "Bonjour." }],
        align: "left",
      },
    ];
    expect(segmentsToDoc(segments)).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { segmentId: "s1", visibilityLevel: "public", visibilityScopeId: null, align: "left" },
          content: [{ type: "text", text: "Bonjour." }],
        },
      ],
    });
  });

  it("porte un alignement non par defaut jusque dans les attrs", () => {
    const segments: Segment[] = [
      {
        id: "s1",
        blockType: "paragraph",
        visibility: { level: "public", scopeId: null },
        content: [{ t: "text", v: "Centre." }],
        align: "center",
      },
    ];
    expect(segmentsToDoc(segments).content[0].attrs?.align).toBe("center");
  });

  it("convertit un titre h2 avec le niveau attendu", () => {
    const segments: Segment[] = [
      {
        id: "s1",
        blockType: "h2",
        visibility: { level: "public", scopeId: null },
        content: [{ t: "text", v: "Un titre" }],
        align: "left",
      },
    ];
    const doc = segmentsToDoc(segments);
    expect(doc.content[0].type).toBe("heading");
    expect(doc.content[0].attrs?.level).toBe(2);
  });

  it("porte les marques combinees sur le noeud texte", () => {
    const segments: Segment[] = [
      {
        id: "s1",
        blockType: "paragraph",
        visibility: { level: "public", scopeId: null },
        content: [{ t: "text", v: "important", marks: ["bold", "italic"] }],
        align: "left",
      },
    ];
    const doc = segmentsToDoc(segments);
    expect(doc.content[0].content?.[0].marks).toEqual([{ type: "bold" }, { type: "italic" }]);
  });

  it("porte la marque spoiler comme les autres marques", () => {
    const segments: Segment[] = [
      {
        id: "s1",
        blockType: "paragraph",
        visibility: { level: "public", scopeId: null },
        content: [{ t: "text", v: "secret", marks: ["spoiler"] }],
        align: "left",
      },
    ];
    const doc = segmentsToDoc(segments);
    expect(doc.content[0].content?.[0].marks).toEqual([{ type: "spoiler" }]);
    // Le noeud caviarde reste bel et bien envoye au client — spoiler n'est
    // pas un niveau de visibilite (regle absolue n°4, cf. commentaire de
    // src/core/schemas/entities/segments.ts).
    expect(docToSegments(doc)[0].content[0]).toEqual({ t: "text", v: "secret", marks: ["spoiler"] });
  });

  it("omet la cle marks quand le noeud n'en porte aucune", () => {
    const segments: Segment[] = [
      {
        id: "s1",
        blockType: "paragraph",
        visibility: { level: "public", scopeId: null },
        content: [{ t: "text", v: "simple" }],
        align: "left",
      },
    ];
    const doc = segmentsToDoc(segments);
    expect(doc.content[0].content?.[0].marks).toBeUndefined();
  });

  it("convertit un noeud ref en noeud refMention", () => {
    const segments: Segment[] = [
      {
        id: "s1",
        blockType: "paragraph",
        visibility: { level: "gm", scopeId: null },
        content: [{ t: "ref", kind: "entity", id: "ent1", label: "L'Ancre Rouillée" }],
        align: "left",
      },
    ];
    const doc = segmentsToDoc(segments);
    expect(doc.content[0].content?.[0]).toEqual({
      type: "refMention",
      attrs: { kind: "entity", id: "ent1", key: undefined, label: "L'Ancre Rouillée" },
    });
  });

  it("omet les noeuds texte vides (paragraphe vide)", () => {
    const segments: Segment[] = [
      {
        id: "s1",
        blockType: "paragraph",
        visibility: { level: "public", scopeId: null },
        content: [{ t: "text", v: "" }],
        align: "left",
      },
    ];
    const doc = segmentsToDoc(segments);
    expect(doc.content[0].content).toEqual([]);
  });
});

describe("docToSegments", () => {
  it("reconstruit les segments a partir du document (aller-retour stable)", () => {
    const segments: Segment[] = [
      {
        id: "s1",
        blockType: "h1",
        visibility: { level: "public", scopeId: null },
        content: [{ t: "text", v: "Titre" }],
        align: "center",
      },
      {
        id: "s2",
        blockType: "paragraph",
        visibility: { level: "gm", scopeId: null },
        content: [
          { t: "text", v: "secret sur " },
          { t: "ref", kind: "entity", id: "ent1", label: "Bram" },
        ],
        align: "justify",
      },
    ];
    expect(docToSegments(segmentsToDoc(segments))).toEqual(segments);
  });

  it("repli sur left quand align est absent ou invalide dans le document", () => {
    const doc: DocJSON = {
      type: "doc",
      content: [
        { type: "paragraph", attrs: { segmentId: "s1", visibilityLevel: "public", visibilityScopeId: null }, content: [{ type: "text", text: "x" }] },
        {
          type: "paragraph",
          attrs: { segmentId: "s2", visibilityLevel: "public", visibilityScopeId: null, align: "diagonal" },
          content: [{ type: "text", text: "y" }],
        },
      ],
    };
    const segments = docToSegments(doc);
    expect(segments[0].align).toBe("left");
    expect(segments[1].align).toBe("left");
  });

  it("attribue un identifiant neuf a un segmentId manquant", () => {
    const doc: DocJSON = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }],
    };
    const segments = docToSegments(doc);
    expect(segments[0].id).toBeTruthy();
    expect(segments[0].blockType).toBe("paragraph");
  });

  it("attribue un identifiant neuf au second noeud quand un split a duplique le segmentId", () => {
    // Simule ce que produit un splitBlock ProseMirror par defaut : les deux
    // noeuds resultants partagent le meme attrs.segmentId tant qu'on ne
    // l'a pas explicitement corrige — docToSegments doit garantir des id
    // uniques a la sortie, meme si le document d'entree ne l'est pas.
    const doc: DocJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { segmentId: "dup", visibilityLevel: "public", visibilityScopeId: null },
          content: [{ type: "text", text: "premiere partie" }],
        },
        {
          type: "paragraph",
          attrs: { segmentId: "dup", visibilityLevel: "public", visibilityScopeId: null },
          content: [{ type: "text", text: "seconde partie" }],
        },
      ],
    };
    const segments = docToSegments(doc);
    expect(segments[0].id).toBe("dup");
    expect(segments[1].id).not.toBe("dup");
    expect(segments[0].id).not.toEqual(segments[1].id);
  });

  it("retombe sur public quand la visibilite n'est pas renseignee", () => {
    const doc: DocJSON = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }],
    };
    expect(docToSegments(doc)[0].visibility).toEqual({ level: "public", scopeId: null });
  });

  it("mappe heading level 3 sur blockType h3", () => {
    const doc: DocJSON = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 3, segmentId: "s1", visibilityLevel: "public", visibilityScopeId: null },
          content: [{ type: "text", text: "x" }],
        },
      ],
    };
    expect(docToSegments(doc)[0].blockType).toBe("h3");
  });

  it("filtre les marques inconnues et garde les marques valides", () => {
    const doc: DocJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { segmentId: "s1", visibilityLevel: "public", visibilityScopeId: null },
          content: [{ type: "text", text: "x", marks: [{ type: "bold" }, { type: "textStyle" }] }],
        },
      ],
    };
    const node = docToSegments(doc)[0].content[0];
    expect(node).toEqual({ t: "text", v: "x", marks: ["bold"] });
  });

  it("un paragraphe sans contenu produit un segment avec un noeud texte vide", () => {
    const doc: DocJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { segmentId: "s1", visibilityLevel: "public", visibilityScopeId: null },
        },
      ],
    };
    expect(docToSegments(doc)[0].content).toEqual([{ t: "text", v: "" }]);
  });
});
