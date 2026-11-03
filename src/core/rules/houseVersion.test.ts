import { describe, expect, it } from "vitest";
import { EDITABLE_HOMEBREW_TYPES, houseVersionChangedBlocks, zHouseVersionPayload } from "./houseVersion";

const bloc = (block_type: string, data: unknown, display_order = 100) => ({ block_type, display: {}, data, display_order });

describe("la version maison d'une règle officielle (V3.1-94, ADR 0072)", () => {
  it("la copie porte sa clé, son type, son nom et ses blocs", () => {
    const ok = zHouseVersionPayload.safeParse({ entry_key: "longsword", entry_type: "weapon", name: "Épée longue", blocks: [bloc("weapon", { category: "martial" })] });
    expect(ok.success).toBe(true);
    expect(zHouseVersionPayload.safeParse({ entry_key: "longsword", entry_type: "weapon", name: "", blocks: [] }).success).toBe(false);
    expect(zHouseVersionPayload.safeParse({ entry_key: "longsword", entry_type: "inconnu", name: "x", blocks: [] }).success).toBe(false);
  });

  it("seuls les cinq types qui ont un formulaire se copient (on ne copie pas ce qu'on ne peut pas modifier)", () => {
    expect([...EDITABLE_HOMEBREW_TYPES].sort()).toEqual(["background", "feature", "spell", "subclass", "weapon"]);
  });

  it("les blocs changés : donnée différente, bloc ajouté, bloc retiré ; une copie fraîche n'en a aucun", () => {
    const officiel = [bloc("weapon", { category: "martial", damage: "1d8" }), bloc("description", { segments: [] })];
    expect(houseVersionChangedBlocks(officiel, officiel)).toEqual([]);
    const maison = [bloc("weapon", { category: "martial", damage: "1d10" }), bloc("cost", { gp: 5 })];
    expect(houseVersionChangedBlocks(officiel, maison).sort()).toEqual(["cost", "description", "weapon"]);
  });

  it("l'ordre des clés d'un objet ne compte pas", () => {
    expect(houseVersionChangedBlocks([bloc("weapon", { a: 1, b: { c: 2, d: 3 } })], [bloc("weapon", { b: { d: 3, c: 2 }, a: 1 })])).toEqual([]);
  });
});
