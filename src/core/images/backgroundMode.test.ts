import { describe, expect, it } from "vitest";
import { backgroundModeOf, showsInPage, withBackgroundMode } from "./backgroundMode";

describe("backgroundModeOf", () => {
  it("dit « aucun fond » pour un bloc qui n'a jamais rien coche", () => {
    expect(backgroundModeOf({})).toBe("none");
    expect(backgroundModeOf({ useAsWikiBackground: false })).toBe("none");
  });

  // Les blocs poses avant V2.1-11 ne portent pas `alsoShowInFlow` : cocher
  // « fond de page » les retirait entierement du corps de la fiche. Ils
  // doivent continuer de se comporter exactement ainsi.
  it("dit « seulement en fond » pour un bloc anterieur au lot 2", () => {
    expect(backgroundModeOf({ useAsWikiBackground: true })).toBe("only");
    expect(backgroundModeOf({ useAsWikiBackground: true, alsoShowInFlow: false })).toBe("only");
  });

  it("dit « en plus de la fiche » quand les deux sont vrais", () => {
    expect(backgroundModeOf({ useAsWikiBackground: true, alsoShowInFlow: true })).toBe("also");
  });

  // `alsoShowInFlow` ne veut rien dire sans fond de page : une image qui n'est
  // pas un fond est deja dans la fiche. On ne laisse pas cette combinaison
  // produire un troisieme etat fantome.
  it("ignore `alsoShowInFlow` quand il n'y a pas de fond de page", () => {
    expect(backgroundModeOf({ useAsWikiBackground: false, alsoShowInFlow: true })).toBe("none");
  });
});

describe("withBackgroundMode", () => {
  it("traduit les trois modes en couple de booleens", () => {
    expect(withBackgroundMode("none")).toEqual({ useAsWikiBackground: false, alsoShowInFlow: false });
    expect(withBackgroundMode("only")).toEqual({ useAsWikiBackground: true, alsoShowInFlow: false });
    expect(withBackgroundMode("also")).toEqual({ useAsWikiBackground: true, alsoShowInFlow: true });
  });

  it("fait l'aller-retour sans perte", () => {
    for (const mode of ["none", "only", "also"] as const) {
      expect(backgroundModeOf(withBackgroundMode(mode))).toBe(mode);
    }
  });
});

describe("showsInPage", () => {
  it("n'exclut du corps de la fiche que « seulement en fond »", () => {
    expect(showsInPage({})).toBe(true);
    expect(showsInPage({ useAsWikiBackground: true, alsoShowInFlow: true })).toBe(true);
    expect(showsInPage({ useAsWikiBackground: true })).toBe(false);
  });
});
