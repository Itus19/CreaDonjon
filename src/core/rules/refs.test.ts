import { describe, expect, it } from "vitest";
import { extractDerivedRefs } from "./refs";

describe("extractDerivedRefs", () => {
  it("ne produit rien quand il n'y a pas de bloc class_progression", () => {
    expect(extractDerivedRefs([{ block_type: "description", data: { segments: [] } }])).toEqual([]);
  });

  it("ne produit rien quand la table de progression n'a pas de colonne grants", () => {
    const data = {
      max_level: 5,
      columns: [{ key: "level", label: { fr: "Niveau" }, kind: "level" as const }],
      rows: [{ level: 1 }],
    };
    expect(extractDerivedRefs([{ block_type: "class_progression", data }])).toEqual([]);
  });

  it("extrait un renvoi 'grants' par feature accordee, avec un chemin exact vers sa ligne/colonne", () => {
    const data = {
      max_level: 5,
      columns: [
        { key: "level", label: { fr: "Niveau" }, kind: "level" as const },
        { key: "features", label: { fr: "Aptitudes" }, kind: "grants" as const },
      ],
      rows: [
        { level: 1, features: [{ feature: "rage" }, { feature: "unarmored-defense" }] },
        { level: 2, features: [{ feature: "reckless-attack" }] },
      ],
    };
    expect(extractDerivedRefs([{ block_type: "class_progression", data }])).toEqual([
      { target_key: "rage", ref_kind: "grants", path: "blocks.class_progression.rows[1].features[0]" },
      {
        target_key: "unarmored-defense",
        ref_kind: "grants",
        path: "blocks.class_progression.rows[1].features[1]",
      },
      {
        target_key: "reckless-attack",
        ref_kind: "grants",
        path: "blocks.class_progression.rows[2].features[0]",
      },
    ]);
  });

  it("ignore les grants sans feature (choix pur, ressource) : rien de stable a cibler", () => {
    const data = {
      max_level: 5,
      columns: [
        { key: "level", label: { fr: "Niveau" }, kind: "level" as const },
        { key: "features", label: { fr: "Aptitudes" }, kind: "grants" as const },
      ],
      rows: [{ level: 1, features: [{ choice: "fighting-style-choice" }, { resource: "ki" }] }],
    };
    expect(extractDerivedRefs([{ block_type: "class_progression", data }])).toEqual([]);
  });

  it("ignore les autres colonnes (kind != grants), meme si elles portent des tableaux", () => {
    const data = {
      max_level: 5,
      columns: [
        { key: "level", label: { fr: "Niveau" }, kind: "level" as const },
        { key: "class_specific_bonus", label: { fr: "Bonus" }, kind: "value" as const },
      ],
      rows: [{ level: 1, class_specific_bonus: ["not-a-ref"] }],
    };
    expect(extractDerivedRefs([{ block_type: "class_progression", data }])).toEqual([]);
  });
});
