import { describe, expect, it } from "vitest";
import { canCastSpell } from "./castableSpells";

describe("un sort que le personnage peut lancer", () => {
  const known = [{ ref: { kind: "rule" as const, key: "vicious-mockery" } }];
  const granted = [{ key: "charm-person" }];

  it("un sort connu", () => {
    expect(canCastSpell(known, granted, "vicious-mockery")).toBe(true);
  });

  it("un sort accordé par une aptitude (toujours préparé), même absent des sorts connus", () => {
    expect(canCastSpell(known, granted, "charm-person")).toBe(true);
    expect(canCastSpell(undefined, granted, "charm-person")).toBe(true);
  });

  it("ni connu ni accordé : refusé", () => {
    expect(canCastSpell(known, granted, "fireball")).toBe(false);
  });
});
