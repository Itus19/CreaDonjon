import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { outlineRuleSection, splitRuleSection } from "./splitRuleSection";

const CHAPITRE = [
  "## Entre deux aventures",
  "",
  "Entre deux plongees en donjon, les aventuriers ont besoin de repos.",
  "",
  "### Train de vie",
  "",
  "Vous choisissez une qualite de vie et en payez le cout.",
  "",
  "#### Cout quotidien",
  "",
  "Miserable : 0 pa.",
  "",
  "### Activites de temps libre",
  "",
  "Fabrication, recherche, entrainement.",
  "",
].join("\n");

describe("outlineRuleSection", () => {
  it("compte les titres par niveau", () => {
    expect(outlineRuleSection(CHAPITRE)).toEqual([
      { level: 2, title: "Entre deux aventures" },
      { level: 3, title: "Train de vie" },
      { level: 4, title: "Cout quotidien" },
      { level: 3, title: "Activites de temps libre" },
    ]);
  });

  it("ignore un diese qui n'ouvre pas une ligne", () => {
    expect(outlineRuleSection("Un jet de d20 ## pas un titre")).toEqual([]);
  });
});

describe("splitRuleSection", () => {
  it("decoupe au niveau demande, jamais devine", () => {
    const { children } = splitRuleSection(CHAPITRE, { parentKey: "between-adventures", depth: 3 });
    expect(children.map((c) => c.title)).toEqual(["Train de vie", "Activites de temps libre"]);
  });

  it("laisse au chapitre tout ce qui precede la premiere coupe, verbatim", () => {
    const { chapterProse } = splitRuleSection(CHAPITRE, { parentKey: "between-adventures", depth: 3 });
    expect(chapterProse).toContain("## Entre deux aventures");
    expect(chapterProse).toContain("besoin de repos");
    expect(chapterProse).not.toContain("Train de vie");
  });

  it("un enfant conserve ses sous-titres plus profonds", () => {
    const { children } = splitRuleSection(CHAPITRE, { parentKey: "between-adventures", depth: 3 });
    expect(children[0].prose).toContain("#### Cout quotidien");
    expect(children[0].prose).toContain("Miserable : 0 pa.");
  });

  it("descend au niveau 4 quand on le demande", () => {
    const { children } = splitRuleSection(CHAPITRE, { parentKey: "between-adventures", depth: 4 });
    expect(children.map((c) => c.title)).toEqual(["Cout quotidien"]);
  });

  it("ne decoupe rien quand aucun titre n'existe au niveau demande", () => {
    const source = "## Couverture\n\nUn mur entre vous et la cible.\n";
    const { chapterProse, children } = splitRuleSection(source, { parentKey: "cover", depth: 3 });
    expect(children).toEqual([]);
    expect(chapterProse).toBe(source);
  });

  it("derive une cle prefixee par le chapitre, slugifiee", () => {
    const { children } = splitRuleSection(CHAPITRE, { parentKey: "between-adventures", depth: 3 });
    expect(children.map((c) => c.key)).toEqual([
      "between-adventures-train-de-vie",
      "between-adventures-activites-de-temps-libre",
    ]);
  });

  it("distingue deux titres identiques plutot que d'ecraser l'un des deux", () => {
    const source = "## Pieges\n\n### Exemple\n\nA.\n\n### Exemple\n\nB.\n";
    const { children } = splitRuleSection(source, { parentKey: "traps", depth: 3 });
    expect(children.map((c) => c.key)).toEqual(["traps-exemple", "traps-exemple-2"]);
  });

  it("garde un titre sans contenu plutot que de le perdre", () => {
    const source = "## X\n\n### Vide\n### Plein\n\nDu texte.\n";
    const { children } = splitRuleSection(source, { parentKey: "x", depth: 3 });
    expect(children.map((c) => c.title)).toEqual(["Vide", "Plein"]);
  });

  it("rejette une profondeur hors des niveaux markdown", () => {
    expect(() => splitRuleSection(CHAPITRE, { parentKey: "x", depth: 1 })).toThrow(/profondeur/i);
    expect(() => splitRuleSection(CHAPITRE, { parentKey: "x", depth: 7 })).toThrow(/profondeur/i);
  });
});

describe("cas dores — les 33 sections reelles du SRD", () => {
  const sections: { index: string; desc: string }[] = JSON.parse(
    readFileSync("data/srd/srd-2014.json", "utf-8")
  )["Rule-Sections"];

  it("charge bien les sections de reference", () => {
    expect(sections.length).toBe(33);
  });

  /**
   * L'invariant qui compte : un decoupage ne perd ni ne duplique un
   * caractere. C'est ce qui autorise a le rejouer sur du contenu reel sans
   * relire les 190 000 caracteres a la main.
   */
  it("ne perd ni ne duplique aucun caractere, a toutes les profondeurs", () => {
    for (const section of sections) {
      for (let depth = 2; depth <= 6; depth += 1) {
        const { chapterProse, children } = splitRuleSection(section.desc, {
          parentKey: section.index,
          depth,
        });
        const recompose = chapterProse + children.map((c) => c.prose).join("");
        expect(recompose, `${section.index} a la profondeur ${depth}`).toBe(section.desc);
      }
    }
  });

  it("laisse intactes les neuf sections sans titre de niveau 3", () => {
    const intactes = sections.filter(
      (s) => splitRuleSection(s.desc, { parentKey: s.index, depth: 3 }).children.length === 0
    );
    expect(intactes.map((s) => s.index).sort()).toEqual([
      "ability-scores-and-modifiers",
      "advantage-and-disadvantage",
      "attunement",
      "cover",
      "proficiency-bonus",
      "saving-throws",
      "standard-exchange-rates",
      "time",
      "underwater-combat",
    ]);
  });

  it("decoupe `actions-in-combat` en ses dix actions", () => {
    const section = sections.find((s) => s.index === "actions-in-combat")!;
    const { children } = splitRuleSection(section.desc, { parentKey: section.index, depth: 3 });
    expect(children.length).toBe(10);
    expect(children[0].title).toBe("Attack");
    expect(children.map((c) => c.key)).toContain("actions-in-combat-dash");
  });

  it("produit des cles uniques sur l'ensemble du SRD", () => {
    const keys = sections.flatMap((s) =>
      splitRuleSection(s.desc, { parentKey: s.index, depth: 3 }).children.map((c) => c.key)
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
