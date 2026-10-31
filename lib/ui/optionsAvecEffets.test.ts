import { describe, expect, it } from "vitest";
import type { ChoiceFrom } from "@/src/core/schemas/rule-blocks/choices";
import { colonnesComparatives, estTableauComparatif, texteModificateur } from "./optionsAvecEffets";

const lignage: ChoiceFrom = {
  kind: "option",
  options: [
    {
      id: "infernal",
      label: { fr: "Infernal" },
      modifiers: [{ target: "save.con", op: "add", value: 1 }],
      spells: [{ key: "thaumaturgy" }, { key: "hellish-rebuke", at_level: 3 }, { key: "darkness", at_level: 5 }],
    },
    { id: "abyssal", label: { fr: "Abyssal" }, spells: [{ key: "poison-spray", at_level: 2 }] },
  ],
};

describe("estTableauComparatif", () => {
  it("reconnaît des options qui portent des sorts ou des modificateurs", () => {
    expect(estTableauComparatif(lignage)).toBe(true);
  });
  it("refuse des options nues et les autres genres", () => {
    expect(estTableauComparatif({ kind: "option", options: [{ id: "a", label: { fr: "A" } }] })).toBe(false);
    expect(estTableauComparatif({ kind: "skill" })).toBe(false);
    expect(estTableauComparatif(undefined)).toBe(false);
  });
});

describe("colonnesComparatives", () => {
  it("range les sorts par palier 1, 3, 5", () => {
    if (lignage.kind !== "option") throw new Error("attendu : option");
    const [infernal, abyssal] = colonnesComparatives(lignage.options, (cle) => cle.toUpperCase());
    expect(infernal.libelle).toBe("Infernal");
    expect(infernal.parNiveau[1]).toContain("THAUMATURGY");
    expect(infernal.parNiveau[3]).toEqual(["HELLISH-REBUKE"]);
    expect(infernal.parNiveau[5]).toEqual(["DARKNESS"]);
    expect(infernal.parNiveau[1]).toHaveLength(2);
    // Un sort du niveau 2 attend le palier 1.
    expect(abyssal.parNiveau[1]).toEqual(["POISON-SPRAY"]);
  });
});

describe("une vitesse se lit en mètres (V3.1-50)", () => {
  it("+5 pieds de l'elfe sylvestre : « Vitesse +1,5 m »", () => {
    expect(texteModificateur({ target: "speed", op: "add", value: 5 })).toBe("Vitesse +1,5 m");
  });
});
