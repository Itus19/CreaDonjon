import { describe, expect, it } from "vitest";
import { SeededRng } from "../dice/rng";
import { RANDOM_VARIANT_VALUE, resolveVariantValue, type GeneratorVariantAxis } from "./variants";

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
