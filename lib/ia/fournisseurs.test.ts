import { describe, expect, it } from "vitest";
import { nomCourtModele, optionsChoix } from "./fournisseurs";

describe("nomCourtModele — le nom du modèle sur le bouton étroit du solo", () => {
  it("retire l'éditeur et la variante", () => {
    expect(nomCourtModele("liquid/lfm-3-1.7b:free")).toBe("lfm-3-1.7b");
    expect(nomCourtModele("openai/gpt-4o-mini")).toBe("gpt-4o-mini");
  });

  it("garde un nom déjà court tel quel (modèle local)", () => {
    expect(nomCourtModele("qwen3-8b")).toBe("qwen3-8b");
  });

  it("ne rend jamais un nom vide", () => {
    expect(nomCourtModele("editeur/")).toBe("editeur/");
    expect(nomCourtModele(":free")).toBe(":free");
  });
});

describe("optionsChoix", () => {
  it("donne au menu le nom complet et au bouton le nom court", () => {
    const [option] = optionsChoix([
      { id: "f1", label: "OpenRouter", baseUrl: "https://example.test/v1", models: ["liquid/lfm-3-1.7b:free"], aUneCle: true, posePar: "" },
    ]);
    expect(option).toEqual({ value: "f1::liquid/lfm-3-1.7b:free", label: "liquid/lfm-3-1.7b:free", labelCourt: "lfm-3-1.7b", groupe: "OpenRouter" });
  });
});
