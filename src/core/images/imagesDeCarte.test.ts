import { describe, expect, it } from "vitest";
import { imagesAbandonnees, imagesDeCarte } from "./imagesDeCarte";

const carte = (assetId: string | null, thumbnailAssetId: string | null) => ({
  __v: 1,
  mode: "own",
  assetId,
  thumbnailAssetId,
  defaultView: { x: 0, y: 0, zoom: 1 },
});

describe("imagesDeCarte", () => {
  it("rend l'image et la vignette d'une carte qui a les siennes", () => {
    expect(imagesDeCarte(carte("a", "b"))).toEqual(["a", "b"]);
  });
  it("ignore une image absente", () => {
    expect(imagesDeCarte(carte(null, "b"))).toEqual(["b"]);
    expect(imagesDeCarte(carte(null, null))).toEqual([]);
  });
  it("ne compte qu'une fois une image qui servirait aux deux", () => {
    expect(imagesDeCarte(carte("a", "a"))).toEqual(["a"]);
  });
  it("une carte qui renvoie a une autre n'a pas d'image a elle", () => {
    expect(imagesDeCarte({ __v: 1, mode: "ref", sourceBlockId: "x", defaultView: {} })).toEqual([]);
  });
  it("des donnees illisibles ne designent aucune image (rien ne sera efface)", () => {
    expect(imagesDeCarte(null)).toEqual([]);
    expect(imagesDeCarte("texte")).toEqual([]);
    expect(imagesDeCarte({ mode: "own", assetId: 42 })).toEqual([]);
  });
});

describe("imagesAbandonnees", () => {
  it("remplacer l'image abandonne l'ancienne image et l'ancienne vignette", () => {
    expect(imagesAbandonnees(carte("a", "b"), carte("c", "d"))).toEqual(["a", "b"]);
  });
  it("garder la meme image n'abandonne rien", () => {
    expect(imagesAbandonnees(carte("a", "b"), carte("a", "b"))).toEqual([]);
  });
  it("une image passee de vignette a image principale n'est pas abandonnee", () => {
    expect(imagesAbandonnees(carte("a", "b"), carte("b", "c"))).toEqual(["a"]);
  });
  it("passer en carte de renvoi abandonne ses images", () => {
    expect(imagesAbandonnees(carte("a", "b"), { __v: 1, mode: "ref", sourceBlockId: "x", defaultView: {} })).toEqual(["a", "b"]);
  });
  it("supprimer le bloc (plus de donnees) abandonne tout", () => {
    expect(imagesAbandonnees(carte("a", "b"), null)).toEqual(["a", "b"]);
  });
});
