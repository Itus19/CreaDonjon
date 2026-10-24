import { describe, expect, it } from "vitest";
import type { PlayerCombatParticipant } from "@/src/core/rules/combatPlayerView";
import {
  basculerCase,
  cleBlessure,
  cleDuCycle,
  ECONOMIE_VIERGE,
  economieAffichee,
  invitationOuverte,
  modeCombat,
  monParticipant,
  naturelDepuisSaisie,
  saisieValide,
  type VueCombatJoueur,
} from "./combatJoueur";

function participant(partiel: Partial<PlayerCombatParticipant>): PlayerCombatParticipant {
  return {
    id: "p",
    label: "X",
    initiative: null,
    displayOrder: 0,
    side: "ally",
    entityId: null,
    conditions: [],
    hp: null,
    wound: null,
    order: 1,
    isCurrent: false,
    ...partiel,
  };
}

function vue(status: string, participants: PlayerCombatParticipant[]): VueCombatJoueur {
  return { kind: "ok", combat: { id: "c", name: null, status, round: 1, turnIndex: 0, updatedAt: "" }, participants };
}

describe("monParticipant", () => {
  it("trouve l'allié lié à la fiche réclamée", () => {
    const moi = participant({ id: "a", entityId: "e1" });
    expect(monParticipant([participant({ id: "b", entityId: "e2" }), moi], "e1")).toBe(moi);
  });
  it("ignore un adversaire, et rend null si absent ou ambigu", () => {
    expect(monParticipant([participant({ side: "enemy", entityId: "e1" })], "e1")).toBeNull();
    expect(monParticipant([], "e1")).toBeNull();
    expect(monParticipant([participant({ id: "a", entityId: "e1" }), participant({ id: "b", entityId: "e1" })], "e1")).toBeNull();
  });
});

describe("invitationOuverte", () => {
  const moiSansJet = participant({ entityId: "e1", initiative: null });
  it("s'ouvre en rolling quand l'initiative est vide", () => {
    expect(invitationOuverte(vue("rolling", [moiSansJet]), "e1")).toBe(true);
  });
  it("se ferme quand le MJ a saisi la valeur", () => {
    expect(invitationOuverte(vue("rolling", [participant({ entityId: "e1", initiative: 14 })]), "e1")).toBe(false);
  });
  it("reste fermée hors rolling, sans combat, ou si la joueuse ne combat pas", () => {
    expect(invitationOuverte(vue("running", [moiSansJet]), "e1")).toBe(false);
    expect(invitationOuverte({ kind: "none" }, "e1")).toBe(false);
    expect(invitationOuverte(vue("rolling", [moiSansJet]), "autre")).toBe(false);
  });
});

describe("modeCombat", () => {
  it("n'est actif que pour un combat en cours (running)", () => {
    expect(modeCombat(vue("running", []))).toBe(true);
    expect(modeCombat(vue("rolling", []))).toBe(false);
    expect(modeCombat(vue("ended", []))).toBe(false);
    expect(modeCombat({ kind: "none" })).toBe(false);
  });
});

describe("cleBlessure", () => {
  it("donne la clé de chaque état, et null sans état", () => {
    expect(cleBlessure("unhurt")).toBe("blessureIndemne");
    expect(cleBlessure("hurt")).toBe("blessureBlesse");
    expect(cleBlessure("bloodied")).toBe("blessureEnSang");
    expect(cleBlessure("down")).toBe("blessureHorsDeCombat");
    expect(cleBlessure(null)).toBeNull();
  });
});

describe("économie d'action", () => {
  const cle = cleDuCycle({ round: 2, turnIndex: 3 }, 3);
  it("part vierge", () => {
    expect(economieAffichee(null, cle)).toEqual(ECONOMIE_VIERGE);
  });
  it("garde les cases cochées pendant le tour", () => {
    const etat = basculerCase(basculerCase(null, cle, "action"), cle, "reaction");
    expect(economieAffichee(etat, cle)).toEqual({ action: true, bonus: false, reaction: true });
    expect(economieAffichee(basculerCase(etat, cle, "action"), cle).action).toBe(false);
  });
  it("garde les cases pendant le tour des autres, repart à zéro quand le tour revient à la joueuse", () => {
    // rang 3 : son tour est à l'index 2 de chaque round.
    const etat = basculerCase(null, cleDuCycle({ round: 2, turnIndex: 2 }, 3), "reaction");
    expect(economieAffichee(etat, cleDuCycle({ round: 2, turnIndex: 4 }, 3)).reaction).toBe(true);
    expect(economieAffichee(etat, cleDuCycle({ round: 3, turnIndex: 1 }, 3)).reaction).toBe(true);
    expect(economieAffichee(etat, cleDuCycle({ round: 3, turnIndex: 2 }, 3))).toEqual(ECONOMIE_VIERGE);
  });
});

describe("saisie du vrai dé", () => {
  it("lit un entier de un ou deux chiffres", () => {
    expect(naturelDepuisSaisie(" 17 ")).toBe(17);
    expect(naturelDepuisSaisie("")).toBeNull();
    expect(naturelDepuisSaisie("abc")).toBeNull();
  });
  it("borne 1–20 sans modificateur inclus, −10 à 40 avec", () => {
    expect(saisieValide(21, false)).toBe(false);
    expect(saisieValide(20, false)).toBe(true);
    expect(saisieValide(0, false)).toBe(false);
    expect(saisieValide(25, true)).toBe(true);
    expect(saisieValide(null, true)).toBe(false);
  });
});
