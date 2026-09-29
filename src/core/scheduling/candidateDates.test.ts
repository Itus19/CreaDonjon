import { describe, expect, it } from "vitest";
import { expandWeekdayPattern } from "./candidateDates";

describe("expandWeekdayPattern", () => {
  it("retourne toutes les dates d'un seul jour de semaine dans la fenetre", () => {
    // mardi 6 octobre 2026, un seul mardi vise sur une semaine
    const result = expandWeekdayPattern([1], "2026-10-05", "2026-10-11");
    expect(result).toEqual(["2026-10-06"]);
  });

  it("retourne plusieurs jours de semaine sur plusieurs occurrences", () => {
    // mardi (1) et jeudi (3) du 2026-09-30 (mercredi) au 2026-10-11 (dimanche)
    const result = expandWeekdayPattern([1, 3], "2026-09-30", "2026-10-11");
    expect(result).toEqual(["2026-10-01", "2026-10-06", "2026-10-08"]);
  });

  it("inclut les bornes de la fenetre si elles correspondent", () => {
    // lundi 2026-10-05 au dimanche 2026-10-11, weekday lundi=0
    const result = expandWeekdayPattern([0, 6], "2026-10-05", "2026-10-11");
    expect(result).toEqual(["2026-10-05", "2026-10-11"]);
  });

  it("renvoie un tableau vide si aucun jour de semaine ne correspond dans la fenetre", () => {
    const result = expandWeekdayPattern([0], "2026-10-06", "2026-10-06");
    expect(result).toEqual([]);
  });

  it("renvoie un tableau vide si la fenetre est inversee", () => {
    const result = expandWeekdayPattern([0, 1, 2, 3, 4, 5, 6], "2026-10-11", "2026-10-05");
    expect(result).toEqual([]);
  });

  it("deduplique et trie les jours de semaine en entree", () => {
    const result = expandWeekdayPattern([3, 1, 1], "2026-09-30", "2026-10-11");
    expect(result).toEqual(["2026-10-01", "2026-10-06", "2026-10-08"]);
  });
});
