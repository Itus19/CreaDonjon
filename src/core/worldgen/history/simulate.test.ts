import { describe, expect, it } from "vitest";
import { simulateHistory, type HistoryEvent } from "./simulate";
import { MONDE_ESSAI } from "./mondeEssai";
import type { AbstractWorld } from "../world";

const foundings = (events: readonly HistoryEvent[]) => events.filter((e) => e.kind === "founding");

describe("simulateHistory — couche 1", () => {
  it("rend la même chronique pour le même monde", () => {
    expect(simulateHistory(MONDE_ESSAI, { years: 300 })).toEqual(simulateHistory(MONDE_ESSAI, { years: 300 }));
  });

  it("change de chronique quand la graine du monde change", () => {
    const a = simulateHistory(MONDE_ESSAI, { years: 300 });
    const b = simulateHistory({ ...MONDE_ESSAI, seed: 7 }, { years: 300 });
    expect(b.events).not.toEqual(a.events);
  });

  it("couvre la période demandée et range les événements par année", () => {
    const c = simulateHistory(MONDE_ESSAI, { years: 300 });
    expect(c.startYear).toBe(54);
    expect(c.presentYear).toBe(354);
    const years = c.events.map((e) => e.year);
    expect(years).toEqual([...years].sort((x, y) => x - y));
    for (const y of years) {
      expect(y).toBeGreaterThanOrEqual(54);
      expect(y).toBeLessThanOrEqual(354);
    }
  });

  it("fonde chaque ville une seule fois, avant le présent", () => {
    const c = simulateHistory(MONDE_ESSAI, { years: 300 });
    const ids = foundings(c.events).map((e) => (e.kind === "founding" ? e.siteId : ""));
    expect(ids.sort()).toEqual(MONDE_ESSAI.sites.map((s) => s.id).sort());
    for (const e of foundings(c.events)) expect(e.year).toBeLessThan(354);
  });

  it("fonde la capitale d'un État avant ses autres villes, et la marque comme naissance de l'État", () => {
    for (let seed = 0; seed < 30; seed++) {
      const c = simulateHistory({ ...MONDE_ESSAI, seed }, { years: 300 });
      const year = (siteId: string) => foundings(c.events).find((e) => e.kind === "founding" && e.siteId === siteId)?.year ?? NaN;
      expect(year("v-hornver")).toBeLessThan(year("v-berton"));
      expect(year("v-ostral")).toBeLessThan(year("v-pellemont"));
      const capitale = foundings(c.events).find((e) => e.kind === "founding" && e.siteId === "v-hornver");
      expect(capitale).toMatchObject({ stateId: "s-grania", isStateFounding: true });
    }
  });

  it("garde la guerre imposée telle quelle", () => {
    const c = simulateHistory(MONDE_ESSAI, { years: 300 });
    expect(c.events).toContainEqual({
      kind: "war",
      year: 349,
      endYear: 351,
      attackers: ["s-vriia"],
      defenders: ["s-grania"],
      name: "Guerre de la Frontière",
      imposed: true,
    });
  });

  it("n'invente des guerres qu'entre États voisins déjà fondés, finies avant le présent et sans chevaucher une autre guerre de la même paire", () => {
    for (let seed = 0; seed < 30; seed++) {
      const c = simulateHistory({ ...MONDE_ESSAI, seed }, { years: 600 });
      const foundedAt = (stateId: string) =>
        foundings(c.events).find((e) => e.kind === "founding" && e.isStateFounding && e.stateId === stateId)?.year ?? Infinity;
      const wars = c.events.filter((e) => e.kind === "war");
      for (const w of wars) {
        if (w.kind !== "war") continue;
        for (const s of [...w.attackers, ...w.defenders]) expect(foundedAt(s)).toBeLessThanOrEqual(w.year);
        if (!w.imposed) expect(w.endYear).toBeLessThan(354);
      }
      const sorted = wars.flatMap((w) => (w.kind === "war" ? [w] : [])).sort((a, b) => a.year - b.year);
      for (let i = 1; i < sorted.length; i++) expect(sorted[i].year).toBeGreaterThan(sorted[i - 1].endYear ?? Infinity);
    }
  });

  it("n'invente aucune guerre pour un État sans voisin", () => {
    const isole: AbstractWorld = { ...MONDE_ESSAI, links: [], anchors: [] };
    const c = simulateHistory(isole, { years: 600 });
    expect(c.events.filter((e) => e.kind === "war")).toEqual([]);
  });

  it("enchaîne les règnes de chaque État, numérotés à partir de 1, après sa fondation", () => {
    const c = simulateHistory(MONDE_ESSAI, { years: 300 });
    for (const state of MONDE_ESSAI.states) {
      const deaths = c.events.flatMap((e) => (e.kind === "ruler_death" && e.stateId === state.id ? [e] : []));
      expect(deaths.length).toBeGreaterThan(0);
      expect(deaths.map((d) => d.rulerOrdinal)).toEqual(deaths.map((_, i) => i + 1));
      for (let i = 1; i < deaths.length; i++) expect(deaths[i].year - deaths[i - 1].year).toBeGreaterThanOrEqual(5);
    }
  });

  it("fonde un État avant sa première guerre imposée, même si elle est très ancienne", () => {
    const ancienne: AbstractWorld = {
      ...MONDE_ESSAI,
      anchors: [{ ...MONDE_ESSAI.anchors[0], startYear: 60, endYear: 62 }],
    };
    const c = simulateHistory(ancienne, { years: 300 });
    const vriia = foundings(c.events).find((e) => e.kind === "founding" && e.siteId === "v-ostral");
    expect(vriia?.year).toBeLessThan(60);
  });

  it("laisse de côté une guerre imposée plus ancienne que la période simulée", () => {
    const c = simulateHistory({ ...MONDE_ESSAI, anchors: [{ ...MONDE_ESSAI.anchors[0], startYear: 10, endYear: 12 }] }, { years: 300 });
    expect(c.events.some((e) => e.kind === "war" && e.imposed)).toBe(false);
  });

  it("respecte le plafond d'événements en gardant les fondations d'États et les guerres imposées", () => {
    const c = simulateHistory(MONDE_ESSAI, { years: 1000, maxEvents: 6 });
    expect(c.events).toHaveLength(6);
    expect(c.dropped).toBeGreaterThan(0);
    expect(c.events.filter((e) => e.kind === "founding" && e.isStateFounding)).toHaveLength(2);
    expect(c.events.some((e) => e.kind === "war" && e.imposed)).toBe(true);
  });

  it("refuse une durée hors de 10 à 2 000 ans", () => {
    expect(() => simulateHistory(MONDE_ESSAI, { years: 5 })).toThrow(RangeError);
    expect(() => simulateHistory(MONDE_ESSAI, { years: 5000 })).toThrow(RangeError);
  });
});
