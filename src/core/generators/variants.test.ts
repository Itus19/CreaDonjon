import { describe, expect, it } from "vitest";
import { SeededRng } from "../dice/rng";
import {
  RANDOM_VARIANT_VALUE,
  resolveVariantValue,
  orderedNeighbors,
  entriesUpToTier,
  entriesAtExactTier,
  type GeneratorVariantAxis,
} from "./variants";
import type { TableEntry } from "../tables/types";

const AXIS: GeneratorVariantAxis = {
  key: "type",
  label: "Type",
  options: [
    { key: "forgeron", label: "Forgeron" },
    { key: "apothicaire", label: "Apothicaire" },
    { key: "bazar", label: "Bazar" },
  ],
  allowRandom: true,
};

const WEALTH_AXIS: GeneratorVariantAxis = {
  key: "wealth",
  label: "Richesse",
  options: [
    { key: "modeste", label: "Modeste" },
    { key: "correcte", label: "Correcte" },
    { key: "reputee", label: "Réputée" },
  ],
  allowRandom: true,
};

describe("resolveVariantValue", () => {
  it("laisse passer une valeur choisie telle quelle", () => {
    expect(resolveVariantValue(AXIS, "apothicaire", new SeededRng(1))).toBe("apothicaire");
  });

  it("laisse passer une cle inconnue telle quelle (gabarit mal configure, jamais masque)", () => {
    expect(resolveVariantValue(AXIS, "inexistant", new SeededRng(1))).toBe("inexistant");
  });

  it("tire une option reelle de l'axe pour la valeur reservee", () => {
    const resolved = resolveVariantValue(AXIS, RANDOM_VARIANT_VALUE, new SeededRng(1));
    expect(AXIS.options.map((o) => o.key)).toContain(resolved);
  });

  it("est deterministe pour une graine donnee", () => {
    const a = resolveVariantValue(AXIS, RANDOM_VARIANT_VALUE, new SeededRng(42));
    const b = resolveVariantValue(AXIS, RANDOM_VARIANT_VALUE, new SeededRng(42));
    expect(a).toBe(b);
  });
});

describe("orderedNeighbors", () => {
  it("le palier du milieu voit un voisin de chaque cote", () => {
    expect(orderedNeighbors(WEALTH_AXIS, "correcte")).toEqual({ below: "modeste", above: "reputee" });
  });

  it("le premier palier reste borne — pas de voisin en dessous", () => {
    expect(orderedNeighbors(WEALTH_AXIS, "modeste")).toEqual({ below: "modeste", above: "correcte" });
  });

  it("le dernier palier reste borne — pas de voisin au-dessus", () => {
    expect(orderedNeighbors(WEALTH_AXIS, "reputee")).toEqual({ below: "correcte", above: "reputee" });
  });

  it("une cle inconnue de l'axe se renvoie elle-meme des deux cotes, jamais une erreur", () => {
    expect(orderedNeighbors(WEALTH_AXIS, "inexistant")).toEqual({ below: "inexistant", above: "inexistant" });
  });
});

const ENTRY = (text: string, tier?: string): TableEntry => ({
  range: { min: 1, max: 1 },
  weight: 1,
  text,
  tier,
});

const TIERED_ENTRIES: TableEntry[] = [
  ENTRY("dague miteuse", "modeste"),
  ENTRY("épée correcte", "correcte"),
  ENTRY("épée de maître", "reputee"),
  ENTRY("bâton universel", undefined), // toujours eligible, table pas encore graduee
];

describe("entriesUpToTier", () => {
  it("un plafond du milieu garde son propre palier et tout ce qui est en dessous", () => {
    expect(entriesUpToTier(WEALTH_AXIS, "correcte", TIERED_ENTRIES).map((e) => e.text)).toEqual([
      "dague miteuse",
      "épée correcte",
      "bâton universel",
    ]);
  });

  it("le premier palier exclut tout ce qui est au-dessus", () => {
    expect(entriesUpToTier(WEALTH_AXIS, "modeste", TIERED_ENTRIES).map((e) => e.text)).toEqual([
      "dague miteuse",
      "bâton universel",
    ]);
  });

  it("le dernier palier garde tout", () => {
    expect(entriesUpToTier(WEALTH_AXIS, "reputee", TIERED_ENTRIES)).toHaveLength(4);
  });

  it("un plafond inconnu de l'axe desactive le filtrage plutot que d'exclure tout", () => {
    expect(entriesUpToTier(WEALTH_AXIS, "inexistant", TIERED_ENTRIES)).toHaveLength(4);
  });

  it("une entree dont le palier est inconnu de l'axe reste eligible (faute de frappe de contenu, jamais masquee)", () => {
    const entries = [ENTRY("objet mal etiquete", "typo")];
    expect(entriesUpToTier(WEALTH_AXIS, "modeste", entries)).toHaveLength(1);
  });
});

describe("entriesAtExactTier", () => {
  it("ne garde que le palier demande, plus les entrees sans palier", () => {
    expect(entriesAtExactTier("correcte", TIERED_ENTRIES).map((e) => e.text)).toEqual([
      "épée correcte",
      "bâton universel",
    ]);
  });

  it("un palier sans aucune entree correspondante ne garde que les entrees sans palier", () => {
    expect(entriesAtExactTier("inexistant", TIERED_ENTRIES).map((e) => e.text)).toEqual(["bâton universel"]);
  });
});
