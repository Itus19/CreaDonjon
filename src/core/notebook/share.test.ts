import { describe, expect, it } from "vitest";
import type { NarrativeContent } from "../schemas/entities/segments";
import type { NoteTreeItem } from "../schemas/blocks/noteTree";
import { pageToSharedLink, unlinkUnknownEntityRefs } from "./share";

const page: NoteTreeItem = { id: "p1", parentId: null, position: 1000, kind: "page", title: "Soupçons", content: [] };
const pin: NoteTreeItem = { id: "e1", parentId: null, position: 2000, kind: "pinned_entity", targetId: "x" };

describe("pageToSharedLink (V3.1-41, ADR 0037)", () => {
  it("remplace la page par un lien vers l'entité partagée, à la même place", () => {
    expect(pageToSharedLink([page, pin], "p1", "ent-9")).toEqual([
      { id: "p1", parentId: null, position: 1000, kind: "shared_page", targetId: "ent-9" },
      pin,
    ]);
  });

  it("rend null si l'élément n'est pas une page", () => {
    expect(pageToSharedLink([page, pin], "e1", "ent-9")).toBeNull();
    expect(pageToSharedLink([page], "absent", "ent-9")).toBeNull();
  });
});

const content = (nodes: NarrativeContent[number]["content"]): NarrativeContent => [
  { id: "s1", blockType: "paragraph", visibility: { level: "public", scopeId: null }, content: nodes, align: "left" },
];

describe("unlinkUnknownEntityRefs : un nom que le lecteur n'a pas découvert arrive sans lien", () => {
  it("garde le lien vers une fiche connue, retire l'identifiant d'une fiche inconnue", () => {
    const out = unlinkUnknownEntityRefs(
      content([
        { t: "text", v: "J'ai vu " },
        { t: "ref", kind: "entity", id: "connue", label: "Mira" },
        { t: "text", v: " et " },
        { t: "ref", kind: "entity", id: "secrete", label: "le Roi caché" },
      ]),
      new Set(["connue"])
    );
    expect(out[0].content).toEqual([
      { t: "text", v: "J'ai vu " },
      { t: "ref", kind: "entity", id: "connue", label: "Mira" },
      { t: "text", v: " et " },
      { t: "text", v: "le Roi caché" },
    ]);
    expect(JSON.stringify(out)).not.toContain("secrete");
  });

  it("laisse intacts les liens de règle et d'image", () => {
    const nodes: NarrativeContent[number]["content"] = [
      { t: "ref", kind: "rule", key: "fireball", label: "Boule de feu" },
      { t: "ref", kind: "asset", id: "img", label: "carte" },
    ];
    expect(unlinkUnknownEntityRefs(content(nodes), new Set())[0].content).toEqual(nodes);
  });
});
