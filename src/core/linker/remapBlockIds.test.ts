import { describe, expect, it } from "vitest";
import { remapBlockIds } from "./remapBlockIds";

const map = new Map([["vieux-img", "neuf-img"], ["vieux-texte", "neuf-texte"]]);

describe("remapBlockIds", () => {
  it("recale une image posee dans le texte", () => {
    const data = { __v: 1, segments: [{ id: "s1", content: [{ t: "text", v: "a" }, { t: "image", blockId: "vieux-img" }] }] };
    expect(remapBlockIds(data, map)).toEqual({ __v: 1, segments: [{ id: "s1", content: [{ t: "text", v: "a" }, { t: "image", blockId: "neuf-img" }] }] });
  });

  it("recale l'ancien ancrage d'une image sur un bloc texte", () => {
    const data = { placement: "anchored", anchor: { blockId: "vieux-texte", segmentId: "s1", position: "before" } };
    expect(remapBlockIds(data, map)).toEqual({ placement: "anchored", anchor: { blockId: "neuf-texte", segmentId: "s1", position: "before" } });
  });

  it("laisse un identifiant inconnu tel quel, et le reste de la donnee intact", () => {
    const data = { anchor: { blockId: "ailleurs" }, segmentId: "vieux-img", liste: [1, "vieux-img"] };
    expect(remapBlockIds(data, map)).toEqual(data);
  });
});
