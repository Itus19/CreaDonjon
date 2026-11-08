import { describe, expect, it } from "vitest";
import { couperDebordement, recollerCoupures } from "./coupuresPdf";

/**
 * V3.1-180 — les textes français extraits du PDF du SRD : une phrase coupée
 * en fin de ligne garde son retour, et le dernier texte d'un chapitre avale
 * parfois le début du suivant.
 */
describe("recollerCoupures", () => {
  it("recolle une phrase coupée entre deux mots en minuscules", () => {
    const r = recollerCoupures("**Deux sorts mineurs.** Vous apprenez deux sorts\nmineurs de votre choix.");
    expect(r.texte).toBe("**Deux sorts mineurs.** Vous apprenez deux sorts mineurs de votre choix.");
    expect(r.coupures).toEqual([{ avant: "deux sorts", apres: "mineurs de" }]);
  });

  it("après une virgule ou une apostrophe, avant « ( ou un nombre", () => {
    expect(recollerCoupures("contondants,\nperforants").texte).toBe("contondants, perforants");
    expect(recollerCoupures("ce don plus\nd’une fois.").texte).toBe("ce don plus d’une fois.");
    expect(recollerCoupures("la Vision lucide sur\n18 m.").texte).toBe("la Vision lucide sur 18 m.");
    expect(recollerCoupures("du 1er au\n4e niveau").texte).toBe("du 1er au 4e niveau");
  });

  it("une majuscule après un petit mot de liaison est une coupure (« de\\nForce ») ; après un autre mot, un vrai retour", () => {
    expect(recollerCoupures("Votre valeur de\nForce augmente.").texte).toBe("Votre valeur de Force augmente.");
    expect(recollerCoupures("sa force de caractère\nTel personnage est-il costaud ?").texte).toBe("sa force de caractère\nTel personnage est-il costaud ?");
  });

  it("les vrais retours restent : fin de phrase, intertitre en gras, liste", () => {
    const t = "Fin de phrase.\nNouvelle phrase.\n**Intertitre.** Texte\n**Autre.** Texte\n- un point\nde liste";
    expect(recollerCoupures(t).texte).toBe("Fin de phrase.\nNouvelle phrase.\n**Intertitre.** Texte\n**Autre.** Texte\n- un point de liste");
  });

  it("un texte sans coupure revient identique", () => {
    expect(recollerCoupures("Rien à faire.")).toEqual({ texte: "Rien à faire.", coupures: [] });
  });
});

describe("couperDebordement", () => {
  it("coupe le début du chapitre de classe suivant", () => {
    const r = couperDebordement("jusqu’à la fin de ce tour. Roublard Traits de base du Roublard Caractéristique principale Dextérité");
    expect(r).toEqual({ texte: "jusqu’à la fin de ce tour.", coupe: "Roublard Traits de base du Roublard Caractéristique principale Dextérité" });
  });

  it("coupe un titre de section laissé à la fin (Glossaire de règles, le titre de l'objet suivant)", () => {
    expect(couperDebordement("doit rester vrai dans son esprit. Glossaire de règles").texte).toBe("doit rester vrai dans son esprit.");
    expect(couperDebordement("à plus de 9 m d’elle. Épée mordante").texte).toBe("à plus de 9 m d’elle.");
  });

  it("ne touche pas un texte qui ne déborde pas, ni une classe qui se nomme elle-même", () => {
    expect(couperDebordement("Vous gagnez un don.")).toEqual({ texte: "Vous gagnez un don.", coupe: null });
    expect(couperDebordement("Traits de base du Roublard : Dextérité.").coupe).toBeNull();
  });
});
