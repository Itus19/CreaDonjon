import { describe, expect, it } from "vitest";
import { actionLogo, choixInitial } from "./identiteApp";

describe("actionLogo", () => {
  it("téléverse quand un fichier est choisi et que le logo téléversé reste retenu", () => {
    expect(actionLogo({ choix: "televerse", fichierChoisi: true, televerseExistant: false })).toBe("upload");
    expect(actionLogo({ choix: "televerse", fichierChoisi: true, televerseExistant: true })).toBe("upload");
  });

  it("retire le logo téléversé existant quand un dessin est choisi à la place", () => {
    expect(actionLogo({ choix: "dessin", fichierChoisi: false, televerseExistant: true })).toBe("remove");
    // Un fichier choisi puis abandonné pour un dessin ne se téléverse pas.
    expect(actionLogo({ choix: "dessin", fichierChoisi: true, televerseExistant: true })).toBe("remove");
  });

  it("ne touche à rien sinon", () => {
    expect(actionLogo({ choix: "dessin", fichierChoisi: false, televerseExistant: false })).toBe("keep");
    expect(actionLogo({ choix: "dessin", fichierChoisi: true, televerseExistant: false })).toBe("keep");
    expect(actionLogo({ choix: "televerse", fichierChoisi: false, televerseExistant: true })).toBe("keep");
  });
});

describe("choixInitial", () => {
  it("retient le logo téléversé s'il existe, le dessin sinon", () => {
    expect(choixInitial("/api/app-identity/logo")).toBe("televerse");
    expect(choixInitial(null)).toBe("dessin");
  });
});
