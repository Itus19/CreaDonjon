import { describe, expect, it } from "vitest";
import { remapAssetIds } from "./remapAssetIds";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const A2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const carte = new Map([[A, A2], [B, B2]]);

describe("remapAssetIds", () => {
  it("remplace l'image et la vignette d'une carte", () => {
    expect(remapAssetIds({ mode: "own", assetId: A, thumbnailAssetId: B }, carte)).toEqual({ mode: "own", assetId: A2, thumbnailAssetId: B2 });
  });
  it("remplace un identifiant pris dans une adresse", () => {
    expect(remapAssetIds({ url: `/api/assets/${A}` }, carte)).toEqual({ url: `/api/assets/${A2}` });
  });
  it("descend dans les tableaux et les objets imbriques", () => {
    expect(remapAssetIds({ segments: [{ t: "img", src: A }, "texte"], portrait_asset_id: B }, carte)).toEqual({
      segments: [{ t: "img", src: A2 }, "texte"],
      portrait_asset_id: B2,
    });
  });
  it("laisse intact ce qui ne designe aucune image connue", () => {
    const valeur = { assetId: "33333333-3333-4333-8333-333333333333", n: 3, ok: true, vide: null };
    expect(remapAssetIds(valeur, carte)).toEqual(valeur);
  });
  it("ne touche pas aux cles, seulement aux valeurs", () => {
    expect(remapAssetIds({ [A]: "x" }, carte)).toEqual({ [A]: "x" });
  });
  it("sans correspondance, rend la valeur telle quelle", () => {
    const valeur = { assetId: A };
    expect(remapAssetIds(valeur, new Map())).toEqual(valeur);
  });
});
