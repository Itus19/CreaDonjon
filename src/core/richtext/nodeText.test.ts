import { describe, expect, it } from "vitest";
import { nodeText } from "./nodeText";

describe("nodeText", () => {
  it("rend le texte d'un noeud texte, le libelle d'une mention, rien pour une image", () => {
    expect(nodeText({ t: "text", v: "Bonjour" })).toBe("Bonjour");
    expect(nodeText({ t: "ref", kind: "entity", id: "e1", label: "Terk" })).toBe("Terk");
    expect(nodeText({ t: "image", blockId: "img-1" })).toBe("");
  });
});
