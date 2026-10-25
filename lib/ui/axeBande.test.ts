import { describe, expect, it } from "vitest";
import { TIMELINE_ENTRY_KINDS } from "@/src/core/schemas/blocks/timeline";
import { DEFAULT_CALENDAR } from "@/src/core/calendar/defaultCalendar";
import {
  anAuPourcent,
  calculerDomaine,
  marquesAxe,
  positionAujourdhui,
  positionnerEntrees,
  pourcent,
  segmentsEres,
  teinteGenre,
} from "./axeBande";

const point = (id: string, debut: number) => ({ id, debut, fin: null });

describe("calculerDomaine", () => {
  it("couvre tout ce qui est posé, avec une marge", () => {
    const d = calculerDomaine([point("a", 100), { id: "b", debut: 150, fin: 180 }], null);
    expect(d.min).toBeLessThan(100);
    expect(d.max).toBeGreaterThan(180);
  });
  it("inclut le jour actuel, même au-delà des événements", () => {
    const d = calculerDomaine([point("a", 100)], 300);
    expect(d.max).toBeGreaterThan(300);
  });
  it("sans rien, de 0 à 100 ; sans événement mais avec une date du jour, autour d'elle", () => {
    expect(calculerDomaine([], null)).toEqual({ min: 0, max: 100 });
    const d = calculerDomaine([], 1492);
    expect(d.min).toBeLessThan(1492);
    expect(d.max).toBeGreaterThan(1492);
  });
  it("donne une fenêtre à un événement seul", () => {
    const d = calculerDomaine([point("a", 50)], null);
    expect(d.max - d.min).toBeGreaterThan(0);
    expect(pourcent(50, d)).toBeCloseTo(50);
  });
});

describe("pourcent / anAuPourcent", () => {
  const d = { min: 100, max: 200 };
  it("projette sur 0-100 et revient", () => {
    expect(pourcent(100, d)).toBe(0);
    expect(pourcent(150, d)).toBe(50);
    expect(anAuPourcent(25, d)).toBe(125);
  });
  it("borne l'inverse aux bords de l'axe", () => {
    expect(anAuPourcent(-10, d)).toBe(100);
    expect(anAuPourcent(140, d)).toBe(200);
  });
});

describe("segmentsEres", () => {
  const eres = [
    { name: "Troisième Âge", startYear: 120 },
    { name: "Second Âge", startYear: 0 },
    { name: "Quatrième Âge", startYear: 400 },
  ];
  it("découpe chaque ère jusqu'à la suivante, rognée aux bords", () => {
    const s = segmentsEres(eres, { min: 50, max: 220 });
    expect(s.map((x) => x.nom)).toEqual(["Second Âge", "Troisième Âge"]);
    expect(s[0].gauche).toBe(0);
    expect(s[0].gauche + s[0].largeur).toBeCloseTo(pourcent(120, { min: 50, max: 220 }));
    expect(s[1].gauche + s[1].largeur).toBeCloseTo(100);
  });
  it("écarte une ère entièrement hors de l'axe, et ne trace rien sans ère", () => {
    expect(segmentsEres(eres, { min: 130, max: 200 }).map((x) => x.nom)).toEqual(["Troisième Âge"]);
    expect(segmentsEres([], { min: 0, max: 10 })).toEqual([]);
  });
});

describe("marquesAxe", () => {
  const d = { min: 0, max: 100 };
  it("sépare points et périodes", () => {
    const m = marquesAxe([point("a", 25), { id: "b", debut: 60, fin: 40 }], null, d);
    expect(m.points).toEqual([{ id: "a", gauche: 25 }]);
    expect(m.periodes).toEqual([{ id: "b", gauche: 40, largeur: 20 }]);
  });
  it("pose le trait doré à la date du jour, et pas de trait sans date", () => {
    expect(marquesAxe([], 80, d).aujourdhui).toBe(80);
    expect(marquesAxe([], null, d).aujourdhui).toBeNull();
  });
});

describe("avec le calendrier du monde", () => {
  it("le trait tombe sur la date du jour réglée, et les événements sur la leur", () => {
    const cal = DEFAULT_CALENDAR;
    const date = (year: number) => ({ year, month: 1, day: 1, precision: "day" as const, end: null, label: null });
    const entrees = positionnerEntrees(
      [{ id: "e1", date: date(10), kind: "war", title: "x", summary: "", visibility: { level: "public", scopeId: null } }],
      cal,
    );
    const auj = positionAujourdhui({ year: 30, month: 1, day: 1 }, cal);
    expect(auj).not.toBeNull();
    const d = calculerDomaine(entrees, auj);
    const m = marquesAxe(entrees, auj, d);
    expect(m.points[0].gauche).toBeLessThan(m.aujourdhui as number);
    expect(positionAujourdhui(null, cal)).toBeNull();
  });
});

describe("teinteGenre", () => {
  it("donne une teinte à chaque genre", () => {
    for (const k of TIMELINE_ENTRY_KINDS) expect(teinteGenre(k)).toBeTruthy();
    expect(teinteGenre("war")).toBe("danger");
    expect(teinteGenre("custom")).toBe("neutre");
  });
});
