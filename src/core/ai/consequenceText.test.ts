import { describe, expect, it } from "vitest";
import { describeConsequence, tallyConsequences } from "./consequenceText";

describe("describeConsequence", () => {
  it("une entite creee : nom et trait", () => {
    expect(describeConsequence("create_entity", { name: "Grelin", trait: "une cicatrice au menton" })).toBe("Grelin — une cicatrice au menton");
  });

  it("une entite creee sans trait : le nom seul", () => {
    expect(describeConsequence("create_entity", { name: "Grelin" })).toBe("Grelin");
  });

  it("un ajout de texte : le texte propose", () => {
    expect(describeConsequence("update_block", { text: "Le village vit de la pêche." })).toBe("Le village vit de la pêche.");
  });

  it("une charge utile vide ne casse rien", () => {
    expect(describeConsequence("create_entity", {})).toBe("une entité");
    expect(describeConsequence("update_block", {})).toBe("un ajout au texte");
  });
});

describe("tallyConsequences", () => {
  it("compte les fiches, blocs et relations crees — jamais les mises a jour", () => {
    const tally = tallyConsequences(["create_entity", "create_entity", "create_block", "create_relation", "update_block"]);
    expect(tally).toEqual({ entities: 2, blocks: 1, relations: 1 });
  });

  it("rien a compter : tout a zero", () => {
    expect(tallyConsequences([])).toEqual({ entities: 0, blocks: 0, relations: 0 });
  });
});
