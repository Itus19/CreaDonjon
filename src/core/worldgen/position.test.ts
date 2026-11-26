import { describe, expect, it } from "vitest";
import { archetypeParCle, type LifeArchetype } from "./archetypes";
import { position, type LifePerson } from "./position";

function archetype(cle: string): LifeArchetype {
  const a = archetypeParCle(cle);
  if (!a) throw new Error(`archétype absent : ${cle}`);
  return a;
}

const lieux = { home: "maison-1", tavern: "chaudron", market: "marche", street: "rue", temple: "temple", work: "atelier", barracks: "caserne" };

function personne(cle: string, seed = 42, extra: Partial<LifePerson> = {}): LifePerson {
  return { seed, archetype: archetype(cle), places: lieux, ...extra };
}

const UN_AN = 365;

describe("position (V3.2-29)", () => {
  it("même graine, même jour, même heure : même position, toujours", () => {
    for (const cle of ["pilier_de_bar", "garde", "malfrat", "artisan"]) {
      for (let jour = 0; jour < 40; jour++) {
        for (const heure of [3, 9, 15, 21]) {
          const moment = { day: jour, hour: heure, weekday: jour % 7, weekLength: 7 };
          expect(position(personne(cle, 7), moment)).toEqual(position(personne(cle, 7), moment));
        }
      }
    }
  });

  it("deux graines différentes ne vivent pas la même année", () => {
    const trace = (seed: number) => Array.from({ length: 60 }, (_, d) => JSON.stringify(position(personne("pilier_de_bar", seed), { day: d, hour: 20 }))).join();
    expect(trace(1)).not.toEqual(trace(2));
  });

  it("un pilier de bar est à la taverne environ 8 soirs sur 10 sur un an", () => {
    for (const seed of [1, 2, 3]) {
      let soirs = 0;
      for (let jour = 0; jour < UN_AN; jour++) {
        const p = position(personne("pilier_de_bar", seed), { day: jour, hour: 20 });
        if (p.kind === "place" && p.where === "tavern") soirs++;
      }
      expect(soirs / UN_AN).toBeGreaterThan(0.72);
      expect(soirs / UN_AN).toBeLessThan(0.88);
    }
  });

  it("chez soi la nuit, au lieu de sa routine : la clé du lieu de la personne", () => {
    const p = position(personne("pilier_de_bar"), { day: 0, hour: 4 });
    expect(p).toEqual({ kind: "place", where: "home", placeKey: "maison-1", reason: "routine" });
  });

  it("un garde suit ses tours sur trois jours", () => {
    for (const seed of [5, 6, 7]) {
      const garde = personne("garde", seed);
      const enService = Array.from({ length: 60 }, (_, d) => {
        const p = position(garde, { day: d, hour: 10 });
        return p.kind === "place" && p.where === "street";
      });
      const phase = enService.indexOf(true);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(3);
      enService.forEach((oui, d) => expect(oui).toBe((d - phase) % 3 === 0));
    }
  });

  it("un garde de nuit reste à la caserne après minuit, le créneau de la veille continue", () => {
    const garde = personne("garde", 5);
    const nuits = Array.from({ length: 30 }, (_, d) => d).filter((d) => {
      const p = position(garde, { day: d, hour: 23 });
      return p.kind === "place" && p.where === "barracks";
    });
    expect(nuits.length).toBeGreaterThan(5);
    for (const d of nuits) expect(position(garde, { day: d + 1, hour: 3 })).toMatchObject({ kind: "place", where: "barracks" });
  });

  it("un voyageur hors de son séjour n'est pas en ville, et y est pendant", () => {
    const voyageur = personne("voyageur", 9, { stay: { fromDay: 10, toDay: 13 } });
    expect(position(voyageur, { day: 9, hour: 20 })).toEqual({ kind: "away", reason: "stay" });
    expect(position(voyageur, { day: 13, hour: 9 })).toEqual({ kind: "away", reason: "stay" });
    expect(position(voyageur, { day: 11, hour: 3 })).toMatchObject({ kind: "place", where: "home" });
  });

  it("un agenda l'emporte sur la routine", () => {
    const agenda = [{ from: { day: 3, hour: 18 }, to: { day: 3, hour: 22 }, where: "temple-de-l-aube", reason: "veillée" }];
    const p = position(personne("pilier_de_bar", 1, { agenda }), { day: 3, hour: 20 });
    expect(p).toEqual({ kind: "place", where: null, placeKey: "temple-de-l-aube", reason: "agenda" });
    expect(position(personne("pilier_de_bar", 1, { agenda }), { day: 3, hour: 22 }).reason).not.toBe("agenda");
  });

  it("un agenda l'emporte sur le séjour", () => {
    const p = position(personne("voyageur", 9, { stay: { fromDay: 10, toDay: 13 }, agenda: [{ from: { day: 9, hour: 12 }, to: { day: 9, hour: 14 }, where: "marche", reason: "arrive tôt" }] }), { day: 9, hour: 13 });
    expect(p.reason).toBe("agenda");
  });

  it("un état l'emporte sur l'agenda", () => {
    const extra = {
      agenda: [{ from: { day: 3, hour: 0 }, to: { day: 4, hour: 0 }, where: "marche", reason: "foire" }],
      conditions: [{ kind: "prison" as const, from: { day: 2, hour: 12 } }],
    };
    expect(position(personne("marchand_etabli", 1, extra), { day: 3, hour: 10 })).toEqual({ kind: "place", where: "prison", placeKey: null, reason: "condition" });
  });

  it("chaque état a sa place : blessé chez soi, en fuite hors de la ville, et il prend fin", () => {
    const blesse = personne("pilier_de_bar", 1, { conditions: [{ kind: "injured", from: { day: 0, hour: 0 }, to: { day: 5, hour: 0 } }] });
    expect(position(blesse, { day: 2, hour: 20 })).toEqual({ kind: "place", where: "home", placeKey: "maison-1", reason: "condition" });
    expect(position(blesse, { day: 5, hour: 4 }).reason).toBe("routine");
    const enFuite = personne("pilier_de_bar", 1, { conditions: [{ kind: "fled", from: { day: 0, hour: 0 } }] });
    expect(position(enFuite, { day: 100, hour: 20 })).toEqual({ kind: "away", reason: "condition" });
  });

  it("la mort l'emporte sur tout", () => {
    const morte = personne("pilier_de_bar", 1, {
      diedAt: { day: 4, hour: 6 },
      agenda: [{ from: { day: 5, hour: 0 }, to: { day: 6, hour: 0 }, where: "marche", reason: "foire" }],
      conditions: [{ kind: "prison", from: { day: 0, hour: 0 } }],
    });
    expect(position(morte, { day: 5, hour: 10 })).toEqual({ kind: "dead", reason: "dead" });
    expect(position(morte, { day: 4, hour: 5 }).reason).toBe("condition");
  });

  it("un artisan travaille les jours ouvrés et chôme le dernier jour de la semaine", () => {
    let ouvres = 0;
    let atelierLeJourDeRepos = 0;
    for (let jour = 0; jour < 140; jour++) {
      const weekday = jour % 7;
      const p = position(personne("artisan", 3), { day: jour, hour: 11, weekday, weekLength: 7 });
      const aLAtelier = p.kind === "place" && p.where === "work";
      if (weekday === 6 && aLAtelier) atelierLeJourDeRepos++;
      if (weekday !== 6 && aLAtelier) ouvres++;
    }
    expect(atelierLeJourDeRepos).toBe(0);
    expect(ouvres).toBeGreaterThan(100);
  });

  it("sans semaine connue, tous les jours sont ouvrés", () => {
    const p = position(personne("artisan", 3, { archetype: { ...archetype("artisan"), absence_days_per_10: 0 } }), { day: 6, hour: 11 });
    expect(p).toMatchObject({ kind: "place", where: "work" });
  });

  it("un lieu que la personne n'a pas donne une clé nulle", () => {
    const p = position({ seed: 1, archetype: archetype("pilier_de_bar"), places: {} }, { day: 0, hour: 4 });
    expect(p).toEqual({ kind: "place", where: "home", placeKey: null, reason: "routine" });
  });

  it("la teinte de la psyché change les probabilités, bornée", () => {
    const compter = (tint: LifePerson["tint"]) => {
      let n = 0;
      for (let jour = 0; jour < UN_AN; jour++) {
        const p = position(personne("pilier_de_bar", 1, { tint }), { day: jour, hour: 20 });
        if (p.kind === "place" && p.where === "tavern") n++;
      }
      return n;
    };
    const neutre = compter(undefined);
    const casanier = compter({ tavern: -5 });
    expect(casanier).toBeLessThan(neutre);
    expect(casanier / UN_AN).toBeGreaterThan(0.5);
  });

  it("refuse une heure hors de 0 à 23", () => {
    expect(() => position(personne("garde"), { day: 0, hour: 24 })).toThrow(RangeError);
  });
});
