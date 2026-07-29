import { describe, expect, it } from "vitest";
import { filterBlocks, filterSegments } from "./filter";
import type { Viewer, VisibilityAware } from "./types";

const noLink: Viewer = { kind: "user", userId: "u-no-link", worldRole: null, campaignRoles: {} };

interface Segment extends VisibilityAware {
  id: string;
  text: string;
}

describe("filterSegments", () => {
  const segments: Segment[] = [
    { id: "s1", text: "Le tavernier semble jovial.", visibility: { level: "public", scopeId: null, createdBy: null } },
    {
      id: "s2",
      text: "En realite, il travaille pour la guilde des voleurs.",
      visibility: { level: "gm", scopeId: null, createdBy: null },
    },
  ];

  it("retire les segments interdits du tableau retourne", () => {
    const result = filterSegments(segments, noLink);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s1");
  });

  it("le texte cache est absent de l'objet retourne, pas seulement marque", () => {
    const result = filterSegments(segments, noLink);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("guilde des voleurs");
  });

  it("ne retire rien pour un lecteur autorise", () => {
    const owner: Viewer = { kind: "user", userId: "u2", worldRole: "owner", campaignRoles: {} };
    const result = filterSegments(segments, owner);
    expect(result).toHaveLength(2);
  });
});

describe("filterBlocks", () => {
  interface Block extends VisibilityAware {
    id: string;
    data: { note: string };
  }

  const blocks: Block[] = [
    { id: "b1", data: { note: "Fiche publique" }, visibility: { level: "public", scopeId: null, createdBy: null } },
    { id: "b2", data: { note: "Secret du MJ" }, visibility: { level: "gm", scopeId: null, createdBy: null } },
    {
      id: "b3",
      data: { note: "Notes privees de u1" },
      visibility: { level: "private", scopeId: null, createdBy: "u1" },
    },
  ];

  it("un lecteur sans role ne voit que le bloc public", () => {
    const result = filterBlocks(blocks, noLink);
    expect(result.map((b) => b.id)).toEqual(["b1"]);
  });

  it("l'auteur des notes privees les voit, mais pas le secret du MJ", () => {
    const result = filterBlocks(blocks, noLink);
    expect(result.some((b) => b.id === "b3")).toBe(false);

    const asAuthor: Viewer = { kind: "user", userId: "u1", worldRole: null, campaignRoles: {} };
    const resultAsAuthor = filterBlocks(blocks, asAuthor);
    expect(resultAsAuthor.map((b) => b.id).sort()).toEqual(["b1", "b3"]);
  });

  it("le contenu cache n'apparait pas dans la reponse serialisee", () => {
    const result = filterBlocks(blocks, noLink);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("Secret du MJ");
    expect(serialized).not.toContain("Notes privees");
  });
});
