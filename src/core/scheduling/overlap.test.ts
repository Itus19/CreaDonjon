import { describe, expect, it } from "vitest";
import { classifySession, computeOverlap, rankDays, timeToMinutes, minutesToTime, type DayCandidate } from "./overlap";

describe("timeToMinutes / minutesToTime", () => {
  it("convertit heure:minute en minutes depuis minuit", () => {
    expect(timeToMinutes("19:00")).toBe(1140);
    expect(timeToMinutes("00:30")).toBe(30);
  });
  it("fait l'aller-retour", () => {
    expect(minutesToTime(timeToMinutes("23:45"))).toBe("23:45");
  });
});

describe("computeOverlap", () => {
  it("retourne l'intersection de deux plages qui se chevauchent", () => {
    const result = computeOverlap([
      { userId: "a", startsAt: 19 * 60, endsAt: 23 * 60 },
      { userId: "b", startsAt: 20 * 60, endsAt: 24 * 60 },
    ]);
    expect(result).toEqual({ start: 20 * 60, end: 23 * 60, durationMinutes: 180 });
  });

  it("retourne l'intersection de trois plages (le plus tard des debuts, le plus tot des fins)", () => {
    const result = computeOverlap([
      { userId: "a", startsAt: 18 * 60, endsAt: 23 * 60 },
      { userId: "b", startsAt: 19 * 60, endsAt: 22 * 60 },
      { userId: "c", startsAt: 18 * 60 + 30, endsAt: 23 * 60 },
    ]);
    expect(result).toEqual({ start: 19 * 60, end: 22 * 60, durationMinutes: 180 });
  });

  it("retourne une duree nulle (pas negative) quand les plages ne se touchent pas", () => {
    const result = computeOverlap([
      { userId: "a", startsAt: 10 * 60, endsAt: 12 * 60 },
      { userId: "b", startsAt: 14 * 60, endsAt: 16 * 60 },
    ]);
    expect(result?.durationMinutes).toBe(0);
  });

  it("retourne null pour une liste vide", () => {
    expect(computeOverlap([])).toBeNull();
  });

  it("une seule joueuse : l'intersection est sa propre plage", () => {
    const result = computeOverlap([{ userId: "a", startsAt: 19 * 60, endsAt: 23 * 60 }]);
    expect(result).toEqual({ start: 19 * 60, end: 23 * 60, durationMinutes: 240 });
  });
});

describe("classifySession", () => {
  it("complete quand l'intersection couvre au moins la duree cible", () => {
    expect(classifySession(300, 300)).toBe("full");
    expect(classifySession(360, 300)).toBe("full");
  });
  it("raccourcie quand l'intersection est positive mais sous la cible", () => {
    expect(classifySession(240, 300)).toBe("short");
  });
  it("aucune quand l'intersection est nulle ou negative", () => {
    expect(classifySession(0, 300)).toBe("none");
  });
});

describe("rankDays", () => {
  function day(partial: Partial<DayCandidate> & { date: string }): DayCandidate {
    return {
      date: partial.date,
      participantCount: partial.participantCount ?? 4,
      totalMembers: partial.totalMembers ?? 4,
      overlap: partial.overlap ?? { start: 19 * 60, end: 24 * 60, durationMinutes: 300 },
      category: partial.category ?? "full",
    };
  }

  it("classe les sessions completes avant les raccourcies, avant aucune", () => {
    const ranked = rankDays([
      day({ date: "2026-09-10", category: "none", overlap: { start: 0, end: 0, durationMinutes: 0 } }),
      day({ date: "2026-09-05", category: "full" }),
      day({ date: "2026-09-12", category: "short", overlap: { start: 19 * 60, end: 23 * 60, durationMinutes: 240 } }),
    ]);
    expect(ranked.map((d) => d.date)).toEqual(["2026-09-05", "2026-09-12", "2026-09-10"]);
  });

  it("a categorie egale, favorise le plus de participantes", () => {
    const ranked = rankDays([
      day({ date: "2026-09-05", participantCount: 2 }),
      day({ date: "2026-09-12", participantCount: 4 }),
    ]);
    expect(ranked.map((d) => d.date)).toEqual(["2026-09-12", "2026-09-05"]);
  });

  it("a categorie et participantes egales, favorise la plus longue duree", () => {
    const ranked = rankDays([
      day({ date: "2026-09-05", category: "short", overlap: { start: 0, end: 0, durationMinutes: 120 } }),
      day({ date: "2026-09-12", category: "short", overlap: { start: 0, end: 0, durationMinutes: 240 } }),
    ]);
    expect(ranked.map((d) => d.date)).toEqual(["2026-09-12", "2026-09-05"]);
  });
});
