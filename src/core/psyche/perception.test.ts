import { describe, expect, it } from "vitest";
import { axesDepuisJson, ecartDeCrans, perceptionPercue } from "./perception";

describe("axesDepuisJson", () => {
  it("garde les axes connus à valeur numérique", () => {
    expect(axesDepuisJson({ friendship_hostility: 40, attraction_repulsion: -5 })).toEqual({ friendship_hostility: 40, attraction_repulsion: -5 });
  });
  it("écarte les clés inconnues et les valeurs non numériques", () => {
    expect(axesDepuisJson({ friendship_hostility: "40", inconnu: 3, trust_distrust: Number.NaN })).toEqual({});
  });
  it("rend null pour ce qui n'est pas un objet", () => {
    expect(axesDepuisJson(null)).toBeNull();
    expect(axesDepuisJson([1, 2])).toBeNull();
    expect(axesDepuisJson("x")).toBeNull();
  });
});

describe("perceptionPercue", () => {
  it("sans aucune attitude, on ne sait rien : null", () => {
    expect(perceptionPercue(null, null)).toBeNull();
  });
  it("sans façade, le perçu est le ressenti", () => {
    expect(perceptionPercue({ friendship_hostility: 20 }, null)).toEqual({ friendship: "slight_pos", attraction: null });
  });
  it("la façade l'emporte sur le ressenti, axe par axe", () => {
    // Il te hait, il te sourit.
    expect(perceptionPercue({ friendship_hostility: -80, attraction_repulsion: 50 }, { friendship_hostility: 40 })).toEqual({
      friendship: "strong_pos",
      attraction: "strong_pos",
    });
  });
  it("l'attirance n'apparaît que lorsqu'elle est positive", () => {
    expect(perceptionPercue({ attraction_repulsion: 5 }, null)?.attraction).toBeNull();
    expect(perceptionPercue({ attraction_repulsion: -50 }, null)?.attraction).toBeNull();
    expect(perceptionPercue({ attraction_repulsion: 12 }, null)?.attraction).toBe("slight_pos");
    expect(perceptionPercue({ attraction_repulsion: 90 }, null)?.attraction).toBe("extreme_pos");
  });
  it("un axe d'amitié absent vaut le neutre", () => {
    expect(perceptionPercue({ trust_distrust: 30 }, null)?.friendship).toBe("neutral");
  });
});

describe("ecartDeCrans", () => {
  it("compte les crans entre deux bandes", () => {
    expect(ecartDeCrans("neutral", "strong_pos")).toBe(2);
    expect(ecartDeCrans("extreme_neg", "extreme_pos")).toBe(6);
    expect(ecartDeCrans("slight_pos", "slight_pos")).toBe(0);
  });
});
