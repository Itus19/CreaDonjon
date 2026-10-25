import { describe, expect, it } from "vitest";
import { zImageBlockData, type ImageBlockData } from "@/src/core/schemas/blocks/image";
import {
  CHOIX_FOND,
  appliquerControle,
  appliquerFond,
  estContourne,
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

describe("appliquerControle", () => {
  it("Gauche / Centre / Droite écrit align", () => {
    expect(appliquerControle(base, { controle: "align", valeur: "left" }, false).align).toBe("left");
    expect(appliquerControle(base, { controle: "align", valeur: "right" }, false).align).toBe("right");
    expect(appliquerControle(base, { controle: "align", valeur: "center" }, false).align).toBe("center");
  });

  it("− et + écrivent sizePct", () => {
    expect(appliquerControle(base, { controle: "taille", sens: 1 }, false).sizePct).toBe(110);
    expect(appliquerControle(base, { controle: "taille", sens: -1 }, false).sizePct).toBe(90);
  });

  it("« Le texte contourne » écrit anchorFlow float / break", () => {
    const coupe = { ...base, anchorFlow: "break" as const };
    expect(appliquerControle(coupe, { controle: "contourne" }, true).anchorFlow).toBe("float");
    expect(appliquerControle(base, { controle: "contourne" }, true).anchorFlow).toBe("break");
  });

  it("allumer « contourne » sur une image centrée la passe à gauche", () => {
    const centre = { ...base, anchorFlow: "break" as const, align: "center" as const };
    const r = appliquerControle(centre, { controle: "contourne" }, true);
    expect(r).toMatchObject({ anchorFlow: "float", align: "left" });
  });

  it("choisir Centre quand le texte contourne le fait couper", () => {
    const r = appliquerControle({ ...base, align: "left" }, { controle: "align", valeur: "center" }, true);
    expect(r).toMatchObject({ align: "center", anchorFlow: "break" });
  });

  it("« contourne » ne fait rien sans ancrage, et Centre n'y touche pas anchorFlow", () => {
    expect(appliquerControle(base, { controle: "contourne" }, false)).toBe(base);
    expect(appliquerControle(base, { controle: "align", valeur: "center" }, false).anchorFlow).toBe("float");
    expect(estContourne(base, false)).toBe(false);
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
