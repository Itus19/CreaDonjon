import { describe, expect, it } from "vitest";
import { sortsDejaPris } from "./sortsDejaPris";

const accordes = [
  { key: "fire-bolt", featureKey: "choice:magic-initiate.list.wizard.cantrips", label: "Initié à la magie (Magicien)" },
  { key: "bless", featureKey: "subclass:life-domain", label: "Domaine de la Vie" },
];
const connus = [{ ref: { kind: "rule" as const, key: "light" } }, { ref: { kind: "entity" as const, id: "x" } }];

describe("sortsDejaPris", () => {
  it("à l'étape Sorts : tout sort accordé par une aptitude, avec sa source", () => {
    const pris = sortsDejaPris({ accordes, connus: [], sourceClasse: "Clerc" });
    expect(pris.get("fire-bolt")).toBe("Initié à la magie (Magicien)");
    expect(pris.get("bless")).toBe("Domaine de la Vie");
  });

  it("dans un choix de don : les sorts de classe et des autres choix, jamais ceux de ce choix-ci", () => {
    const pris = sortsDejaPris({ accordes, connus, sourceClasse: "Clerc", choix: "magic-initiate.list.wizard.cantrips" });
    expect(pris.has("fire-bolt")).toBe(false);
    expect(pris.get("bless")).toBe("Domaine de la Vie");
    expect(pris.get("light")).toBe("Clerc");
  });

  it("à l'étape Sorts, les sorts de classe déjà choisis ne se grisent pas eux-mêmes", () => {
    expect(sortsDejaPris({ accordes: [], connus, sourceClasse: "Clerc" }).size).toBe(0);
  });
});
