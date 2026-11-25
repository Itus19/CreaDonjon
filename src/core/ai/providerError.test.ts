import { describe, expect, it } from "vitest";
import { classerReponseFournisseur, extraireMessageFournisseur } from "./providerError";

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
    expect(classerReponseFournisseur(429, '{"error":{"message":"Rate limit exceeded: free-models-per-day"}}')).toBe("quota");
  });

  it("429 ordinaire : trop d'appels d'un coup, réessayer plus tard suffit", () => {
    expect(classerReponseFournisseur(429, '{"error":{"message":"Rate limit reached for requests per minute"}}')).toBe("limite");
    expect(classerReponseFournisseur(429, "")).toBe("limite");
  });

  it("403 pour un modèle hors de l'offre : la clé est bonne, c'est la requête qui est refusée (Mistral)", () => {
    expect(
      classerReponseFournisseur(403, '{"object":"error","message":"This model is not available in your subscription tier","type":"tier_not_allowed","code":"1910"}'),
    ).toBe("refusee");
  });

  it("401 et 403 : la clé est refusée", () => {
    expect(classerReponseFournisseur(401, '{"error":{"message":"Incorrect API key provided"}}')).toBe("cle_refusee");
    expect(classerReponseFournisseur(403, "")).toBe("cle_refusee");
  });

  it("une redirection n'est jamais suivie : c'est un échec", () => {
    expect(classerReponseFournisseur(302, "")).toBe("echec");
  });

  it("400, 404, 422 : le fournisseur a répondu mais refusé la requête (modèle ou adresse)", () => {
    expect(classerReponseFournisseur(404, "model not found")).toBe("refusee");
    expect(classerReponseFournisseur(400, '{"error":{"message":"No endpoints found that support tool use"}}')).toBe("refusee");
    expect(classerReponseFournisseur(422, "")).toBe("refusee");
  });

  it("le reste est un échec générique", () => {
    expect(classerReponseFournisseur(500, "boom")).toBe("echec");
    expect(classerReponseFournisseur(503, "")).toBe("echec");
  });
});

/**
 * Le message du fournisseur, tel que l'écran le montre sous le voyant : on
 * prend la phrase utile, pas le JSON entier, et jamais rien qui ressemble à
 * une clé.
 */
describe("le message d'un refus du fournisseur", () => {
  it("le message d'une erreur au format OpenAI ou Mistral", () => {
    expect(extraireMessageFournisseur(403, '{"object":"error","message":"This model is not available in your subscription tier","type":"tier_not_allowed"}')).toBe(
      "403 : This model is not available in your subscription tier",
    );
    expect(extraireMessageFournisseur(402, '{"error":{"message":"Insufficient credits"}}')).toBe("402 : Insufficient credits");
  });

  it("OpenRouter : la cause d'origine plutôt que « Provider returned error »", () => {
    const corps = '{"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"model:free is temporarily rate-limited upstream.","provider_name":"X"}}}';
    expect(extraireMessageFournisseur(429, corps)).toBe("429 : model:free is temporarily rate-limited upstream.");
  });

  it("Gemini : l'erreur arrive dans un tableau", () => {
    expect(extraireMessageFournisseur(503, '[{"error":{"code":503,"message":"The model is overloaded. Please try again later.","status":"UNAVAILABLE"}}]')).toBe(
      "503 : The model is overloaded. Please try again later.",
    );
  });

  it("un corps vide ou illisible", () => {
    expect(extraireMessageFournisseur(404, "")).toBe("404, sans message");
    expect(extraireMessageFournisseur(500, "  boom \n  total ")).toBe("500 : boom total");
  });

  it("ce qui ressemble à une clé est masqué", () => {
    expect(extraireMessageFournisseur(401, '{"error":{"message":"Incorrect API key provided: sk-proj-abcdefghijklmnopqrstuvwxyz123456"}}')).toBe(
      "401 : Incorrect API key provided: [masqué]",
    );
  });

  it("borné à 200 caractères", () => {
    expect(extraireMessageFournisseur(500, "a ".repeat(300)).length).toBeLessThanOrEqual(206);
  });
});
