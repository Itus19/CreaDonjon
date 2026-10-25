import { describe, expect, it } from "vitest";
import { worldviewTension } from "./tension";

describe("worldviewTension", () => {
  it("à 2 crans d'écart : pas de tension", () => {
    // 80 est « extrême » (+3), 20 est « léger » (+1) : 2 crans.
    const r = worldviewTension([{ key: "order_freedom", value: 80 }], [{ key: "order_freedom", value: 20 }]);
    expect(r).toEqual({ key: "order_freedom", gap: 2, tension: false });
  });

  it("à 3 crans d'écart : tension", () => {
    const r = worldviewTension([{ key: "order_freedom", value: 80 }], [{ key: "order_freedom", value: 0 }]);
    expect(r).toEqual({ key: "order_freedom", gap: 3, tension: true });
  });

  it("de part et d'autre du neutre, l'écart se compte en crans (pas en points)", () => {
    // -20 → -1, +20 → +1 : 2 crans, même si 40 points séparent les valeurs.
    expect(worldviewTension([{ key: "peace_force", value: -20 }], [{ key: "peace_force", value: 20 }])?.gap).toBe(2);
    // -100 contre +100 : 6 crans, le maximum.
    expect(worldviewTension([{ key: "peace_force", value: -100 }], [{ key: "peace_force", value: 100 }])?.gap).toBe(6);
  });

  it("choisit l'axe au plus grand écart", () => {
    const entite = [
      { key: "order_freedom", value: 10 },
      { key: "mercy_justice", value: -80 },
      { key: "peace_force", value: 40 },
    ] as const;
    const faction = [
      { key: "order_freedom", value: 60 },
      { key: "mercy_justice", value: 50 },
      { key: "peace_force", value: 40 },
    ] as const;
    // order: 0 → +2 = 2 ; mercy: -3 → +2 = 5 ; peace: 0.
    expect(worldviewTension(entite, faction)).toEqual({ key: "mercy_justice", gap: 5, tension: true });
  });

  it("à écart égal, garde le premier axe dans l'ordre des pôles", () => {
    const r = worldviewTension(
      [
        { key: "mercy_justice", value: 100 },
        { key: "order_freedom", value: 100 },
      ],
      [
        { key: "mercy_justice", value: -100 },
        { key: "order_freedom", value: -100 },
      ],
    );
    expect(r?.key).toBe("order_freedom");
  });

  it("ne compare que les pôles présents des deux côtés ; aucun en commun → null", () => {
    expect(worldviewTension([{ key: "order_freedom", value: 90 }], [{ key: "peace_force", value: -90 }])).toBeNull();
    expect(worldviewTension([], [])).toBeNull();
  });
});
