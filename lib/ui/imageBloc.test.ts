import { describe, expect, it } from "vitest";
import { zImageBlockData, type ImageBlockData } from "@/src/core/schemas/blocks/image";
import {
  CHOIX_FOND,
  appliquerFond,
  fondDe,
  reglagesFondVisibles,
  tailleSuivante,
} from "./imageBloc";

const base: ImageBlockData = zImageBlockData.parse({ __v: 1, url: "/x.png" });

describe("tailleSuivante", () => {
  it("monte et descend de 10 en 10", () => {
    expect(tailleSuivante(100, 1)).toBe(110);
    expect(tailleSuivante(100, -1)).toBe(90);
  });
  it("reste dans 50-200", () => {
    expect(tailleSuivante(200, 1)).toBe(200);
    expect(tailleSuivante(50, -1)).toBe(50);
  });
  it("ramène une valeur hors grille sur la grille", () => {
    expect(tailleSuivante(105, 1)).toBe(110);
    expect(tailleSuivante(105, -1)).toBe(100);
    expect(tailleSuivante(55, -1)).toBe(50);
  });
});

describe("fond de la page du wiki", () => {
  it("les trois choix écrivent les bonnes paires", () => {
    expect(appliquerFond(base, "none")).toMatchObject({ useAsWikiBackground: false, alsoShowInFlow: false });
    expect(appliquerFond(base, "also")).toMatchObject({ useAsWikiBackground: true, alsoShowInFlow: true });
    expect(appliquerFond(base, "only")).toMatchObject({ useAsWikiBackground: true, alsoShowInFlow: false });
  });

  it("relit le choix depuis un bloc existant, aller-retour compris", () => {
    for (const mode of CHOIX_FOND) expect(fondDe(appliquerFond(base, mode))).toBe(mode);
    // Un bloc d'avant V2.1-11 (sans alsoShowInFlow) reste « seulement en fond ».
    const ancien = { ...base, useAsWikiBackground: true } as Partial<ImageBlockData> as ImageBlockData;
    delete (ancien as Partial<ImageBlockData>).alsoShowInFlow;
    expect(fondDe(ancien)).toBe("only");
  });

  it("ne montre flou et fondu que s'il y a un fond", () => {
    expect(reglagesFondVisibles("none")).toBe(false);
    expect(reglagesFondVisibles("also")).toBe(true);
    expect(reglagesFondVisibles("only")).toBe(true);
  });
});
