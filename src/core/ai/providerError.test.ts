import { describe, expect, it } from "vitest";
import { classerReponseFournisseur } from "./providerError";

/**
 * Pourquoi un fournisseur a refusé : le joueur doit pouvoir distinguer « mon
 * crédit est épuisé » de « j'ai tapé trop vite » et de « ma clé est fausse ».
 * Les corps d'erreur viennent des formes réellement renvoyées par les
 * fournisseurs compatibles OpenAI (OpenAI, OpenRouter, Venice).
 */
describe("la raison d'un refus du fournisseur", () => {
  it("402 : le crédit est épuisé (OpenRouter, Venice)", () => {
    expect(classerReponseFournisseur(402, '{"error":{"message":"Insufficient credits"}}')).toBe("quota");
    expect(classerReponseFournisseur(402, "")).toBe("quota");
  });

  it("429 avec un quota épuisé : c'est le quota, pas une simple limite de débit", () => {
    expect(classerReponseFournisseur(429, '{"error":{"code":"insufficient_quota","message":"You exceeded your current quota"}}')).toBe("quota");
    expect(classerReponseFournisseur(429, '{"error":{"message":"Rate limit reached for tokens per day (TPD)"}}')).toBe("quota");
    expect(classerReponseFournisseur(429, '{"error":{"message":"Daily token limit exceeded"}}')).toBe("quota");
    expect(classerReponseFournisseur(429, "insufficient balance")).toBe("quota");
  });

  it("429 ordinaire : trop d'appels d'un coup, réessayer plus tard suffit", () => {
    expect(classerReponseFournisseur(429, '{"error":{"message":"Rate limit reached for requests per minute"}}')).toBe("limite");
    expect(classerReponseFournisseur(429, "")).toBe("limite");
  });

  it("401 et 403 : la clé est refusée", () => {
    expect(classerReponseFournisseur(401, '{"error":{"message":"Incorrect API key provided"}}')).toBe("cle_refusee");
    expect(classerReponseFournisseur(403, "")).toBe("cle_refusee");
  });

  it("une redirection n'est jamais suivie : c'est un échec", () => {
    expect(classerReponseFournisseur(302, "")).toBe("echec");
  });

  it("le reste est un échec générique", () => {
    expect(classerReponseFournisseur(500, "boom")).toBe("echec");
    expect(classerReponseFournisseur(404, "model not found")).toBe("echec");
  });
});
