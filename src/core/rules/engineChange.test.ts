import { describe, expect, it } from "vitest";
import { canonicalJson, zEngineChange, zEngineReadRequest, type EngineChange } from "./engineChange";

const change: EngineChange = {
  key_id: "k1",
  nonce: "3b241101-e2bb-4255-8caf-4136c566a962",
  issued_at: "2026-10-31T12:00:00.000Z",
  campaign_id: "39335772-0a92-4ce8-befd-4a0e7eb42bb0",
  changes: [{ kind: "participant", id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", hp: 3, conditions: ["prone"] }],
};

describe("le changement signé du moteur (V3.1-104, ADR 0041)", () => {
  it("la forme canonique trie les clés à tous les niveaux, sans espaces : le même objet donne toujours le même texte", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: null } })).toBe('{"a":{"c":null,"d":[2,{"y":2,"z":1}]},"b":1}');
    const melange = { changes: change.changes, campaign_id: change.campaign_id, issued_at: change.issued_at, nonce: change.nonce, key_id: change.key_id };
    expect(canonicalJson(melange)).toBe(canonicalJson(change));
  });

  it("un changement fermé : seuls les champs prévus passent", () => {
    expect(zEngineChange.safeParse(change).success).toBe(true);
    expect(zEngineChange.safeParse({ ...change, extra: 1 }).success).toBe(false);
    expect(zEngineChange.safeParse({ ...change, changes: [{ ...change.changes[0], ac: 30 }] }).success).toBe(false);
    expect(zEngineChange.safeParse({ ...change, changes: [{ ...change.changes[0], hp: -1 }] }).success).toBe(false);
    expect(zEngineChange.safeParse({ ...change, changes: [] }).success).toBe(false);
  });
});

describe("la demande de lecture signée (V3.1-107, ADR 0069)", () => {
  const lecture = { key_id: "k1", nonce: change.nonce, issued_at: change.issued_at, campaign_id: change.campaign_id, combat_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7" };
  it("fermée : un changement ne passe pas pour une lecture", () => {
    expect(zEngineReadRequest.safeParse(lecture).success).toBe(true);
    expect(zEngineReadRequest.safeParse({ ...lecture, changes: change.changes }).success).toBe(false);
    expect(zEngineChange.safeParse({ ...change, combat_id: lecture.combat_id }).success).toBe(false);
  });
});

describe("V3.1-200 (ADR 0091) — la demande de sauvegarde signée", () => {
  const demande = {
    kind: "save_request" as const,
    id: "9b2f8a64-1c1e-4f0a-8a55-0b9f2d1e6c11",
    request: {
      combat_id: "0f5a3c1e-7d2b-4e8a-9c3f-2a1b4c5d6e7f",
      target_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      label: "Injonction · JS Sagesse DD 15",
      ability: "wis" as const,
      dc: 15,
      effect: { on_fail: { damage: 0, conditions: [] }, on_success: { damage: 0, conditions: [] } },
      origin_roll_id: null,
    },
  };

  it("passe, fermée", () => {
    expect(zEngineChange.safeParse({ ...change, changes: [demande] }).success).toBe(true);
  });

  it("refuse ce qui donnerait un droit : le joueur qui répond ou la fiche de la cible (la base les déduit), un DD hors bornes, une clé de plus", () => {
    for (const r of [
      { ...demande.request, target_user_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7" },
      { ...demande.request, target_entity_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7" },
      { ...demande.request, dc: 41 },
      { ...demande.request, ability: "luck" },
    ]) {
      expect(zEngineChange.safeParse({ ...change, changes: [{ ...demande, request: r }] }).success).toBe(false);
    }
  });
});
