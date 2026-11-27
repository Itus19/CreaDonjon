import { describe, expect, it } from "vitest";
import { coverageOf } from "./coverage";
import { assembleCoverage, formatCoverageReport, levelOfEntry, type ReportEntry } from "./coverageReport";

const fiche = (p: Partial<ReportEntry> & { key: string; type: string }): ReportEntry => ({
  id: p.key,
  name: p.key,
  sourceRaw: {},
  blocks: [],
  ...p,
});

describe("levelOfEntry", () => {
  it("lit un niveau numérique, un sort ou une aptitude", () => {
    expect(levelOfEntry({ level: 3 }, [])).toBe(3);
  });
  it("lit « classe-N » dans level.index", () => {
    expect(levelOfEntry({ level: { index: "rogue-11" } }, [])).toBe(11);
  });
  it("se rabat sur le bloc spell_casting", () => {
    expect(levelOfEntry({}, [{ block_type: "spell_casting", data: { level: 2 } }])).toBe(2);
  });
  it("rend undefined sans niveau", () => {
    expect(levelOfEntry({}, [])).toBeUndefined();
  });
});

describe("assembleCoverage", () => {
  const entries: ReportEntry[] = [
    fiche({ key: "dash", type: "feature", blocks: [{ block_type: "activation", data: {} }] }),
    fiche({ key: "gap", type: "feature", blocks: [{ block_type: "coverage", data: { gaps: [{ text: "t", missing: "m", brick: "timing" }] } }] }),
    fiche({ key: "prose", type: "feature" }),
    fiche({ key: "fire", type: "spell", sourceRaw: { level: 0 }, blocks: [{ block_type: "effects", data: {} }] }),
    fiche({
      key: "human",
      type: "species",
      blocks: [{ block_type: "species_traits", data: { traits: [{ kind: "rule", key: "dash" }, { kind: "rule", key: "gap" }] } }],
    }),
    fiche({ key: "oath-of-devotion", type: "subclass" }),
    fiche({ key: "devotion-x", type: "feature", sourceRaw: { subclass: { index: "oath-of-devotion" } }, blocks: [{ block_type: "activation", data: {} }] }),
    fiche({
      key: "orc",
      type: "monster",
      blocks: [
        { block_type: "actions", data: { actions: [{ name: "Hache", description: "", attack_bonus: 5 }, { name: "Cri", description: "" }] } },
        { block_type: "traits", data: { traits: [{ name: "Agressif", description: "" }] } },
      ],
    }),
    fiche({ key: "blinded", type: "condition" }),
    fiche({ key: "lore", type: "background" }),
  ];
  const rows = assembleCoverage(entries);
  const de = (k: string) => rows.find((r) => r.key === k)!;

  it("recoupe coverageOf pour une aptitude et un sort", () => {
    expect(de("dash").result).toEqual(coverageOf({ category: "feature", blockTypes: ["activation"], gaps: [] }));
    expect(de("gap").result.state).toBe("partial");
    expect(de("prose").result.state).toBe("unevaluated");
    expect(de("fire").result.state).toBe("playable");
    expect(de("fire").level).toBe(0);
  });
  it("agrège une espèce par les fiches citées", () => {
    expect(de("human").result.state).toBe("partial");
    expect(de("human").result.gaps[0]?.brick).toBe("timing");
  });
  it("agrège une sous-classe par source_raw.subclass.index", () => {
    expect(de("oath-of-devotion").result.state).toBe("playable");
  });
  it("lit un monstre : une action sans chiffre et un trait", () => {
    expect(de("orc").result.gaps.map((g) => g.brick)).toEqual(["monster_action", "monster_trait"]);
  });
  it("une aptitude de sous-classe dont la sous-classe déclare la mécanique (modificateurs, sorts, choix) est jouable ; sans rien, non évaluée", () => {
    const lignes = assembleCoverage([
      fiche({
        key: "draconic-sorcery",
        type: "subclass",
        blocks: [
          {
            block_type: "subclass_features",
            data: {
              features: [
                { name: "Elemental Affinity", level: 6, description: "", modifiers: [{ target: "resist.fire", op: "add", value: 1 }] },
                { name: "Dragon Wings", level: 14, description: "" },
              ],
            },
          },
        ],
      }),
      fiche({ key: "draconic-sorcery-elemental-affinity", type: "feature", sourceRaw: { subclass: { index: "draconic-sorcery" } } }),
      fiche({ key: "draconic-sorcery-dragon-wings", type: "feature", sourceRaw: { subclass: { index: "draconic-sorcery" } } }),
    ]);
    const etat = (k: string) => lignes.find((r) => r.key === k)?.result.state;
    expect(etat("draconic-sorcery-elemental-affinity")).toBe("playable");
    expect(etat("draconic-sorcery-dragon-wings")).toBe("unevaluated");
    expect(etat("draconic-sorcery")).toBe("partial");
  });
  it("une aptitude que le moteur joue en code (maîtrise des armes, choix de la sous-classe) est jouable sans bloc ; une voisine reste non évaluée", () => {
    const lignes = assembleCoverage([
      fiche({ key: "fighter-weapon-mastery", type: "feature" }),
      fiche({ key: "rogue-weapon-mastery", type: "feature" }),
      fiche({ key: "fighter-subclass", type: "feature" }),
      fiche({ key: "wizard-subclass", type: "feature" }),
      fiche({ key: "fighter-tactical-mind", type: "feature" }),
      // Une lacune déclarée l'emporte : la règle reste partielle.
      fiche({ key: "paladin-weapon-mastery", type: "feature", blocks: [{ block_type: "coverage", data: { gaps: [{ text: "x", missing: "y", brick: "other" }] } }] }),
    ]);
    const etat = (k: string) => lignes.find((r) => r.key === k)?.result.state;
    expect(etat("fighter-weapon-mastery")).toBe("playable");
    expect(etat("rogue-weapon-mastery")).toBe("playable");
    expect(etat("fighter-subclass")).toBe("playable");
    expect(etat("wizard-subclass")).toBe("playable");
    expect(etat("fighter-tactical-mind")).toBe("unevaluated");
    expect(etat("paladin-weapon-mastery")).toBe("partial");
  });
  it("un état du moteur est jouable ; un historique est hors du compte", () => {
    expect(de("blinded").result.state).toBe("playable");
    expect(de("lore").result.state).toBe("out_of_scope");
  });
});

describe("formatCoverageReport", () => {
  const rows = assembleCoverage([
    fiche({ key: "a", type: "feature", name: "Alpha", sourceRaw: { level: { index: "fighter-2" } } }),
    fiche({ key: "b", type: "feature", name: "Bravo", sourceRaw: { level: 9 }, blocks: [{ block_type: "coverage", data: { gaps: [{ text: "limite", missing: "m", brick: "scaling" }] } }] }),
  ]);
  const md = formatCoverageReport(rows, "2026-11-16", "npx tsx scripts/couverture-srd.ts");
  it("porte la date sur une seule ligne, la commande, et les tableaux", () => {
    expect(md.split("\n").filter((l) => l.includes("2026-11-16"))).toHaveLength(1);
    expect(md).toContain("npx tsx scripts/couverture-srd.ts");
    expect(md).toContain("| Aptitudes et dons |");
    expect(md).toContain("scaling");
    expect(md).toContain("limite");
  });
  it("met en « fréquentes d'abord » les aptitudes de niveau 1 à 5 seulement", () => {
    const frequentes = md.split("## Fréquentes d'abord")[1] ?? "";
    expect(frequentes).toContain("Alpha");
    expect(frequentes).not.toContain("Bravo");
  });
  it("compte une lacune une seule fois, sur l'aptitude, même quand une espèce la reprend", () => {
    const avecEspece = assembleCoverage([
      fiche({ key: "souffle", type: "feature", blocks: [{ block_type: "coverage", data: { gaps: [{ text: "un seul jet", missing: "m", brick: "area_damage" }] } }] }),
      fiche({ key: "drakeide", type: "species", blocks: [{ block_type: "species_traits", data: { traits: [{ kind: "rule", key: "souffle" }] } }] }),
    ]);
    const texte = formatCoverageReport(avecEspece, "2026-11-16", "x");
    expect(texte).toContain("| `area_damage` (");
    expect(texte.split("\n").find((l) => l.startsWith("| `area_damage`"))).toMatch(/\| 1 \|$/);
  });
  it("est stable : même entrée, même sortie", () => {
    expect(formatCoverageReport([...rows].reverse(), "2026-11-16", "x")).toBe(formatCoverageReport(rows, "2026-11-16", "x"));
  });
});
