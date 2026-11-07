import { describe, expect, it } from "vitest";
import { grantingClassLevel } from "./sheet";

/** V3.1-133 — `class.level` : le niveau dans la classe qui accorde la règle (Second souffle d'un Guerrier 3 / Magicien 2 → 3). */
describe("grantingClassLevel", () => {
  const classes = [
    { key: "fighter", level: 3 },
    { key: "wizard", level: 2 },
  ];
  it("une aptitude de classe : le niveau dans cette classe", () => {
    expect(grantingClassLevel("class:fighter", classes)).toBe(3);
    expect(grantingClassLevel("class:wizard", classes)).toBe(2);
  });
  it("une classe que le personnage n'a pas : 0", () => {
    expect(grantingClassLevel("class:paladin", classes)).toBe(0);
  });
  it("une autre source (espèce, don, objet) : le niveau total", () => {
    expect(grantingClassLevel("species:human", classes)).toBe(5);
    expect(grantingClassLevel("feat:alert", classes)).toBe(5);
  });
});
