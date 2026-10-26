import { describe, expect, it } from "vitest";
import { QUEST_STATES } from "@/src/core/schemas/blocks/quest";
import { anneau, objectifsAffiches, progression, prochain, teinteEtat } from "./quete";

const o = (id: string, done: boolean, text = id) => ({ id, text, done });

describe("progression", () => {
  it("compte les atteints sur le total, et l'angle de l'anneau", () => {
    const p = progression([o("a", true), o("b", true), o("c", false), o("d", false)]);
    expect(p).toMatchObject({ atteints: 2, total: 4, fraction: 0.5, angle: 180, complet: false });
  });
  it("sans objectif : 0 sur 0, anneau vide, jamais « complet »", () => {
    expect(progression([])).toEqual({ atteints: 0, total: 0, fraction: 0, angle: 0, complet: false });
  });
  it("tout atteint : anneau plein et complet", () => {
    expect(progression([o("a", true)])).toMatchObject({ fraction: 1, angle: 360, complet: true });
  });
});

describe("anneau", () => {
  it("trace la part de la circonférence, bornée entre 0 et 1", () => {
    const { circonference, trace } = anneau(0.25, 10);
    expect(circonference).toBeCloseTo(62.83, 1);
    expect(trace).toBeCloseTo(circonference / 4);
    expect(anneau(2, 10).trace).toBeCloseTo(circonference);
    expect(anneau(-1, 10).trace).toBe(0);
  });
});

describe("prochain", () => {
  it("le premier objectif non atteint, dans l'ordre", () => {
    expect(prochain([o("a", true, "Trouver la clé"), o("b", false, "Ouvrir la porte"), o("c", false, "Fuir")])).toEqual({
      cle: "suivant",
      texte: "Ouvrir la porte",
    });
  });
  it("tous atteints", () => {
    expect(prochain([o("a", true), o("b", true)])).toEqual({ cle: "tous" });
  });
  it("aucun objectif", () => {
    expect(prochain([])).toEqual({ cle: "aucun" });
  });
});

describe("teinteEtat", () => {
  it("En cours en ambre, Réussie en vert, Échouée en rouge, le reste neutre", () => {
    expect(teinteEtat("in_progress")).toBe("accent");
    expect(teinteEtat("succeeded")).toBe("success");
    expect(teinteEtat("failed")).toBe("danger");
    expect(teinteEtat("not_started")).toBe("muted");
    expect(teinteEtat("abandoned")).toBe("muted");
  });
  it("couvre les cinq états", () => {
    for (const e of QUEST_STATES) expect(teinteEtat(e)).toBeTruthy();
  });
});

describe("objectifsAffiches : l'anneau suit la case tout de suite", () => {
  const liste = [o("a", true, "A"), o("b", false, "B"), o("c", false, "C")];
  it("applique la case cochée avant la réponse du serveur : anneau et « Prochain » changent", () => {
    const vus = objectifsAffiches(liste, { b: true });
    expect(progression(vus).atteints).toBe(2);
    expect(prochain(vus)).toEqual({ cle: "suivant", texte: "C" });
  });
  it("décocher aussi", () => {
    expect(progression(objectifsAffiches(liste, { a: false })).atteints).toBe(0);
  });
  it("sans surcharge, la liste est inchangée", () => {
    expect(objectifsAffiches(liste, {})).toEqual(liste);
  });
});
