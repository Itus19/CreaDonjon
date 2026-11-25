import { describe, expect, it } from "vitest";
import { choixEffectif } from "./providerChoice";

/**
 * Plusieurs fournisseurs par compte, un seul sert à la fois. Le choix
 * enregistré peut devenir caduc (fournisseur supprimé, modèle retiré de sa
 * liste) : la règle de repli doit rester la même partout, sur l'écran comme
 * au moment d'appeler le modèle.
 */
const venice = { id: "v", models: ["llama-3.3-70b", "venice-uncensored"], updatedAt: "2026-11-20T10:00:00Z" };
const openrouter = { id: "o", models: ["openai/gpt-4o-mini", "anthropic/claude-sonnet-4.5"], updatedAt: "2026-11-25T10:00:00Z" };

describe("le modèle d'IA qui sert", () => {
  it("aucun fournisseur : aucun choix", () => {
    expect(choixEffectif([], null)).toBeNull();
    expect(choixEffectif([], { providerId: "v", model: "llama-3.3-70b" })).toBeNull();
  });

  it("le choix enregistré, quand il désigne un modèle existant", () => {
    expect(choixEffectif([venice, openrouter], { providerId: "o", model: "anthropic/claude-sonnet-4.5" })).toEqual({ providerId: "o", model: "anthropic/claude-sonnet-4.5" });
  });

  it("sans choix : le premier modèle du fournisseur modifié le plus récemment", () => {
    expect(choixEffectif([venice, openrouter], null)).toEqual({ providerId: "o", model: "openai/gpt-4o-mini" });
  });

  it("un modèle retiré de la liste : le premier modèle du même fournisseur", () => {
    expect(choixEffectif([venice, openrouter], { providerId: "v", model: "ancien-modele" })).toEqual({ providerId: "v", model: "llama-3.3-70b" });
  });

  it("un fournisseur disparu : on retombe sur la règle sans choix", () => {
    expect(choixEffectif([venice], { providerId: "o", model: "openai/gpt-4o-mini" })).toEqual({ providerId: "v", model: "llama-3.3-70b" });
  });
});
