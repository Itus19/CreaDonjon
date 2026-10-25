import { describe, expect, it } from "vitest";
import { RELATIONSHIP_AXIS_KEYS } from "@/src/core/psyche/keys";
import type { GameDate } from "@/src/core/calendar/types";
import { axesAffiches, deuxDerniersSouvenirs, ligneJournal, portionFil, positionPerle, prenom, resumeEnDirect } from "./relationFace";

describe("axesAffiches", () => {
  it("une personne montre les sept axes", () => {
    expect(axesAffiches("character")).toEqual([...RELATIONSHIP_AXIS_KEYS]);
  });
  it("une faction, un lieu, une créature, ou rien : pas d'Attirance, les six autres dans l'ordre", () => {
    for (const genre of ["faction", "location", "creature", "other", null, undefined]) {
      const axes = axesAffiches(genre);
      expect(axes).toHaveLength(6);
      expect(axes).not.toContain("attraction_repulsion");
      expect(axes[0]).toBe("trust_distrust");
    }
  });
});

describe("deuxDerniersSouvenirs", () => {
  const evt = (id: string, deltas: Record<string, number>) => ({
    id,
    summary: `souvenir ${id}`,
    deltas,
    occurred_at_ingame: null,
    created_at: `2026-01-0${id}T00:00:00Z`,
  });
  // Du plus récent au plus ancien.
  const liste = [evt("5", { fear_assurance: 10 }), evt("4", { trust_distrust: 35 }), evt("3", { trust_distrust: -5, fear_assurance: 5 }), evt("2", { trust_distrust: 0 }), evt("1", { trust_distrust: 20 })];

  it("prend les deux plus récents qui ont touché l'axe, avec leur écart brut", () => {
    const r = deuxDerniersSouvenirs(liste, "trust_distrust");
    expect(r.map((s) => [s.id, s.delta])).toEqual([["4", 35], ["3", -5]]);
  });
  it("un seul, ou aucun, quand l'axe n'a pas plus de souvenirs", () => {
    expect(deuxDerniersSouvenirs(liste, "fear_assurance")).toHaveLength(2);
    expect(deuxDerniersSouvenirs(liste, "respect_contempt")).toEqual([]);
    expect(deuxDerniersSouvenirs([], "trust_distrust")).toEqual([]);
  });
  it("ignore un écart nul", () => {
    expect(deuxDerniersSouvenirs([evt("2", { trust_distrust: 0 })], "trust_distrust")).toEqual([]);
  });
});

describe("ligneJournal", () => {
  const enJeu = (d: GameDate) => `an ${d.year}`;
  const reelle = (iso: string) => `le ${iso.slice(0, 10)}`;
  const date: GameDate = { year: 1492, month: 10, day: 7, precision: "day", end: null, label: null };

  it("aucun souvenir", () => {
    expect(ligneJournal({ count: 0, last: null }, enJeu, reelle)).toEqual({ cle: "aucun" });
  });
  it("le nombre vient du serveur ; la date en jeu passe par le calendrier du monde", () => {
    expect(ligneJournal({ count: 5, last: { occurredAtIngame: date, createdAt: "2026-02-03T00:00:00Z" } }, enJeu, reelle)).toEqual({
      cle: "dernier",
      n: 5,
      date: "an 1492",
    });
  });
  it("sans date en jeu (ou une valeur qui n'en est pas une), la date réelle", () => {
    const attendu = { cle: "dernier", n: 2, date: "le 2026-02-03" };
    expect(ligneJournal({ count: 2, last: { occurredAtIngame: null, createdAt: "2026-02-03T00:00:00Z" } }, enJeu, reelle)).toEqual(attendu);
    expect(ligneJournal({ count: 2, last: { occurredAtIngame: { oups: 1 }, createdAt: "2026-02-03T00:00:00Z" } }, enJeu, reelle)).toEqual(attendu);
  });
});

describe("portionFil", () => {
  it("positif : verte, à droite du milieu", () => {
    expect(portionFil(50)).toEqual({ cote: "droite", couleur: "success", debut: 50, largeur: 25 });
  });
  it("négatif : rouge, à gauche du milieu", () => {
    expect(portionFil(-50)).toEqual({ cote: "gauche", couleur: "danger", debut: 25, largeur: 25 });
  });
  it("neutre : rien à colorer", () => {
    expect(portionFil(0)).toEqual({ cote: null, couleur: null, debut: 50, largeur: 0 });
  });
  it("aux extrêmes, la portion va jusqu'au bord", () => {
    expect(portionFil(100)).toMatchObject({ debut: 50, largeur: 50 });
    expect(portionFil(-100)).toMatchObject({ debut: 0, largeur: 50 });
  });
});

describe("positionPerle", () => {
  it("suit la valeur, sans sortir du fil", () => {
    expect(positionPerle(0)).toBe(50);
    expect(positionPerle(40)).toBe(70);
    expect(positionPerle(-100)).toBe(12);
    expect(positionPerle(100)).toBe(88);
  });
});

describe("prenom", () => {
  it("garde le premier mot, ou le nom entier s'il n'a qu'un mot", () => {
    expect(prenom("Sildar Hallwinter")).toBe("Sildar");
    expect(prenom("  Gundren   Rochebrune ")).toBe("Gundren");
    expect(prenom("Alliance")).toBe("Alliance");
    expect(prenom("")).toBe("");
  });
});

describe("resumeEnDirect", () => {
  const affiches = axesAffiches("character");
  it("change pendant le glissé, avant tout enregistrement", () => {
    expect(resumeEnDirect({ trust_distrust: 10 }, {}, affiches)).toBe("rien de marquant");
    expect(resumeEnDirect({ trust_distrust: 10 }, { trust_distrust: 80 }, affiches)).toBe("aveugle");
  });
  it("ne compte que les axes affichés : l'Attirance d'une faction n'entre pas dans le résumé", () => {
    const factions = axesAffiches("faction");
    expect(resumeEnDirect({ attraction_repulsion: 90 }, {}, factions)).toBe("rien de marquant");
    expect(resumeEnDirect({ attraction_repulsion: 90 }, {}, affiches)).toBe("épris");
  });
});
