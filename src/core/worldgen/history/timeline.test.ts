import { describe, expect, it } from "vitest";
import { chronicleToTimelineEntries } from "./timeline";
import { simulateHistory } from "./simulate";
import { MONDE_ESSAI } from "./mondeEssai";
import { zTimelineEntry } from "../../schemas/blocks/timeline";

describe("chronicleToTimelineEntries", () => {
  const chronicle = simulateHistory(MONDE_ESSAI, { years: 300 });
  const entries = chronicleToTimelineEntries(chronicle, MONDE_ESSAI);

  it("rend une entrée de frise valide par événement", () => {
    expect(entries).toHaveLength(chronicle.events.length);
    for (const e of entries) expect(() => zTimelineEntry.parse(e)).not.toThrow();
  });

  it("donne des identifiants stables et distincts", () => {
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    expect(chronicleToTimelineEntries(chronicle, MONDE_ESSAI).map((e) => e.id)).toEqual(entries.map((e) => e.id));
  });

  it("garde l'histoire générée pour le MJ : elle se découvre, elle ne s'affiche pas d'office", () => {
    for (const e of entries) expect(e.visibility).toEqual({ level: "gm", scopeId: null });
  });

  it("titre la fondation d'une capitale avec son État, en portée majeure", () => {
    const hornver = entries.find((e) => e.id === "history:founding:v-hornver");
    expect(hornver).toMatchObject({ kind: "founding", title: "Fondation de Hornver, capitale de Grania", scope: "major" });
  });

  it("met la fondation d'un bourg en détail et celle d'une ville en notable", () => {
    expect(entries.find((e) => e.id === "history:founding:v-pellemont")?.scope).toBe("detail");
    expect(entries.find((e) => e.id === "history:founding:v-berton")?.scope).toBe("notable");
  });

  it("date une guerre sur sa durée et garde son nom imposé", () => {
    const guerre = entries.find((e) => e.title === "Guerre de la Frontière");
    expect(guerre).toMatchObject({ kind: "war", scope: "major" });
    expect(guerre?.date).toMatchObject({ year: 349, precision: "year", end: { year: 351, month: null, day: null } });
  });

  it("nomme une guerre inventée par ses camps", () => {
    const inventee = chronicleToTimelineEntries(
      { ...chronicle, events: [{ kind: "war", year: 120, endYear: 124, attackers: ["s-grania"], defenders: ["s-vriia"], name: null, imposed: false }] },
      MONDE_ESSAI
    );
    expect(inventee[0].title).toBe("Guerre entre Grania et Vriia");
  });

  it("écrit la fin d'un règne sans genre, avec l'ordinal français", () => {
    const fin = chronicleToTimelineEntries(
      {
        ...chronicle,
        events: [
          { kind: "ruler_death", year: 100, stateId: "s-grania", rulerOrdinal: 1 },
          { kind: "ruler_death", year: 130, stateId: "s-grania", rulerOrdinal: 2 },
        ],
      },
      MONDE_ESSAI
    );
    expect(fin.map((e) => e.title)).toEqual(["Fin du 1er règne de Grania", "Fin du 2e règne de Grania"]);
    expect(fin[0]).toMatchObject({ kind: "death", scope: "notable" });
  });
});
