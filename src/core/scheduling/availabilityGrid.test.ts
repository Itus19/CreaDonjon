import { describe, expect, it } from "vitest";
import { buildHeatmap, generateSlots, rangeFromSlots, type SlotResponse } from "./availabilityGrid";

describe("generateSlots", () => {
  it("genere les debuts de creneaux entre deux bornes, pas au-dela", () => {
    expect(generateSlots(19 * 60, 21 * 60, 30)).toEqual([19 * 60, 19 * 60 + 30, 20 * 60, 20 * 60 + 30]);
  });

  it("renvoie un tableau vide si la fenetre est plus courte qu'un creneau", () => {
    expect(generateSlots(19 * 60, 19 * 60 + 10, 30)).toEqual([]);
  });
});

describe("rangeFromSlots", () => {
  it("renvoie null pour un ensemble vide (aucune case peinte)", () => {
    expect(rangeFromSlots([], 30)).toBeNull();
  });

  it("renvoie [debut du plus tot, fin du plus tard + un pas] pour des cases contigues", () => {
    expect(rangeFromSlots([19 * 60, 19 * 60 + 30, 20 * 60], 30)).toEqual({ startMinutes: 19 * 60, endMinutes: 20 * 60 + 30 });
  });

  it("comble les trous : des cases peintes non contigues donnent quand meme une seule plage continue", () => {
    // meme choix qu'aujourd'hui (V2.1-4) : jamais deux plages disjointes le meme soir
    expect(rangeFromSlots([19 * 60, 21 * 60], 30)).toEqual({ startMinutes: 19 * 60, endMinutes: 21 * 60 + 30 });
  });

  it("fonctionne pour une seule case peinte", () => {
    expect(rangeFromSlots([19 * 60], 30)).toEqual({ startMinutes: 19 * 60, endMinutes: 19 * 60 + 30 });
  });
});

describe("buildHeatmap", () => {
  const slots = generateSlots(19 * 60, 20 * 60, 30); // [19:00, 19:30]

  it("associe a chaque case les joueuses dont la plage couvre entierement ce creneau", () => {
    const responses: SlotResponse[] = [
      { date: "2026-09-10", userId: "a", startsAt: 19 * 60, endsAt: 20 * 60 },
      { date: "2026-09-10", userId: "b", startsAt: 19 * 60 + 30, endsAt: 20 * 60 },
    ];
    const cells = buildHeatmap(["2026-09-10"], slots, 30, responses);
    expect(cells).toEqual([
      { date: "2026-09-10", slotStart: 19 * 60, userIds: ["a"] },
      { date: "2026-09-10", slotStart: 19 * 60 + 30, userIds: ["a", "b"] },
    ]);
  });

  it("produit une case pour chaque combinaison date x creneau, meme sans aucune reponse", () => {
    const cells = buildHeatmap(["2026-09-10", "2026-09-11"], slots, 30, []);
    expect(cells).toHaveLength(4);
    expect(cells.every((c) => c.userIds.length === 0)).toBe(true);
  });

  it("ignore une reponse qui ne couvre le creneau que partiellement", () => {
    const responses: SlotResponse[] = [{ date: "2026-09-10", userId: "a", startsAt: 19 * 60 + 15, endsAt: 19 * 60 + 45 }];
    const cells = buildHeatmap(["2026-09-10"], slots, 30, responses);
    expect(cells.every((c) => c.userIds.length === 0)).toBe(true);
  });
});
