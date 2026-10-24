import { describe, expect, it } from "vitest";
import { AUCUNE_COMMANDE, TOUTES_LES_COMMANDES, commandesDeLaFiche } from "./commandesFiche";

describe("commandesDeLaFiche", () => {
  it("n'accorde aucune commande tant que la fiche calculée n'est pas arrivée", () => {
    expect(commandesDeLaFiche(undefined)).toBe(AUCUNE_COMMANDE);
    expect(Object.values(AUCUNE_COMMANDE).every((v) => v === false)).toBe(true);
  });

  it("couvre les six champs, tous vrais pour le MJ", () => {
    expect(Object.keys(TOUTES_LES_COMMANDES).sort()).toEqual(["conditions", "currency", "hit_dice", "hp", "inspiration", "spell_slots"]);
    expect(Object.values(TOUTES_LES_COMMANDES).every((v) => v === true)).toBe(true);
  });

  it("rend telles quelles les commandes du serveur", () => {
    const controls = { ...TOUTES_LES_COMMANDES, hp: false };
    expect(commandesDeLaFiche(controls)).toBe(controls);
  });
});
