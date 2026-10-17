import { describe, expect, it } from "vitest";
import { isDead, isStabilized } from "@/src/core/rules/deathSaves";
import { etatMourant } from "./etatMourant";

const aucun = { success: 0, fail: 0 };

describe("etatMourant", () => {
  it("au-dessus de 0 PV : vivant, quels que soient les jets restés en base", () => {
    expect(etatMourant({ current: 1 }, aucun)).toBe("vivant");
    expect(etatMourant({ current: 12 }, { success: 2, fail: 2 })).toBe("vivant");
  });

  it("à 0 PV, sous trois réussites et trois échecs : mourant", () => {
    expect(etatMourant({ current: 0 }, aucun)).toBe("mourant");
    expect(etatMourant({ current: 0 }, { success: 2, fail: 2 })).toBe("mourant");
  });

  it("à 0 PV, trois réussites : stabilisé", () => {
    expect(etatMourant({ current: 0 }, { success: 3, fail: 1 })).toBe("stabilisé");
  });

  it("à 0 PV, trois échecs : mort, même avec trois réussites", () => {
    expect(etatMourant({ current: 0 }, { success: 0, fail: 3 })).toBe("mort");
    expect(etatMourant({ current: 0 }, { success: 3, fail: 3 })).toBe("mort");
  });

  it("reste aligné sur les règles du noyau (seuil 3)", () => {
    for (let success = 0; success <= 3; success++) {
      for (let fail = 0; fail <= 3; fail++) {
        const etat = { hp: { current: 0, max: 10, temp: 0 }, conditions: [], deathSaves: { success, fail } };
        const attendu = isDead(etat) ? "mort" : isStabilized(etat) ? "stabilisé" : "mourant";
        expect(etatMourant({ current: 0 }, { success, fail })).toBe(attendu);
      }
    }
  });
});
