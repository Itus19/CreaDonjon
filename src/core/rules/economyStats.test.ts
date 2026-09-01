import { describe, expect, it } from "vitest";
import { computeEconomyStats } from "./economyStats";

describe("computeEconomyStats", () => {
  it("somme les gains et les depenses separement", () => {
    const stats = computeEconomyStats([
      { beforeCp: 100, afterCp: 150 }, // +50 gagne
      { beforeCp: 150, afterCp: 90 }, // -60 depense
      { beforeCp: 90, afterCp: 90 }, // aucun changement
    ]);
    expect(stats.earnedCp).toBe(50);
    expect(stats.spentCp).toBe(60);
  });

  it("renvoie zero pour une liste vide", () => {
    expect(computeEconomyStats([])).toEqual({ earnedCp: 0, spentCp: 0 });
  });

  it("ignore les paires sans changement", () => {
    const stats = computeEconomyStats([{ beforeCp: 500, afterCp: 500 }]);
    expect(stats).toEqual({ earnedCp: 0, spentCp: 0 });
  });

  it("cumule plusieurs gains et depenses de personnages differents", () => {
    const stats = computeEconomyStats([
      { beforeCp: 0, afterCp: 1000 },
      { beforeCp: 0, afterCp: 500 },
      { beforeCp: 1000, afterCp: 200 },
    ]);
    expect(stats.earnedCp).toBe(1500);
    expect(stats.spentCp).toBe(800);
  });
});
