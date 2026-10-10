import { describe, expect, it } from "vitest";
import { decideCombatAccess } from "./combatAccess";

const BASE = { campaignId: "camp-1", campaignFound: true, callerIsWorldAdmin: true };

describe("decideCombatAccess (V3.1-101, ADR 0040)", () => {
  it("laisse passer le MJ de la campagne", () => {
    expect(decideCombatAccess(BASE)).toBe("ok");
  });

  it("refuse un joueur (membre, pas MJ) avant de dire si le combat existe", () => {
    expect(decideCombatAccess({ ...BASE, callerIsWorldAdmin: false })).toBe("forbidden");
    expect(decideCombatAccess({ ...BASE, callerIsWorldAdmin: false, combat: null })).toBe("forbidden");
  });

  it("une campagne invisible pour l'appelant est introuvable", () => {
    expect(decideCombatAccess({ ...BASE, campaignFound: false })).toBe("not_found");
  });

  it("un combat absent, ou d'une autre campagne que celle de l'adresse, est introuvable", () => {
    expect(decideCombatAccess({ ...BASE, combat: null })).toBe("not_found");
    expect(decideCombatAccess({ ...BASE, combat: { id: "c-9", campaignId: "camp-2" } })).toBe("not_found");
    expect(decideCombatAccess({ ...BASE, combat: { id: "c-1", campaignId: "camp-1" } })).toBe("ok");
  });

  it("un participant absent, ou d'un autre combat, est introuvable", () => {
    const combat = { id: "c-1", campaignId: "camp-1" };
    expect(decideCombatAccess({ ...BASE, combat, participant: null })).toBe("not_found");
    expect(decideCombatAccess({ ...BASE, combat, participant: { combatId: "c-2" } })).toBe("not_found");
    expect(decideCombatAccess({ ...BASE, combat, participant: { combatId: "c-1" } })).toBe("ok");
  });

  it("un participant sans combat dans l'adresse est refuse (adresse incoherente)", () => {
    expect(decideCombatAccess({ ...BASE, participant: { combatId: "c-1" } })).toBe("not_found");
  });
});
