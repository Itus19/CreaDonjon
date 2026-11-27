import { describe, expect, it } from "vitest";
import { campsDuCombat, type PresentAuCombat } from "./combatCamps";

const pj = "pj";
const mabelle = "mabelle";

function present(id: string, extra: Partial<PresentAuCombat> = {}): PresentAuCombat {
  return { id, zone: "near", archetype: null, envers: {}, ...extra };
}

describe("campsDuCombat (ADR 0121, point 2)", () => {
  it("l'agresseur et sa cible sont toujours chacun de leur côté", () => {
    const camps = campsDuCombat({ agresseurId: pj, cibleId: mabelle, presents: [present(mabelle, { zone: "engaged" })], juridictionGarde: false, graine: "t" });
    expect(camps.agresseurs).toEqual([pj]);
    expect(camps.defenseurs).toEqual([mabelle]);
    expect(camps.horsCombat).toEqual([]);
  });

  it("un proche fortement lié à la cible la défend ; un ami de l'agresseur le suit", () => {
    const camps = campsDuCombat({
      agresseurId: pj,
      cibleId: mabelle,
      presents: [
        present(mabelle),
        present("wil", { envers: { [mabelle]: { amitie: 50 } } }),
        present("compagnon", { envers: { [pj]: { amitie: 70 } } }),
        present("creancier", { envers: { [mabelle]: { dette: 40 } } }),
      ],
      juridictionGarde: false,
      graine: "t",
    });
    expect(camps.defenseurs).toEqual([mabelle, "wil", "creancier"]);
    expect(camps.agresseurs).toEqual([pj, "compagnon"]);
  });

  it("un lien seulement « cordial » ne suffit pas à entrer dans le combat", () => {
    const camps = campsDuCombat({ agresseurId: pj, cibleId: mabelle, presents: [present(mabelle), present("habitue", { envers: { [mabelle]: { amitie: 20 } } })], juridictionGarde: false, graine: "t" });
    expect(camps.defenseurs).toEqual([mabelle]);
    expect(camps.horsCombat.map((h) => h.id)).toEqual(["habitue"]);
  });

  it("un garde de la juridiction rejoint le défenseur, quelle que soit son humeur", () => {
    const camps = campsDuCombat({
      agresseurId: pj,
      cibleId: mabelle,
      presents: [present(mabelle), present("ourse", { archetype: "garde", envers: { [mabelle]: { amitie: -50 } } })],
      juridictionGarde: true,
      graine: "t",
    });
    expect(camps.defenseurs).toEqual([mabelle, "ourse"]);
  });

  it("hors de sa juridiction, un garde suit ses liens comme tout le monde", () => {
    const camps = campsDuCombat({ agresseurId: pj, cibleId: mabelle, presents: [present(mabelle), present("ourse", { archetype: "garde" })], juridictionGarde: false, graine: "t" });
    expect(camps.horsCombat.map((h) => h.id)).toEqual(["ourse"]);
  });

  it("quand un garde frappe, les gardes le suivent", () => {
    const camps = campsDuCombat({
      agresseurId: "ourse",
      cibleId: pj,
      presents: [present("ourse", { archetype: "garde" }), present("collegue", { archetype: "garde" })],
      juridictionGarde: true,
      graine: "t",
    });
    expect(camps.agresseurs).toEqual(["ourse", "collegue"]);
    expect(camps.defenseurs).toEqual([pj]);
  });

  it("un enfant ou un vieillard reste hors du combat, même très attaché", () => {
    const camps = campsDuCombat({
      agresseurId: pj,
      cibleId: mabelle,
      presents: [present(mabelle), present("wil", { archetype: "enfant", envers: { [mabelle]: { amitie: 90 } } }), present("aieul", { archetype: "vieillard", envers: { [mabelle]: { amitie: 90 } } })],
      juridictionGarde: false,
      graine: "t",
    });
    expect(camps.defenseurs).toEqual([mabelle]);
    expect(camps.horsCombat.map((h) => h.id)).toEqual(["wil", "aieul"]);
  });

  it("la peur de l'adversaire retient un proche réfléchi, pas un impulsif", () => {
    const camps = campsDuCombat({
      agresseurId: pj,
      cibleId: mabelle,
      presents: [
        present(mabelle),
        present("reflechi", { impulsivite: -40, envers: { [mabelle]: { amitie: 60 }, [pj]: { peur: 50 } } }),
        present("impulsif", { impulsivite: 60, envers: { [mabelle]: { amitie: 60 }, [pj]: { peur: 50 } } }),
        present("terrifie", { impulsivite: 60, envers: { [mabelle]: { amitie: 60 }, [pj]: { peur: 80 } } }),
      ],
      juridictionGarde: false,
      graine: "t",
    });
    expect(camps.defenseurs).toEqual([mabelle, "impulsif"]);
    expect(camps.horsCombat.map((h) => h.id)).toEqual(["reflechi", "terrifie"]);
  });

  it("un présent loin n'entre pas au premier round, même lié", () => {
    const camps = campsDuCombat({ agresseurId: pj, cibleId: mabelle, presents: [present(mabelle), present("loin", { zone: "far", envers: { [mabelle]: { amitie: 90 } } })], juridictionGarde: false, graine: "t" });
    expect(camps.defenseurs).toEqual([mabelle]);
    expect(camps.plusTard).toEqual(["loin"]);
  });

  it("la réaction de qui reste dehors est tirée à graine fixe : même graine, même réaction", () => {
    const params = { agresseurId: pj, cibleId: mabelle, presents: [present(mabelle), present("a"), present("b"), present("c")], juridictionGarde: false, graine: "scene-12" };
    const une = campsDuCombat(params);
    expect(campsDuCombat(params)).toEqual(une);
    for (const h of une.horsCombat) expect(["fuit", "se_cache", "appelle_a_l_aide"]).toContain(h.reaction);
  });
});
