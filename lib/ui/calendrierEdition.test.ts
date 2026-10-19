import { describe, expect, it } from "vitest";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import {
  aDesModifications,
  calendrierValide,
  libellePas,
  reduireCalendrier,
} from "./calendrierEdition";

function calendrier(surcharge: Partial<CalendarConfigInput> = {}): CalendarConfigInput {
  return {
    months: [
      { name: "Vendémiaire", days: 30 },
      { name: "Brumaire", days: 30 },
      { name: "Frimaire", days: 30 },
    ],
    weekdays: [{ name: "Primidi" }, { name: "Duodi" }, { name: "Tridi" }],
    eras: [{ name: "Premier Âge", startYear: 0 }],
    currentDate: { year: 1492, month: 2, day: 14, precision: "day", end: null, label: null },
    weekdayEpoch: 0,
    ...surcharge,
  };
}

describe("mois", () => {
  it("raccourcir Brumaire à 10 jours le 14 ramène le jour actuel au 10", () => {
    const c = reduireCalendrier(calendrier(), { type: "moisDuree", index: 1, jours: 10 });
    expect(c.months[1].days).toBe(10);
    expect(c.currentDate).toMatchObject({ month: 2, day: 10, year: 1492 });
  });

  it("borne la durée de 1 à 60", () => {
    expect(reduireCalendrier(calendrier(), { type: "moisDuree", index: 0, jours: 0 }).months[0].days).toBe(1);
    expect(reduireCalendrier(calendrier(), { type: "moisDuree", index: 0, jours: 99 }).months[0].days).toBe(60);
  });

  it("supprimer le mois du jour actuel le ramène dans un mois qui existe", () => {
    const c = reduireCalendrier(calendrier({ currentDate: { year: 3, month: 3, day: 20, precision: "day", end: null, label: null } }), {
      type: "moisSupprimer",
      index: 2,
    });
    expect(c.months).toHaveLength(2);
    expect(c.currentDate).toMatchObject({ month: 2, day: 20 });
  });

  it("garde au moins un mois", () => {
    const seul = calendrier({ months: [{ name: "Un", days: 5 }] });
    expect(reduireCalendrier(seul, { type: "moisSupprimer", index: 0 })).toBe(seul);
  });

  it("ajoute un mois juste après le rang demandé, et plafonne à 24", () => {
    const c = reduireCalendrier(calendrier(), { type: "moisAjouterApres", index: 0, nom: "Nouveau" });
    expect(c.months.map((m) => m.name)).toEqual(["Vendémiaire", "Nouveau", "Brumaire", "Frimaire"]);
    const plein = calendrier({ months: Array.from({ length: 24 }, (_, i) => ({ name: `M${i}`, days: 30 })) });
    expect(reduireCalendrier(plein, { type: "moisAjouterApres", index: 0, nom: "X" })).toBe(plein);
  });

  it("déplace un mois, sans sortir des bornes", () => {
    const c = reduireCalendrier(calendrier(), { type: "moisDeplacer", index: 0, sens: 1 });
    expect(c.months.map((m) => m.name)).toEqual(["Brumaire", "Vendémiaire", "Frimaire"]);
    const base = calendrier();
    expect(reduireCalendrier(base, { type: "moisDeplacer", index: 0, sens: -1 })).toBe(base);
  });
});

describe("le jour actuel suit son mois, l'époque suit son jour de semaine", () => {
  // Le jour actuel est le 14 Brumaire (mois 2) ; l'époque est Primidi (0).
  it("monter ou descendre un mois emporte le jour actuel avec lui", () => {
    const monte = reduireCalendrier(calendrier(), { type: "moisDeplacer", index: 1, sens: -1 });
    expect(monte.months[0].name).toBe("Brumaire");
    expect(monte.currentDate).toMatchObject({ month: 1, day: 14 });
    const voisin = reduireCalendrier(calendrier(), { type: "moisDeplacer", index: 0, sens: 1 });
    expect(voisin.currentDate).toMatchObject({ month: 1, day: 14 });
  });
  it("ajouter ou supprimer un mois avant le jour actuel ne change pas son mois", () => {
    const ajoute = reduireCalendrier(calendrier(), { type: "moisAjouterApres", index: 0, nom: "Nouveau" });
    expect(ajoute.months[ajoute.currentDate!.month! - 1].name).toBe("Brumaire");
    const supprime = reduireCalendrier(calendrier(), { type: "moisSupprimer", index: 0 });
    expect(supprime.months[supprime.currentDate!.month! - 1].name).toBe("Brumaire");
  });
  it("décaler ou supprimer un jour de semaine garde le même jour au 1er de l'an 0", () => {
    const decale = reduireCalendrier(calendrier(), { type: "semaineDecaler", index: 0 });
    expect(decale.weekdays[decale.weekdayEpoch].name).toBe("Primidi");
    const tridi = calendrier({ weekdayEpoch: 2 });
    const supprime = reduireCalendrier(tridi, { type: "semaineSupprimer", index: 0 });
    expect(supprime.weekdays[supprime.weekdayEpoch].name).toBe("Tridi");
  });
});

describe("semaine", () => {
  it("décale un jour d'un rang, supprime et ajoute", () => {
    const c = reduireCalendrier(calendrier(), { type: "semaineDecaler", index: 0 });
    expect(c.weekdays.map((w) => w.name)).toEqual(["Duodi", "Primidi", "Tridi"]);
    const d = reduireCalendrier(calendrier(), { type: "semaineAjouter", nom: "Quartidi" });
    expect(d.weekdays).toHaveLength(4);
  });

  it("garde l'époque dans la semaine après une suppression", () => {
    const c = reduireCalendrier(calendrier({ weekdayEpoch: 2 }), { type: "semaineSupprimer", index: 2 });
    expect(c.weekdays).toHaveLength(2);
    expect(c.weekdayEpoch).toBe(0);
  });

  it("règle le jour de semaine du 1er jour de l'an 0", () => {
    expect(reduireCalendrier(calendrier(), { type: "epoque", index: 2 }).weekdayEpoch).toBe(2);
  });
});

describe("ères", () => {
  it("ajoute, renomme, change l'année de départ et supprime", () => {
    let c = reduireCalendrier(calendrier(), { type: "ereAjouter", nom: "Second Âge" });
    c = reduireCalendrier(c, { type: "ereDebut", index: 1, annee: 1000 });
    c = reduireCalendrier(c, { type: "ereRenommer", index: 1, nom: "Âge sombre" });
    expect(c.eras[1]).toEqual({ name: "Âge sombre", startYear: 1000 });
    c = reduireCalendrier(c, { type: "ereSupprimer", index: 0 });
    expect(c.eras).toHaveLength(1);
  });
});

describe("jour actuel", () => {
  it("lendemain du dernier jour de l'an passe à l'an suivant", () => {
    const fin = calendrier({ currentDate: { year: 5, month: 3, day: 30, precision: "day", end: null, label: null } });
    expect(reduireCalendrier(fin, { type: "jourDecaler", n: 1 }).currentDate).toMatchObject({ year: 6, month: 1, day: 1 });
  });

  it("veille du 1er jour de l'an 0 : dernier jour de l'an -1", () => {
    const debut = calendrier({ currentDate: { year: 0, month: 1, day: 1, precision: "day", end: null, label: null } });
    expect(reduireCalendrier(debut, { type: "jourDecaler", n: -1 }).currentDate).toMatchObject({ year: -1, month: 3, day: 30 });
  });

  it("règle une date et la recale sur le calendrier", () => {
    const c = reduireCalendrier(calendrier(), { type: "jourRegler", date: { year: 7, month: 9, day: 99 } });
    expect(c.currentDate).toMatchObject({ year: 7, month: 3, day: 30 });
  });

  it("repasse le jour actuel à « non réglé », et ne fait rien s'il ne l'est déjà", () => {
    expect(reduireCalendrier(calendrier(), { type: "jourEffacer" }).currentDate).toBeNull();
    const vide = calendrier({ currentDate: null });
    expect(reduireCalendrier(vide, { type: "jourEffacer" })).toBe(vide);
  });

  it("initialise le jour actuel à l'an 0, 1er jour du 1er mois", () => {
    const c = reduireCalendrier(calendrier({ currentDate: null }), { type: "jourInitialiser" });
    expect(c.currentDate).toMatchObject({ year: 0, month: 1, day: 1, precision: "day" });
  });

  it("sans jour actuel, une modification de mois n'en invente pas", () => {
    const c = reduireCalendrier(calendrier({ currentDate: null }), { type: "moisDuree", index: 0, jours: 5 });
    expect(c.currentDate).toBeNull();
  });
});

describe("libellePas", () => {
  it("décade, semaine ou N jours", () => {
    expect(libellePas(10)).toEqual({ cle: "pasDecade", n: 10 });
    expect(libellePas(7)).toEqual({ cle: "pasSemaine", n: 7 });
    expect(libellePas(8)).toEqual({ cle: "pasJours", n: 8 });
  });
});

describe("modifications et validité", () => {
  it("détecte une différence avec le calendrier enregistré", () => {
    const base = calendrier();
    expect(aDesModifications(base, calendrier())).toBe(false);
    expect(aDesModifications(base, reduireCalendrier(base, { type: "moisDuree", index: 0, jours: 31 }))).toBe(true);
  });

  it("refuse un nom vide", () => {
    expect(calendrierValide(calendrier())).toBe(true);
    expect(calendrierValide(reduireCalendrier(calendrier(), { type: "moisRenommer", index: 0, nom: "  " }))).toBe(false);
  });
});
