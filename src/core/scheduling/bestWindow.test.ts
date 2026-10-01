import { describe, expect, it } from "vitest";
import { bestWindowForDay, expectedAtTable, rankBestDays, type BestDay } from "./bestWindow";
import type { HeatmapCell } from "./availabilityGrid";

const STEP = 30;

/** Cases d'un jour, de 10:00 (600) a 22:00 (1320), remplies d'apres des plages `[debut, fin)` par compte. */
function day(date: string, ranges: Record<string, [number, number]>): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  for (let slot = 600; slot < 1320; slot += STEP) {
    const userIds = Object.entries(ranges)
      .filter(([, [start, end]]) => start <= slot && end >= slot + STEP)
      .map(([userId]) => userId);
    cells.push({ date, slotStart: slot, userIds });
  }
  return cells;
}

describe("bestWindowForDay", () => {
  it("rend null quand personne n'est disponible ce jour-la", () => {
    expect(bestWindowForDay("2026-10-01", day("2026-10-01", {}), STEP)).toBeNull();
  });

  it("une seule personne : sa propre plage", () => {
    const best = bestWindowForDay("2026-10-11", day("2026-10-11", { gabriel: [600, 1320] }), STEP);
    expect(best).toEqual({ date: "2026-10-11", count: 1, start: 600, end: 1320, durationMinutes: 720, userIds: ["gabriel"], respondentCount: 1 });
  });

  it("prend la plage ou le plus de monde est present, pas l'intersection de tous", () => {
    // Quatre personnes de 14:00 a 22:00, une cinquieme le matin seulement :
    // l'ancienne regle (intersection de tous) donnait « aucun creneau commun ».
    const best = bestWindowForDay(
      "2026-10-24",
      day("2026-10-24", { a: [840, 1320], b: [840, 1320], c: [840, 1320], d: [840, 1320], matin: [600, 720] }),
      STEP
    );
    expect(best).toMatchObject({ count: 4, start: 840, end: 1320, durationMinutes: 480, respondentCount: 5 });
    expect(best?.userIds).toEqual(["a", "b", "c", "d"]);
  });

  it("a nombre egal, garde la plus longue plage", () => {
    const best = bestWindowForDay("2026-10-25", day("2026-10-25", { a: [600, 720], b: [600, 720], c: [900, 1200], d: [900, 1200] }), STEP);
    expect(best).toMatchObject({ count: 2, start: 900, end: 1200, durationMinutes: 300 });
    expect(best?.userIds).toEqual(["c", "d"]);
  });

  it("ne fusionne pas deux plages contigues de meme effectif mais de personnes differentes", () => {
    // a et b de 10:00 a 12:00, puis c et d de 12:00 a 15:00 : deux groupes
    // distincts, jamais une plage de 5 h annoncee « a deux ».
    const best = bestWindowForDay("2026-10-26", day("2026-10-26", { a: [600, 720], b: [600, 720], c: [720, 900], d: [720, 900] }), STEP);
    expect(best).toMatchObject({ count: 2, start: 720, end: 900, durationMinutes: 180 });
    expect(best?.userIds).toEqual(["c", "d"]);
  });

  it("tolere des cases dans le desordre", () => {
    const cells = day("2026-10-11", { a: [600, 900] }).reverse();
    expect(bestWindowForDay("2026-10-11", cells, STEP)).toMatchObject({ start: 600, end: 900 });
  });
});

describe("rankBestDays", () => {
  const best = (date: string, count: number, durationMinutes: number): BestDay => ({
    date,
    count,
    start: 600,
    end: 600 + durationMinutes,
    durationMinutes,
    userIds: [],
    respondentCount: count,
  });

  it("classe par nombre de presents, puis par duree, puis par date", () => {
    const ranked = rankBestDays([best("2026-10-31", 3, 240), best("2026-10-11", 5, 120), best("2026-10-24", 5, 480), best("2026-10-17", 3, 240)]);
    expect(ranked.map((d) => d.date)).toEqual(["2026-10-24", "2026-10-11", "2026-10-17", "2026-10-31"]);
  });
});

describe("expectedAtTable", () => {
  const members = [
    { user_id: "soso", role: "player" },
    { user_id: "leila", role: "player" },
    { user_id: "gabriel", role: "gm" },
    { user_id: "claude", role: "gm" },
  ];

  it("compte les joueuses et le MJ qui a ouvert la demande, pas un second MJ", () => {
    expect(expectedAtTable(members, "gabriel")).toEqual(["soso", "leila", "gabriel"]);
  });

  it("compte aussi un MJ qui a repondu sans avoir ouvert la demande", () => {
    expect(expectedAtTable(members, "gabriel", ["claude"])).toEqual(["soso", "leila", "gabriel", "claude"]);
  });

  it("ne compte jamais deux fois la meme personne", () => {
    expect(expectedAtTable(members, "soso", ["soso"])).toEqual(["soso", "leila"]);
  });
});
